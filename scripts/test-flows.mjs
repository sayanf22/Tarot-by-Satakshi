// End-to-end checks of the contact, booking, payment, email, refund, cancel and admin
// sign-in flows, against local `wrangler dev` (127.0.0.1:8787, local D1) and
// scripts/test-mocks.mjs. Writes test rows to the LOCAL database only.
// Run: node scripts/test-mocks.mjs (in one terminal), npm run build, wrangler dev, then
//      npm run test:flows
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const B = "http://127.0.0.1:8787";
const MOCK_PAY = "http://127.0.0.1:8790";
const MOCK_MAIL = "http://127.0.0.1:8791";
const ADMIN = "tarotwithsatakshi@gmail.com";
const CLIENT = "client.test@example.com";

const vars = Object.fromEntries(
  readFileSync(".dev.vars", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
if (
  !/^http:\/\/127\.0\.0\.1:8790\/v1$/.test(vars.RAZORPAY_API_BASE ?? "") ||
  !/^http:\/\/127\.0\.0\.1:8791$/.test(vars.RESEND_API_BASE ?? "")
) {
  console.error(
    "Refusing to run: .dev.vars must point RAZORPAY_API_BASE and RESEND_API_BASE at the local mocks.",
  );
  process.exit(1);
}

let failed = 0;
const ok = (name, cond, info = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${info ? `: ${info}` : ""}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, { method = "GET", json, cookie, origin = B, ip } = {}) {
  const init = {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      // Each test group uses its own visitor address, so rate limits don't spill over.
      ...(ip ? { "CF-Connecting-IP": ip } : {}),
    },
  };
  if (json !== undefined) init.body = JSON.stringify(json);
  const res = await fetch(B + path, init);
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {}
  return { status: res.status, data, setCookie: res.headers.get("set-cookie") };
}
const mail = async () => (await fetch(`${MOCK_MAIL}/all`)).json();
const sign = (o, p) => createHmac("sha256", vars.RAZORPAY_KEY_SECRET).update(`${o}|${p}`).digest("hex");

await fetch(`${MOCK_MAIL}/clear`, { method: "POST" });

// ---- Health and public reads ----
const health = await api("/api/health");
ok(
  "health: all ten databases answer",
  health.status === 200 && health.data.media === 8,
  JSON.stringify(health.data),
);
const { data: list } = await api("/api/services");
const plan = list.services?.find((s) => s.bookable);
ok("a bookable plan exists locally", Boolean(plan), plan?.slug ?? "add one in the local admin");
if (!plan) process.exit(1);

// ---- Contact form ----
const contact = await api("/api/contact", {
  method: "POST",
  ip: "10.0.0.1",
  json: {
    name: "Mira Test",
    email: CLIENT,
    phone: "",
    message: "Hello, this is a contact form test message.",
    turnstileToken: "local",
  },
});
await wait(800);
const enquiryMail = (await mail()).find((e) => e.subject.startsWith("New message from Mira Test"));
ok(
  "contact message accepted",
  contact.status === 200 || contact.status === 201,
  `${contact.status} ${JSON.stringify(contact.data)}`,
);
ok("admin emailed about the message", enquiryMail?.to[0] === ADMIN);
ok("admin can reply straight to the sender", enquiryMail?.reply_to?.[0] === CLIENT);
const cross = await api("/api/contact", {
  method: "POST",
  origin: "https://evil.example",
  ip: "10.0.0.2",
  json: {},
});
ok("contact from another site refused", cross.status === 403);
const big = await api("/api/contact", {
  method: "POST",
  ip: "10.0.0.3",
  json: { message: "x".repeat(20_000) },
});
ok("oversized body refused", big.status === 413);
const statuses = [];
for (let i = 0; i < 7; i++)
  statuses.push((await api("/api/contact", { method: "POST", ip: "10.0.0.4", json: {} })).status);
ok("contact form rate-limited (5 a minute)", statuses.includes(429), statuses.join(","));

// ---- Booking, payment and emails ----
async function freeTime(skip) {
  for (let d = 1; d < 40; d++) {
    const date = new Date(Date.now() + d * 864e5 + 5.5 * 36e5).toISOString().slice(0, 10);
    const { data } = await api(`/api/slots?service=${plan.slug}&date=${date}`, { ip: "10.0.1.1" });
    if (data.slots?.length > skip) return { date, time: data.slots[skip].value };
  }
}
const details = (name) => ({
  name,
  email: CLIENT,
  phone: "+91 98765 43210",
  topic: "career",
  question: "Test question for the email check.",
  birthDate: "1995-04-12",
  birthTime: "10:30",
  birthTimeUnknown: false,
  birthTimeApprox: "",
  birthPlace: "New Delhi",
});
async function book(name, skip, ip) {
  const t = await freeTime(skip);
  const r = await api("/api/bookings", {
    method: "POST",
    ip,
    json: { service: plan.slug, format: plan.formats[0], ...t, agreed: true, details: details(name) },
  });
  if (r.status !== 201) {
    ok(`booking held (${name})`, false, `${r.status} ${JSON.stringify(r.data)}`);
    process.exit(1);
  }
  const pay = await (
    await fetch(`${MOCK_PAY}/test/pay`, {
      method: "POST",
      body: JSON.stringify({ orderId: r.data.checkout.orderId }),
    })
  ).json();
  const v = await api("/api/payments/verify", {
    method: "POST",
    ip,
    json: {
      reference: r.data.reference,
      razorpay_payment_id: pay.id,
      razorpay_order_id: pay.order_id,
      razorpay_signature: sign(pay.order_id, pay.id),
    },
  });
  return { ref: r.data.reference, pay, verify: v, held: r.data, time: t };
}

const one = await book("Asha Test", 0, "10.0.2.1");
ok("amount comes from the database, not the browser", one.held.checkout.amount === plan.pricePaise);
ok("payment confirms the booking", one.verify.data.result === "confirmed", one.ref);
await wait(1500);
let all = await mail();
const client = all.find((e) => e.to[0] === CLIENT && e.subject.startsWith("Your reading is booked"));
const owner = all.find((e) => e.to[0] === ADMIN && e.subject.startsWith("New booking"));
ok("customer gets a confirmation", Boolean(client), client?.subject);
ok("confirmation is from the site's sender", client?.from === vars.EMAIL_FROM, client?.from);
ok("customer replies go to the admin", client?.reply_to?.[0] === ADMIN);
ok("confirmation has the calendar file", client?.attachments.includes("session.ics"));
ok("confirmation links to the booking status page", client?.html.includes(`/book/status?ref=${one.ref}`));
ok(
  "confirmation has a plain-text copy",
  typeof client?.text === "string" && client.text.includes(one.ref) && !/<[a-z]/i.test(client.text),
);
ok("admin gets a new-booking alert", Boolean(owner), owner?.subject);
ok(
  "alert lists the customer's details and answers",
  ["Asha Test", CLIENT, "+91 98765 43210", "Test question", "New Delhi"].every((s) =>
    owner?.html.includes(s),
  ),
);
ok("admin replies go to the customer", owner?.reply_to?.[0] === CLIENT);

const status = await api(`/api/bookings/${one.ref}`, { ip: "10.0.2.1" });
ok(
  "status page shows confirmed, without personal details",
  status.data.status === "confirmed" && !JSON.stringify(status.data).includes(CLIENT),
  JSON.stringify(status.data),
);

const taken = await api("/api/bookings", {
  method: "POST",
  ip: "10.0.2.2",
  json: {
    service: plan.slug,
    format: plan.formats[0],
    ...one.time,
    agreed: true,
    details: details("Late Test"),
  },
});
ok("a booked time can't be booked twice", taken.status === 409, JSON.stringify(taken.data));

const again = await api("/api/payments/verify", {
  method: "POST",
  ip: "10.0.2.1",
  json: {
    reference: one.ref,
    razorpay_payment_id: one.pay.id,
    razorpay_order_id: one.pay.order_id,
    razorpay_signature: sign(one.pay.order_id, one.pay.id),
  },
});
await wait(800);
ok("replayed payment is not confirmed twice", again.data.result === "already", again.data.result);
ok("no duplicate emails", (await mail()).length === all.length);
const forged = await api("/api/payments/verify", {
  method: "POST",
  ip: "10.0.2.1",
  json: {
    reference: one.ref,
    razorpay_payment_id: one.pay.id,
    razorpay_order_id: one.pay.order_id,
    razorpay_signature: "0".repeat(64),
  },
});
ok("forged payment signature refused", forged.status === 400);
const webhook = await api("/api/payments/webhook", {
  method: "POST",
  origin: null,
  json: { event: "payment.captured" },
});
ok("webhook without a valid signature refused", webhook.status === 400);

// ---- Admin sign-in ----
const nobody = await api("/api/admin/login/start", {
  method: "POST",
  ip: "10.0.3.1",
  json: { email: "someone@example.com" },
});
await wait(400);
ok(
  "unknown email gets the same reply and no email",
  nobody.status === 200 && !(await mail()).some((e) => e.to[0] === "someone@example.com"),
);
await api("/api/admin/login/start", { method: "POST", ip: "10.0.3.2", json: { email: ADMIN } });
await wait(500);
const code = (await mail())
  .toReversed()
  .find((e) => e.subject === "Your admin sign-in code")
  ?.html.match(/>(\d{6})</)?.[1];
ok("sign-in code emailed to the admin", Boolean(code));
const wrong = await api("/api/admin/login/verify", {
  method: "POST",
  ip: "10.0.3.2",
  json: { email: ADMIN, code: code === "000000" ? "111111" : "000000" },
});
ok("wrong code refused", wrong.status === 401);
const login = await api("/api/admin/login/verify", {
  method: "POST",
  ip: "10.0.3.2",
  json: { email: ADMIN, code },
});
const cookie = login.setCookie?.split(";")[0];
ok("right code signs in", login.status === 200 && cookie?.startsWith("__Host-tbs_admin="));
ok(
  "session cookie is HttpOnly, Secure, SameSite=Strict",
  /HttpOnly/i.test(login.setCookie) &&
    /Secure/i.test(login.setCookie) &&
    /SameSite=Strict/i.test(login.setCookie),
);
const reuse = await api("/api/admin/login/verify", {
  method: "POST",
  ip: "10.0.3.2",
  json: { email: ADMIN, code },
});
ok("a code works only once", reuse.status === 401);
ok("admin API needs a session", (await api("/api/admin/account")).status === 401);
ok(
  "admin API refuses a forged session",
  (await api("/api/admin/account", { cookie: "__Host-tbs_admin=forged" })).status === 401,
);
ok(
  "admin changes from another site refused",
  (
    await api(`/api/admin/bookings/${one.ref}`, {
      method: "PATCH",
      json: { action: "note", note: "x" },
      cookie,
      origin: "https://evil.example",
    })
  ).status === 403,
);

// ---- Refund and cancel emails ----
const before = (await mail()).length;
const refund = await api(`/api/admin/bookings/${one.ref}/refund`, {
  method: "POST",
  json: { reason: "Test" },
  cookie,
});
await wait(1500);
all = await mail();
const rc = all.find((e) => e.to[0] === CLIENT && e.subject.startsWith("Refund of"));
ok("admin refund accepted", refund.status === 200, JSON.stringify(refund.data));
ok(
  "customer told about the refund, with the timeline",
  Boolean(rc) && rc.html.includes("5 to 7 working days"),
);
ok(
  "admin gets a refund copy",
  all.some((e) => e.to[0] === ADMIN && e.subject.startsWith("Refunded")),
);
ok("exactly two refund emails", all.length - before === 2, String(all.length - before));
ok(
  "a refunded booking can't be refunded again",
  (await api(`/api/admin/bookings/${one.ref}/refund`, { method: "POST", json: {}, cookie })).status === 409,
);

const two = await book("Ravi Test", 1, "10.0.2.3");
ok("second booking confirmed", two.verify.data.result === "confirmed", two.ref);
await wait(1000);
const cancel = await api(`/api/admin/bookings/${two.ref}`, {
  method: "PATCH",
  json: { action: "cancel" },
  cookie,
});
await wait(1000);
ok("admin cancel accepted", cancel.status === 200);
ok(
  "customer told about the cancellation",
  (await mail()).some((e) => e.to[0] === CLIENT && e.subject.startsWith("Your session has been cancelled")),
);
ok(
  "no line breaks in any email subject",
  (await mail()).every((e) => !/[\r\n]/.test(e.subject)),
);

const out = await api("/api/admin/logout", { method: "POST", json: {}, cookie });
ok(
  "sign-out ends the session",
  out.status === 200 && (await api("/api/admin/account", { cookie })).status === 401,
);

console.log(failed ? `${failed} FAILED` : "ALL PASS");
process.exit(failed ? 1 : 0);
