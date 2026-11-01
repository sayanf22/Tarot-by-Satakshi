// Loads Razorpay Standard Checkout only when the client is about to pay, and opens it.
// The order id and amount come from our Worker; the browser never sets the price.

export type Checkout = {
  key: string;
  orderId: string;
  amount: number;
  currency: "INR";
  description: string;
  prefill: { name: string; email: string; contact: string };
  timeoutSec: number;
};

export type CheckoutSuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCtor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: "payment.failed", cb: (r: { error?: { description?: string } }) => void) => void;
};

const SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<RazorpayCtor> | null = null;

function loadScript(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.addEventListener("load", () =>
      w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Razorpay missing")),
    );
    s.addEventListener("error", () => {
      loading = null;
      reject(new Error("Razorpay didn't load"));
    });
    document.head.appendChild(s);
  });
  return loading;
}

/** Opens Checkout. Resolves with Razorpay's result, or null if the client closed it. */
export async function openCheckout(
  c: Checkout,
  onFailed: (message: string) => void,
): Promise<CheckoutSuccess | null> {
  const Razorpay = await loadScript();
  return new Promise((resolve) => {
    const rzp = new Razorpay({
      key: c.key,
      order_id: c.orderId,
      amount: c.amount,
      currency: c.currency,
      name: "Tarot by Satakshi",
      description: c.description,
      prefill: c.prefill,
      theme: { color: "#c4922c" },
      timeout: Math.max(60, c.timeoutSec),
      retry: { enabled: true, max_count: 3 },
      modal: { confirm_close: true, escape: false, ondismiss: () => resolve(null) },
      handler: (r: CheckoutSuccess) => resolve(r),
    });
    rzp.on("payment.failed", (r) => onFailed(r.error?.description ?? "The payment didn't go through."));
    rzp.open();
  });
}
