// Local-only mocks for `npm run test:flows`: Razorpay on 127.0.0.1:8790 and Resend on
// 127.0.0.1:8791. The Worker only accepts these overrides for 127.0.0.1 (RAZORPAY_API_BASE
// and RESEND_API_BASE in .dev.vars), so they can never affect the live site.
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

const orders = new Map();
const payments = new Map();
const refundsByKey = new Map();
const refundCount = new Map();
const emails = [];

const id = (p) => `${p}_${randomBytes(9).toString("hex")}`;
const read = (req) =>
  new Promise((r) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => r(b));
  });
const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  const body = await read(req);
  const p = new URL(req.url, "http://x").pathname;
  if (req.method === "POST" && p === "/v1/orders") {
    const { amount, currency, receipt } = JSON.parse(body);
    const o = { id: id("order"), amount, currency, receipt, status: "created" };
    orders.set(o.id, o);
    return send(res, 200, o);
  }
  // Test helper: pay an order. status "captured" (default) or "authorized" (late or manual capture).
  // Like Razorpay, only one payment can be captured for an order, unless `extra` is set to
  // simulate a late-authorised second attempt that arrives after the order is paid.
  if (req.method === "POST" && p === "/test/pay") {
    const { orderId, status = "captured", extra = false } = JSON.parse(body);
    const o = orders.get(orderId);
    if (!o) return send(res, 404, {});
    if (o.status === "paid" && !extra) return send(res, 400, { error: { code: "BAD_REQUEST_ERROR" } });
    const pay = {
      id: id("pay"),
      order_id: o.id,
      amount: o.amount,
      currency: "INR",
      status,
      method: "upi",
      amount_refunded: 0,
    };
    payments.set(pay.id, pay);
    if (status === "captured") o.status = "paid";
    return send(res, 200, pay);
  }
  // Test helper: how many refunds were really made for a payment.
  let t = p.match(/^\/test\/refunds\/([^/]+)$/);
  if (req.method === "GET" && t) return send(res, 200, { count: refundCount.get(t[1]) ?? 0 });
  let m = p.match(/^\/v1\/payments\/([^/]+)$/);
  if (req.method === "GET" && m)
    return payments.has(m[1])
      ? send(res, 200, payments.get(m[1]))
      : send(res, 404, { error: { code: "BAD_REQUEST_ERROR" } });
  m = p.match(/^\/v1\/payments\/([^/]+)\/capture$/);
  if (req.method === "POST" && m) {
    const pay = payments.get(m[1]);
    if (!pay) return send(res, 404, {});
    if (pay.status !== "authorized") return send(res, 400, { error: { code: "BAD_REQUEST_ERROR" } });
    pay.status = "captured";
    const o = orders.get(pay.order_id);
    if (o) o.status = "paid";
    return send(res, 200, pay);
  }
  m = p.match(/^\/v1\/payments\/([^/]+)\/refund$/);
  if (req.method === "POST" && m) {
    const pay = payments.get(m[1]);
    if (!pay) return send(res, 404, {});
    // Like Razorpay: the same X-Refund-Idempotency key returns the first refund; the same key
    // with a different body is refused; a payment can't be refunded beyond what was paid.
    const key = req.headers["x-refund-idempotency"];
    const seen = key && refundsByKey.get(key);
    if (seen)
      return seen.body === body
        ? send(res, 200, seen.refund)
        : send(res, 400, { error: { code: "BAD_REQUEST_ERROR" } });
    const { amount } = JSON.parse(body);
    if (pay.status !== "captured" || pay.amount_refunded + amount > pay.amount)
      return send(res, 400, { error: { code: "BAD_REQUEST_ERROR" } });
    pay.amount_refunded += amount;
    if (pay.amount_refunded === pay.amount) pay.status = "refunded";
    refundCount.set(pay.id, (refundCount.get(pay.id) ?? 0) + 1);
    const refund = { id: id("rfnd"), status: "processed", amount };
    if (key) refundsByKey.set(key, { body, refund });
    return send(res, 200, refund);
  }
  m = p.match(/^\/v1\/orders\/([^/]+)\/payments$/);
  if (req.method === "GET" && m)
    return send(res, 200, { items: [...payments.values()].filter((x) => x.order_id === m[1]) });
  return send(res, 404, { error: { code: "NOT_FOUND" } });
}).listen(8790, "127.0.0.1");

createServer(async (req, res) => {
  const body = await read(req);
  if (req.method === "POST" && req.url === "/emails") {
    const m = JSON.parse(body);
    const key = req.headers["idempotency-key"];
    // Like Resend: a repeated idempotency key with the same email doesn't send again;
    // the same key with a different email is refused (409).
    const seen = emails.find((e) => e.key === key);
    if (seen)
      return seen.body === body
        ? send(res, 200, { id: seen.id })
        : send(res, 409, { name: "invalid_idempotent_request" });
    const sentId = id("email");
    emails.push({ key, body, id: sentId, ...m, attachments: (m.attachments ?? []).map((a) => a.filename) });
    return send(res, 200, { id: sentId });
  }
  if (req.method === "GET" && req.url === "/all") return send(res, 200, emails);
  if (req.method === "POST" && req.url === "/clear") {
    emails.length = 0;
    return send(res, 200, {});
  }
  return send(res, 404, {});
}).listen(8791, "127.0.0.1");

console.log("test mocks ready: Razorpay 127.0.0.1:8790, Resend 127.0.0.1:8791");
