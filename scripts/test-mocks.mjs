// Local-only mocks for `npm run test:flows`: Razorpay on 127.0.0.1:8790 and Resend on
// 127.0.0.1:8791. The Worker only accepts these overrides for 127.0.0.1 (RAZORPAY_API_BASE
// and RESEND_API_BASE in .dev.vars), so they can never affect the live site.
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

const orders = new Map();
const payments = new Map();
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
  // Test helper: pay an order, giving a captured payment.
  if (req.method === "POST" && p === "/test/pay") {
    const o = orders.get(JSON.parse(body).orderId);
    if (!o) return send(res, 404, {});
    const pay = {
      id: id("pay"),
      order_id: o.id,
      amount: o.amount,
      currency: "INR",
      status: "captured",
      method: "upi",
    };
    payments.set(pay.id, pay);
    return send(res, 200, pay);
  }
  let m = p.match(/^\/v1\/payments\/([^/]+)$/);
  if (req.method === "GET" && m)
    return payments.has(m[1])
      ? send(res, 200, payments.get(m[1]))
      : send(res, 404, { error: { code: "BAD_REQUEST_ERROR" } });
  m = p.match(/^\/v1\/payments\/([^/]+)\/refund$/);
  if (req.method === "POST" && m) {
    const pay = payments.get(m[1]);
    if (!pay) return send(res, 404, {});
    pay.status = "refunded";
    return send(res, 200, { id: id("rfnd"), status: "processed", amount: JSON.parse(body).amount });
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
    // Like Resend: a repeated idempotency key doesn't send again.
    if (!emails.some((e) => e.key === key))
      emails.push({ key, ...m, attachments: (m.attachments ?? []).map((a) => a.filename) });
    return send(res, 200, { id: id("email") });
  }
  if (req.method === "GET" && req.url === "/all") return send(res, 200, emails);
  if (req.method === "POST" && req.url === "/clear") {
    emails.length = 0;
    return send(res, 200, {});
  }
  return send(res, 404, {});
}).listen(8791, "127.0.0.1");

console.log("test mocks ready: Razorpay 127.0.0.1:8790, Resend 127.0.0.1:8791");
