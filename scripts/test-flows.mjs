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
// A second message must email too, even if an earlier message's id is reused.
await api("/api/contact", {
  method: "POST",
  ip: "10.0.0.5",
  json: {
    name: "Mira Again",
    email: CLIENT,
    phone: "",
    message: "Second contact message to check emails don't collide.",
    turnstileToken: "local",
  },
});
await wait(800);
ok(
  "every contact message gets its own email",
  (await mail()).some((e) => e.subject.startsWith("New message from Mira Again")),
);
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
    const free = (data.slots ?? []).filter((s) => s.status === "free");
    if (free.length > skip) return { date, time: free[skip].value };
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
{
  const day = await api(`/api/slots?service=${plan.slug}&date=${one.time.date}`, { ip: "10.0.1.2" });
  const mine = day.data.slots?.find((s) => s.value === one.time.time);
  ok(
    "the booked time shows as booked (grey) for other clients",
    mine?.status === "booked",
    JSON.stringify(mine),
  );
  ok(
    "slot list says nothing about who booked",
    !JSON.stringify(day.data).includes(CLIENT) && !JSON.stringify(day.data).includes("Asha"),
  );
  const days = await api(`/api/days?service=${plan.slug}`, { ip: "10.0.1.2" });
  ok(
    "calendar days come back as open, full or closed",
    Array.isArray(days.data.days) &&
      days.data.days.length > 5 &&
      days.data.days.every((d) => ["open", "full", "closed"].includes(d.status)),
    JSON.stringify(days.data.days?.slice(0, 3)),
  );

  // Race: several clients press Pay for the same free time at the same moment.
  const t = await freeTime(0);
  const racers = await Promise.all(
    [1, 2, 3, 4].map((i) =>
      api("/api/bookings", {
        method: "POST",
        ip: `10.0.9.${i}`,
        json: {
          service: plan.slug,
          format: plan.formats[0],
          ...t,
          agreed: true,
          details: details(`Racer ${i}`),
        },
      }),
    ),
  );
  const won = racers.filter((r) => r.status === 201).length;
  const lost = racers.filter((r) => r.status === 409).length;
  ok(
    "same time, same moment: exactly one client gets it, the rest are told it's taken",
    won === 1 && lost === 3,
    racers.map((r) => r.status).join(","),
  );
  const after = await api(`/api/slots?service=${plan.slug}&date=${t.date}`, { ip: "10.0.1.3" });
  ok(
    "a time being paid for is grey for everyone else",
    after.data.slots?.find((s) => s.value === t.time)?.status === "booked",
  );
}

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
  "an email that isn't an admin is told so straight away, and gets no email",
  nobody.status === 403 &&
    /isn't an admin email/.test(nobody.data?.error ?? "") &&
    !(await mail()).some((e) => e.to[0] === "someone@example.com"),
  `${nobody.status} ${JSON.stringify(nobody.data)}`,
);
const badShape = await api("/api/admin/login/start", {
  method: "POST",
  ip: "10.0.3.5",
  json: { email: "not-an-email" },
});
ok("a mistyped email is refused with a clear message", badShape.status === 400, badShape.data?.error);
const first = await api("/api/admin/login/start", { method: "POST", ip: "10.0.3.2", json: { email: ADMIN } });
ok(
  "the admin is told the code was sent",
  first.status === 200 && first.data?.sent === true,
  JSON.stringify(first.data),
);
await wait(500);
const SECOND = "second.admin@example.com";
const notYet = await api("/api/admin/login/start", {
  method: "POST",
  ip: "10.0.3.3",
  json: { email: SECOND },
});
await wait(500);
ok(
  "an email not yet added as admin is refused and gets no code",
  notYet.status === 403 && !(await mail()).some((e) => e.to[0] === SECOND),
);
const code = (await mail())
  .filter((e) => e.to[0] === ADMIN)
  .toReversed()
  .find((e) => e.subject === "Your admin sign-in code")
  ?.html.match(/>(\d{6})</)?.[1];
ok("sign-in code emailed to the admin", Boolean(code));
const codesBefore = (await mail()).filter(
  (e) => e.to[0] === ADMIN && e.subject === "Your admin sign-in code",
).length;
const tooSoon = await api("/api/admin/login/start", {
  method: "POST",
  ip: "10.0.3.4",
  json: { email: ADMIN },
});
await wait(700);
ok(
  "a second code within 30 seconds is not sent, and the first still works",
  tooSoon.status === 200 &&
    tooSoon.data?.sent === false &&
    tooSoon.data?.waitSeconds > 0 &&
    (await mail()).filter((e) => e.to[0] === ADMIN && e.subject === "Your admin sign-in code").length ===
      codesBefore,
);
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
await wait(800);
ok(
  "sign-in alert emailed to the admin",
  (await mail()).some((e) => e.to[0] === ADMIN && e.subject === "New sign-in to the admin"),
);
ok(
  "code email has no links",
  !/href=/i.test((await mail()).find((e) => e.subject === "Your admin sign-in code")?.html ?? "href="),
);
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
// ---- Every admin route refuses a visitor without a session ----
{
  const source = readFileSync("worker/routes/admin.ts", "utf8");
  const open = new Set(["/status", "/login/start", "/login/verify"]); // the only routes that work before sign-in
  const routes = [...source.matchAll(/adminRoutes\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)].map((m) => ({
    method: m[1].toUpperCase(),
    path: m[2],
  }));
  const bad = [];
  let n = 0;
  for (const r of routes) {
    if (open.has(r.path)) continue;
    n++;
    const url = `/api/admin${r.path.replace(/:[a-zA-Z]+/g, "x")}`;
    const res = await api(url, {
      method: r.method,
      ip: "10.0.6.1",
      json: r.method === "GET" ? undefined : {},
    });
    if (res.status !== 401) bad.push(`${r.method} ${r.path} -> ${res.status}`);
    if (n % 50 === 0) await wait(1000);
  }
  ok(`all ${n} protected admin routes answer 401 without a session`, bad.length === 0, bad.join("; "));
  const forged = [];
  for (const r of routes.filter((x) => !open.has(x.path)).slice(0, 25)) {
    const res = await api(`/api/admin${r.path.replace(/:[a-zA-Z]+/g, "x")}`, {
      method: r.method,
      ip: "10.0.6.2",
      cookie: "__Host-tbs_admin=" + "a".repeat(43),
      json: r.method === "GET" ? undefined : {},
    });
    if (res.status !== 401) forged.push(`${r.method} ${r.path} -> ${res.status}`);
  }
  ok("a made-up session cookie is refused everywhere", forged.length === 0, forged.join("; "));
}
// ---- Admin list: only the main admin adds or removes; the main admin can't be removed ----
{
  const ipA = "10.0.4.1";
  const list0 = await api("/api/admin/admins", { cookie, ip: ipA });
  ok(
    "main admin sees the list and may manage it",
    list0.status === 200 && list0.data.canManage === true && list0.data.mainAdmins.includes(ADMIN),
  );
  ok("admin list needs a session", (await api("/api/admin/admins", { ip: ipA })).status === 401);
  ok(
    "a bad email is refused",
    (await api("/api/admin/admins", { method: "POST", cookie, ip: ipA, json: { email: "not-an-email" } }))
      .status === 400,
  );
  ok(
    "the main admin can't be added again",
    (await api("/api/admin/admins", { method: "POST", cookie, ip: ipA, json: { email: ADMIN } })).status ===
      409,
  );
  ok(
    "the main admin can't be removed",
    (await api("/api/admin/admins", { method: "DELETE", cookie, ip: ipA, json: { email: ADMIN } })).status ===
      403,
  );
  ok(
    "removing someone who isn't an admin gives 404",
    (
      await api("/api/admin/admins", {
        method: "DELETE",
        cookie,
        ip: ipA,
        json: { email: "nobody@example.com" },
      })
    ).status === 404,
  );
  ok(
    "add from another site refused",
    (
      await api("/api/admin/admins", {
        method: "POST",
        cookie,
        ip: ipA,
        origin: "https://evil.example",
        json: { email: SECOND },
      })
    ).status === 403,
  );

  const before = (await mail()).length;
  const added = await api("/api/admin/admins", {
    method: "POST",
    cookie,
    ip: ipA,
    json: { email: SECOND.toUpperCase() },
  });
  await wait(1500);
  ok(
    "main admin adds an admin (email is lowercased)",
    added.status === 201 && added.data.admins.some((a) => a.email === SECOND),
    String(added.status),
  );
  const msgs = (await mail()).slice(before);
  ok(
    "main admin is emailed about the new admin",
    msgs.some((e) => e.to[0] === ADMIN && e.subject.includes("Admin list changed")),
  );
  ok(
    "the new admin is emailed too, without a link",
    msgs.some(
      (e) => e.to[0] === SECOND && e.subject === "You can now sign in to the admin" && !/href=/i.test(e.html),
    ),
  );
  ok(
    "adding the same email again gives 409",
    (await api("/api/admin/admins", { method: "POST", cookie, ip: ipA, json: { email: SECOND } })).status ===
      409,
  );

  // The new admin signs in with a code, and can look but not change the list.
  await api("/api/admin/login/start", { method: "POST", ip: "10.0.4.2", json: { email: SECOND } });
  await wait(700);
  const code2 = (await mail())
    .toReversed()
    .find((e) => e.to[0] === SECOND && e.subject === "Your admin sign-in code")
    ?.html.match(/>(\d{6})</)?.[1];
  ok("the new admin gets a sign-in code", Boolean(code2));
  const login2 = await api("/api/admin/login/verify", {
    method: "POST",
    ip: "10.0.4.2",
    json: { email: SECOND, code: code2 },
  });
  const cookie2 = login2.setCookie?.split(";")[0];
  ok("the new admin signs in", login2.status === 200 && Boolean(cookie2));
  const list2 = await api("/api/admin/admins", { cookie: cookie2, ip: "10.0.4.2" });
  ok(
    "an added admin can see the list but not manage it",
    list2.status === 200 && list2.data.canManage === false,
  );
  ok(
    "an added admin can't add admins",
    (
      await api("/api/admin/admins", {
        method: "POST",
        cookie: cookie2,
        ip: "10.0.4.2",
        json: { email: "third@example.com" },
      })
    ).status === 403,
  );
  ok(
    "an added admin can't remove admins",
    (
      await api("/api/admin/admins", {
        method: "DELETE",
        cookie: cookie2,
        ip: "10.0.4.2",
        json: { email: ADMIN },
      })
    ).status === 403,
  );

  // Removing ends their access at once.
  const removed = await api("/api/admin/admins", {
    method: "DELETE",
    cookie,
    ip: ipA,
    json: { email: SECOND },
  });
  await wait(1200);
  ok(
    "main admin removes the admin",
    removed.status === 200 && !removed.data.admins.some((a) => a.email === SECOND),
  );
  ok(
    "the removed admin's session stops working",
    (await api("/api/admin/account", { cookie: cookie2, ip: "10.0.4.2" })).status === 401,
  );
  ok(
    "the removed admin is told",
    (await mail()).some((e) => e.to[0] === SECOND && e.subject === "Your admin access was removed"),
  );
  const beforeCodes = (await mail()).length;
  const removedTry = await api("/api/admin/login/start", {
    method: "POST",
    ip: "10.0.4.3",
    json: { email: SECOND },
  });
  await wait(600);
  ok(
    "a removed admin is refused and gets no new code",
    removedTry.status === 403 &&
      (await mail())
        .slice(beforeCodes)
        .every((e) => e.to[0] !== SECOND || e.subject !== "Your admin sign-in code"),
  );

  // At most 10 extra admins.
  for (let i = 1; i <= 10; i++)
    await api("/api/admin/admins", {
      method: "POST",
      cookie,
      ip: "10.0.4.9",
      json: { email: `extra${i}@example.com` },
    });
  const eleventh = await api("/api/admin/admins", {
    method: "POST",
    cookie,
    ip: "10.0.4.9",
    json: { email: "extra11@example.com" },
  });
  ok(
    "no more than 10 extra admins",
    eleventh.status === 409 || eleventh.status === 429,
    String(eleventh.status),
  );
  await wait(1100);
  for (let i = 1; i <= 10; i++)
    await api("/api/admin/admins", {
      method: "DELETE",
      cookie,
      ip: "10.0.4.8",
      json: { email: `extra${i}@example.com` },
    });
}
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

// ---- Plans must be bookable (price and length required) ----
const noPrice = await api("/api/admin/services", {
  method: "POST",
  cookie,
  json: {
    slug: "test-no-price",
    name: "No price test",
    category: "tarot",
    summary: "",
    icon: "cards",
    card: "moon",
    formats: ["call"],
    durationMin: 30,
    pricePaise: null,
    active: true,
    sortOrder: 99,
    imageKey: null,
  },
});
ok("a plan without a price is refused", noPrice.status === 400, String(noPrice.status));

// ---- Moving a booking ----
{
  const three = await book("Neha Test", 2, "10.0.2.4");
  ok("booking to move confirmed", three.verify.data.result === "confirmed", three.ref);
  let target;
  for (let d = 2; d < 40 && !target; d++) {
    const date = new Date(Date.now() + d * 864e5 + 5.5 * 36e5).toISOString().slice(0, 10);
    if (date === three.time.date) continue;
    const { data } = await api(`/api/admin/bookings/${three.ref}/slots?date=${date}`, { cookie });
    if (data.slots?.length) target = { date, time: data.slots[0].value };
  }
  ok("admin sees free times to move to", Boolean(target));
  const taken2 = await api(`/api/admin/bookings/${three.ref}/move`, {
    method: "POST",
    cookie,
    json: one.time,
  });
  ok("can't move onto a taken time", taken2.status === 409, String(taken2.status));
  const before2 = (await mail()).length;
  const moved = await api(`/api/admin/bookings/${three.ref}/move`, { method: "POST", cookie, json: target });
  await wait(1200);
  const after2 = await mail();
  ok("booking moved", moved.status === 200, JSON.stringify(moved.data));
  ok(
    "client emailed the new time with a calendar file",
    after2.some(
      (e) =>
        e.to[0] === CLIENT &&
        e.subject.startsWith("Your session has moved") &&
        e.attachments.includes("session.ics"),
    ),
  );
  ok(
    "admin gets a copy of the move",
    after2.some((e) => e.to[0] === ADMIN && e.subject.startsWith("Moved:")),
  );
  ok("exactly two move emails", after2.length - before2 === 2, String(after2.length - before2));
  const freed = await api("/api/bookings", {
    method: "POST",
    ip: "10.0.2.5",
    json: {
      service: plan.slug,
      format: plan.formats[0],
      ...three.time,
      agreed: true,
      details: details("Free Test"),
    },
  });
  ok("the old time is free again after the move", freed.status === 201, String(freed.status));
  ok(
    "moving needs a session",
    (await api(`/api/admin/bookings/${three.ref}/move`, { method: "POST", json: target })).status === 401,
  );
}

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
