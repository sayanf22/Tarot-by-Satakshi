// End-to-end checks of the contact, booking, payment, email, refund, cancel and admin
// sign-in flows, against local `wrangler dev` (127.0.0.1:8787, local D1) and
// scripts/test-mocks.mjs. Writes test rows to the LOCAL database only.
// Run: node scripts/test-mocks.mjs (in one terminal), npm run build, wrangler dev, then
//      npm run test:flows
import { createHmac } from "node:crypto";
import { execSync } from "node:child_process";
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

// Payment helpers, used by the booking race checks and the payment edge cases.
const pay = async (orderId, extra = {}) =>
  (
    await fetch(`${MOCK_PAY}/test/pay`, { method: "POST", body: JSON.stringify({ orderId, ...extra }) })
  ).json();
const refunds = async (payId) => (await (await fetch(`${MOCK_PAY}/test/refunds/${payId}`)).json()).count;
const payState = async (payId) => (await (await fetch(`${MOCK_PAY}/v1/payments/${payId}`)).json()).status;
const hook = (event, p) => {
  const raw = JSON.stringify({ event, payload: { payment: { entity: p } } });
  return fetch(`${B}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Razorpay-Signature": createHmac("sha256", vars.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex"),
      "X-Razorpay-Event-Id": `evt_${Math.random().toString(36).slice(2)}`,
    },
    body: raw,
  }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));
};
const verify = (ref, p, ip) =>
  api("/api/payments/verify", {
    method: "POST",
    ip,
    json: {
      reference: ref,
      razorpay_payment_id: p.id,
      razorpay_order_id: p.order_id,
      razorpay_signature: sign(p.order_id, p.id),
    },
  });
const statusOf = async (ref, ip = "10.0.8.9") => (await api(`/api/bookings/${ref}`, { ip })).data.status;

await fetch(`${MOCK_MAIL}/clear`, { method: "POST" });

// ---- Health and public reads ----
const health = await api("/api/health");
ok(
  "health: all ten databases answer",
  health.status === 200 && health.data.media === 8,
  JSON.stringify(health.data),
);
const { data: list } = await api("/api/services");
// An astrology plan, so the birth-detail checks below have something to check.
const plan =
  list.services?.find((s) => s.bookable && s.category === "astrology") ??
  list.services?.find((s) => s.bookable);
ok("a bookable plan exists locally", Boolean(plan), plan?.slug ?? "add one in the local admin");
if (!plan) process.exit(1);

// ---- Contact form ----
// Off by default: the Contact page only opens WhatsApp and the site stores nothing.
function setInbox(on) {
  execSync(
    `npx wrangler d1 execute tarot-by-satakshi-db --local --command "INSERT INTO settings (key, value) VALUES ('contact_inbox', '${on ? 1 : 0}') ON CONFLICT (key) DO UPDATE SET value = '${on ? 1 : 0}'"`,
    { stdio: "ignore", env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" } },
  );
}
setInbox(false);
{
  const cfg = await api("/api/config");
  ok(
    "website inbox is off by default (WhatsApp mode)",
    cfg.data.contactInbox === false,
    JSON.stringify(cfg.data),
  );
  const refused = await api("/api/contact", {
    method: "POST",
    ip: "10.0.0.9",
    json: { name: "Off Test", email: CLIENT, phone: "", message: "This should not be stored." },
  });
  ok("with the inbox off, the site refuses to store messages", refused.status === 403, refused.data?.error);
}
setInbox(true);
ok("inbox can be switched on", (await api("/api/config")).data.contactInbox === true);
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
  const paid = await (
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
      razorpay_payment_id: paid.id,
      razorpay_order_id: paid.order_id,
      razorpay_signature: sign(paid.order_id, paid.id),
    },
  });
  return { ref: r.data.reference, pay: paid, verify: v, held: r.data, time: t };
}

const one = await book("Asha Test", 0, "10.0.2.1");
ok("amount comes from the database, not the browser", one.held.checkout.amount === plan.pricePaise);
ok(
  "phone is sent to Razorpay as + and digits, so it isn't asked again",
  one.held.checkout.prefill.contact === "+919876543210",
  one.held.checkout.prefill.contact,
);
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

  // Race: four clients hold the same free time at the same moment. A hold locks nothing, so all
  // four are accepted. Then they all pay at the same moment, and the first payment captured wins.
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
  ok(
    "a booking is accepted with no Turnstile token",
    racers[0].status === 201 && Boolean(racers[0].data.reference),
    String(racers[0].status),
  );
  ok(
    "four holds on the same time are all accepted, because nothing is locked until paid",
    racers.every((r) => r.status === 201),
    racers.map((r) => r.status).join(","),
  );
  const greyBefore = await api(`/api/slots?service=${plan.slug}&date=${t.date}`, { ip: "10.0.1.3" });
  ok(
    "an unpaid held booking doesn't make the time booked",
    greyBefore.data.slots?.find((s) => s.value === t.time)?.status === "free",
  );
  // Each racer pays, then its callback and webhook arrive together. Racers 2 and 4 pay with
  // authorised payments, which are captured on the way to confirmation.
  const raced = await Promise.all(
    racers.map(async (r, i) => {
      const kind = i % 2 ? "authorized" : "captured";
      const p = await pay(r.data.checkout.orderId, { status: kind });
      const [v, h] = await Promise.all([
        verify(r.data.reference, p, `10.0.9.${i + 1}`),
        hook(kind === "authorized" ? "payment.authorized" : "payment.captured", p),
      ]);
      return { p, v, h, ref: r.data.reference };
    }),
  );
  const outcomes = await Promise.all(raced.map((x) => statusOf(x.ref)));
  const refundCounts = await Promise.all(raced.map((x) => refunds(x.p.id)));
  const states = await Promise.all(raced.map((x) => payState(x.p.id)));
  ok(
    "four payments at the same moment: one booking confirmed, the other three refunded automatically",
    outcomes.filter((s) => s === "confirmed").length === 1 &&
      outcomes.filter((s) => s === "refunded").length === 3 &&
      raced.every((x) => x.v.status === 200 && x.h.status === 200),
    outcomes.join(","),
  );
  ok(
    "the winning payment is kept; each losing payment is refunded in full, exactly once",
    raced.every((x, i) =>
      outcomes[i] === "confirmed"
        ? refundCounts[i] === 0 && states[i] === "captured"
        : refundCounts[i] === 1 && states[i] === "refunded",
    ),
    `refunds=${refundCounts.join(",")} payments=${states.join(",")}`,
  );
  const after = await api(`/api/slots?service=${plan.slug}&date=${t.date}`, { ip: "10.0.1.3" });
  ok(
    "once paid, the time is grey for everyone else",
    after.data.slots?.find((s) => s.value === t.time)?.status === "booked",
  );
}

await wait(1200); // let the race's confirmation and refund emails land first
const beforeReplay = (await mail()).length;
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
ok("no duplicate emails", (await mail()).length === beforeReplay);
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

// ---- Payment edge cases: races, extra payments, late payments, refunds that must happen once ----
{
  const sql = (q) =>
    execSync(`npx wrangler d1 execute tarot-by-satakshi-db --local --command "${q.replace(/"/g, '\\"')}"`, {
      stdio: "ignore",
      env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" },
    });
  const hold = async (name, skip, ip) => {
    const t = await freeTime(skip);
    const r = await api("/api/bookings", {
      method: "POST",
      ip,
      json: { service: plan.slug, format: plan.formats[0], ...t, agreed: true, details: details(name) },
    });
    return { ref: r.data.reference, orderId: r.data.checkout?.orderId, time: t, status: r.status };
  };
  // A. The checkout callback and two webhooks arrive at the same moment for one payment.
  const a = await hold("Race Test", 0, "10.0.8.1");
  const pa = await pay(a.orderId);
  const before = (await mail()).length;
  const raced = await Promise.all([
    verify(a.ref, pa, "10.0.8.1"),
    hook("payment.captured", pa),
    hook("order.paid", pa),
    hook("payment.captured", pa),
  ]);
  await wait(1500);
  const confirmations = (await mail())
    .slice(before)
    .filter((e) => e.to[0] === CLIENT && e.subject.startsWith("Your reading is booked")).length;
  ok(
    "callback and webhooks racing: booking confirmed once, one confirmation email",
    (await statusOf(a.ref)) === "confirmed" && raced.every((r) => r.status === 200) && confirmations === 1,
    `${raced.map((r) => r.data?.result ?? r.status).join(",")} emails=${confirmations}`,
  );
  ok(
    "the same captured payment, sent twice by webhook and once by callback at the same moment: refunded 0 times",
    (await refunds(pa.id)) === 0,
  );

  // B. Payment only authorised (late authorisation or manual capture): the webhook captures it.
  const b = await hold("Auth Test", 1, "10.0.8.2");
  const pb = await pay(b.orderId, { status: "authorized" });
  const rb = await hook("payment.authorized", pb);
  ok(
    "an authorised payment is captured and the booking confirmed",
    rb.status === 200 && (await statusOf(b.ref)) === "confirmed",
    JSON.stringify(rb.data),
  );

  // C. A second, captured payment arrives for the already-paid booking A: refunded exactly once.
  const extra = await pay(a.orderId, { extra: true });
  const extraHooks = await Promise.all([hook("payment.captured", extra), hook("payment.captured", extra)]);
  await wait(1200);
  ok(
    "an extra payment on a paid booking is refunded exactly once, booking stays confirmed",
    (await refunds(extra.id)) === 1 &&
      (await statusOf(a.ref)) === "confirmed" &&
      (await refunds(pa.id)) === 0,
    extraHooks.map((r) => r.status).join(","),
  );
  ok(
    "the client is told about the extra payment refund",
    (await mail()).some((e) => e.to[0] === CLIENT && /extra payment is refunded/.test(e.html)),
  );

  // D. An extra payment that is only authorised is never captured (Razorpay refunds it itself).
  const extraAuth = await pay(a.orderId, { extra: true, status: "authorized" });
  await hook("payment.authorized", extraAuth);
  const after = await (await fetch(`${MOCK_PAY}/v1/payments/${extraAuth.id}`)).json();
  ok(
    "an extra authorised payment is not captured and not refunded by us",
    after.status === "authorized" && (await refunds(extraAuth.id)) === 0,
  );

  // E. The payment lands after the session time has passed: refunded once, never confirmed.
  const e = await hold("Late Test", 2, "10.0.8.3");
  sql(`UPDATE bookings SET start_at = ${Date.now() - 3600_000} WHERE id = '${e.ref}'`);
  const pe = await pay(e.orderId);
  await Promise.all([hook("payment.captured", pe), verify(e.ref, pe, "10.0.8.3")]);
  await hook("payment.captured", pe);
  await wait(1200);
  ok(
    "a payment after the session time is refunded once and not confirmed",
    (await refunds(pe.id)) === 1 && (await statusOf(e.ref)) === "refunded",
    `refunds=${await refunds(pe.id)} status=${await statusOf(e.ref)}`,
  );

  // F. The hold lapsed. Another client pays and is confirmed first. Then the first client pays.
  const f1 = await hold("Slow Payer", 3, "10.0.8.4");
  sql(
    `UPDATE bookings SET status = 'expired', hold_expires_at = ${Date.now() - 600_000} WHERE id = '${f1.ref}'`,
  );
  const f2 = await api("/api/bookings", {
    method: "POST",
    ip: "10.0.8.5",
    json: {
      service: plan.slug,
      format: plan.formats[0],
      ...f1.time,
      agreed: true,
      details: details("Fast Payer"),
    },
  });
  ok("after the hold lapses, another client can take the time", f2.status === 201, String(f2.status));
  const fastPay = await pay(f2.data.checkout.orderId);
  const fastVerify = await verify(f2.data.reference, fastPay, "10.0.8.5");
  const pf = await pay(f1.orderId);
  await Promise.all([hook("payment.captured", pf), hook("order.paid", pf), verify(f1.ref, pf, "10.0.8.4")]);
  await wait(1200);
  ok(
    "the late payer is refunded exactly once; the other booking keeps the time",
    fastVerify.data.result === "confirmed" &&
      (await refunds(pf.id)) === 1 &&
      (await statusOf(f1.ref)) === "refunded" &&
      (await statusOf(f2.data.reference)) === "confirmed",
    `refunds=${await refunds(pf.id)} ${await statusOf(f1.ref)} / ${await statusOf(f2.data.reference)}`,
  );

  // F2. A hold that hasn't expired doesn't stop another client from paying first.
  const h1 = await hold("Holder", 4, "10.0.8.7");
  const h2 = await api("/api/bookings", {
    method: "POST",
    ip: "10.0.8.8",
    json: {
      service: plan.slug,
      format: plan.formats[0],
      ...h1.time,
      agreed: true,
      details: details("Quick Payer"),
    },
  });
  ok(
    "a time that is only held can still be booked by another client, and the hold locks nothing",
    h2.status === 201 && (await statusOf(h1.ref)) === "held",
    String(h2.status),
  );
  const quickPay = await pay(h2.data.checkout.orderId);
  const quickVerify = await verify(h2.data.reference, quickPay, "10.0.8.8");
  const ph1 = await pay(h1.orderId);
  const holderVerify = await verify(h1.ref, ph1, "10.0.8.7");
  await hook("payment.captured", ph1);
  await wait(1200);
  ok(
    "the holder pays after the second client is confirmed: refunded exactly once, the second keeps the time",
    quickVerify.data.result === "confirmed" &&
      holderVerify.data.result === "refunded" &&
      (await refunds(ph1.id)) === 1 &&
      (await refunds(quickPay.id)) === 0 &&
      (await statusOf(h1.ref)) === "refunded" &&
      (await statusOf(h2.data.reference)) === "confirmed",
    `${holderVerify.data.result} refunds=${await refunds(ph1.id)}`,
  );

  // G. A signed event for an order that isn't ours (another app on the same account) is ignored.
  const other = await pay(
    (
      await (
        await fetch(`${MOCK_PAY}/v1/orders`, {
          method: "POST",
          body: JSON.stringify({ amount: 100, currency: "INR", receipt: "x" }),
        })
      ).json()
    ).id,
  );
  const g = await hook("payment.captured", other);
  ok(
    "a payment for someone else's order is ignored with 200",
    g.status === 200 && (await refunds(other.id)) === 0,
  );
}

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
{
  const off = await api("/api/admin/contact-mode", {
    method: "PUT",
    cookie,
    ip: "10.0.3.2",
    json: { inbox: false },
  });
  const cfg = await api("/api/config");
  ok(
    "admin can turn the website inbox off in Settings",
    off.status === 200 && cfg.data.contactInbox === false,
  );
  const bad = await api("/api/admin/contact-mode", {
    method: "PUT",
    cookie,
    ip: "10.0.3.2",
    json: { inbox: "yes" },
  });
  ok("inbox setting only takes true or false", bad.status === 400);
  await api("/api/admin/contact-mode", { method: "PUT", cookie, ip: "10.0.3.2", json: { inbox: true } });
  const alerts = await api("/api/admin/alerts", { cookie, ip: "10.0.3.2" });
  ok(
    "admin sees new-message and new-booking counts",
    alerts.status === 200 &&
      typeof alerts.data.messages === "number" &&
      typeof alerts.data.bookings === "number",
    JSON.stringify(alerts.data),
  );
  ok("alerts need a session", (await api("/api/admin/alerts", { ip: "10.0.3.6" })).status === 401);
  const seen = await api("/api/admin/alerts/seen-bookings", {
    method: "POST",
    cookie,
    ip: "10.0.3.2",
    json: {},
  });
  const after = await api("/api/admin/alerts", { cookie, ip: "10.0.3.2" });
  ok("opening Bookings clears the booking count", seen.status === 200 && after.data.bookings === 0);
}
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

// ---- Categories: the client's own categories, their plans and their booking questions ----
{
  const tag = String(Date.now()).slice(-5);
  const admin = (path, opts = {}) => api(path, { cookie, ip: "10.0.9.1", ...opts });
  const cleanup = [];

  const before = await admin("/api/admin/categories");
  ok(
    "admin lists the categories, with the limit",
    before.status === 200 && before.data.max === 20 && before.data.categories.some((c) => c.slug === "tarot"),
    String(before.status),
  );
  const signedOut = await api("/api/admin/categories", {
    method: "POST",
    ip: "10.0.9.6",
    json: { name: "Nobody" },
  });
  ok("creating a category needs a signed-in admin", signedOut.status === 401, String(signedOut.status));

  const made = await admin("/api/admin/categories", {
    method: "POST",
    json: {
      name: `Numerology ${tag}`,
      description: "Numbers and the path ahead.",
      birthDetails: false,
      active: true,
    },
  });
  ok(
    "a category is created; its web address comes from the name",
    made.status === 201 && made.data.slug.startsWith("numerology"),
    JSON.stringify(made.data),
  );
  const slug = made.data.slug;
  cleanup.push(slug);

  const dup = await admin("/api/admin/categories", {
    method: "POST",
    json: { name: "Another", slug, birthDetails: false, active: true },
  });
  ok(
    "a web address already in use is refused",
    dup.status === 409,
    `${dup.status} ${JSON.stringify(dup.data)} ${JSON.stringify({ slug })}`,
  );
  const markup = await admin("/api/admin/categories", {
    method: "POST",
    json: { name: "Bad <b>name</b>", birthDetails: false, active: true },
  });
  ok("markup in a category name is refused", markup.status === 400, markup.data?.error);
  const markupDesc = await admin("/api/admin/categories", {
    method: "POST",
    json: {
      name: `Safe ${tag}`,
      description: "<img src=x onerror=alert(1)>",
      birthDetails: false,
      active: true,
    },
  });
  ok("markup in a description is refused", markupDesc.status === 400, markupDesc.data?.error);
  const noLatin = await admin("/api/admin/categories", {
    method: "POST",
    json: { name: "ज्योतिष", birthDetails: false, active: true },
  });
  ok("a name with no English letters asks for a code", noLatin.status === 400, noLatin.data?.error);

  // A plan goes into the new category and shows on the site with its name.
  const plan1 = await admin("/api/admin/services", {
    method: "POST",
    json: {
      slug: `num-${tag}`,
      name: `Life Path ${tag}`,
      category: slug,
      summary: "",
      icon: "star",
      card: "wheel",
      formats: ["call", "text"],
      durationMin: 60,
      pricePaise: 50000,
      active: true,
      sortOrder: 5,
      imageKey: null,
    },
  });
  ok("a plan goes into the new category", plan1.status === 201, JSON.stringify(plan1.data));
  cleanup.unshift(`plan:num-${tag}`);
  const pub = await api("/api/services", { ip: "10.0.9.2" });
  const shown = pub.data.services.find((s) => s.slug === `num-${tag}`);
  ok(
    "the site shows the plan with its category name, and lists the category",
    shown?.categoryName === `Numerology ${tag}` && pub.data.categories.some((c) => c.slug === slug),
    shown?.categoryName,
  );

  // Hiding a category hides its plans; a plan can't be added to a hidden category.
  const hide = await admin(`/api/admin/categories/${slug}`, {
    method: "PUT",
    json: {
      name: `Numerology ${tag}`,
      description: "Numbers and the path ahead.",
      birthDetails: false,
      active: false,
    },
  });
  const pubHidden = await api("/api/services", { ip: "10.0.9.3" });
  ok(
    "hiding a category hides its plans from the site",
    hide.status === 200 && !pubHidden.data.services.some((s) => s.slug === `num-${tag}`),
  );
  const intoHidden = await admin("/api/admin/services", {
    method: "POST",
    json: {
      slug: `numh-${tag}`,
      name: `Hidden ${tag}`,
      category: slug,
      summary: "",
      icon: "star",
      card: "wheel",
      formats: ["call"],
      durationMin: 60,
      pricePaise: 50000,
      active: true,
      sortOrder: 6,
      imageKey: null,
    },
  });
  ok("a plan can't be added to a hidden category", intoHidden.status === 400, intoHidden.data?.error);

  // A category with plans can't be deleted; once it has none, it can.
  const delUsed = await admin(`/api/admin/categories/${slug}`, { method: "DELETE" });
  ok("a category that still has plans can't be deleted", delUsed.status === 409, delUsed.data?.error);
  await admin(`/api/admin/categories/${slug}`, {
    method: "PUT",
    json: {
      name: `Numerology ${tag}`,
      description: "Numbers and the path ahead.",
      birthDetails: false,
      active: true,
    },
  });

  // Order: the list can be reordered; a list that doesn't match the categories is refused.
  const order = (await admin("/api/admin/categories")).data.categories.map((c) => c.slug);
  const reversed = [...order].reverse();
  const reorder = await admin("/api/admin/categories/reorder", { method: "POST", json: { slugs: reversed } });
  const after = (await admin("/api/admin/categories")).data.categories.map((c) => c.slug);
  ok("the category order can be changed", reorder.status === 200 && after.join() === reversed.join());
  const broken = await admin("/api/admin/categories/reorder", {
    method: "POST",
    json: { slugs: [reversed[0], reversed[0]] },
  });
  ok("a broken order list is refused", broken.status === 409 || broken.status === 400, String(broken.status));
  await admin("/api/admin/categories/reorder", { method: "POST", json: { slugs: order } });

  // A category that asks for birth details: its booking form asks for them too.
  const bcat = await admin("/api/admin/categories", {
    method: "POST",
    json: { name: `Palmistry ${tag}`, description: "", birthDetails: true, active: true },
  });
  const bslug = bcat.data.slug;
  cleanup.push(bslug);
  const bplan = await admin("/api/admin/services", {
    method: "POST",
    json: {
      slug: `palm-${tag}`,
      name: `Palm ${tag}`,
      category: bslug,
      summary: "",
      icon: "star",
      card: "wheel",
      formats: ["call"],
      durationMin: 60,
      pricePaise: 10000,
      active: true,
      sortOrder: 7,
      imageKey: null,
    },
  });
  ok("a birth-details category and its plan are created", bcat.status === 201 && bplan.status === 201);
  cleanup.unshift(`plan:palm-${tag}`);
  let day = null;
  for (let d = 2; d < 40 && !day; d++) {
    const date = new Date(Date.now() + d * 864e5 + 5.5 * 36e5).toISOString().slice(0, 10);
    const { data } = await api(`/api/slots?service=palm-${tag}&date=${date}`, { ip: "10.0.9.7" });
    const free = (data.slots ?? []).find((s) => s.status === "free");
    if (free) day = { date, time: free.value };
  }
  const bookingBase = {
    service: `palm-${tag}`,
    format: "call",
    date: day?.date,
    time: day?.time,
    agreed: true,
  };
  const noBirth = await api("/api/bookings", {
    method: "POST",
    ip: "10.0.9.8",
    json: {
      ...bookingBase,
      details: { ...details("No Birth"), birthDate: "", birthTime: "", birthPlace: "" },
    },
  });
  ok(
    "a booking in a birth-details category without birth details is refused",
    noBirth.status === 400,
    String(noBirth.status),
  );
  const withBirth = await api("/api/bookings", {
    method: "POST",
    ip: "10.0.9.8",
    json: { ...bookingBase, details: details("With Birth") },
  });
  ok(
    "the same booking with birth details is accepted",
    withBirth.status === 201,
    JSON.stringify(withBirth.data),
  );

  // Limit: at most 20 categories, counted by the database in the same statement as the insert.
  const now20 = (await admin("/api/admin/categories")).data.categories.length;
  const toFill = 20 - now20;
  let filled = 0;
  let fillErr = null;
  for (let i = 0; i < toFill; i++) {
    const r = await admin("/api/admin/categories", {
      method: "POST",
      ip: `10.9.30.${i + 1}`,
      json: { name: `Fill ${tag} ${i}`, birthDetails: false, active: true },
    });
    if (r.status === 201) {
      filled++;
      cleanup.push(r.data.slug);
    } else if (!fillErr) {
      fillErr = { status: r.status, data: r.data };
    }
  }
  const over = await admin("/api/admin/categories", {
    method: "POST",
    ip: "10.9.31.1",
    json: { name: `Over ${tag}`, birthDetails: false, active: true },
  });
  ok(
    "no more than 20 categories",
    filled === toFill && over.status === 409,
    `${filled}/${toFill} then ${over.status}`,
  );

  // Clean up everything this block made: plans first, then categories with no plans.
  for (const item of cleanup) {
    if (item.startsWith("plan:")) {
      await admin(`/api/admin/services/${item.slice(5)}`, { method: "DELETE", ip: "10.9.40.1" });
    }
  }
  for (const item of cleanup.filter((i) => !i.startsWith("plan:"))) {
    const r = await admin(`/api/admin/categories/${item}`, {
      method: "DELETE",
      ip: `10.9.41.${cleanup.indexOf(item) + 1}`,
    });
    ok(`test category ${item} is removed`, r.status === 200, String(r.status));
  }
  const end = (await admin("/api/admin/categories")).data.categories.length;
  ok(
    "the category list is back to where it started",
    end === before.data.categories.length,
    `${end} (was ${before.data.categories.length})`,
  );
}

const out = await api("/api/admin/logout", { method: "POST", json: {}, cookie });
ok(
  "sign-out ends the session",
  out.status === 200 && (await api("/api/admin/account", { cookie })).status === 401,
);

console.log(failed ? `${failed} FAILED` : "ALL PASS");
process.exit(failed ? 1 : 0);
