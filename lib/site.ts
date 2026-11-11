// Business details. Only facts Satakshi has confirmed belong here.
// Source: agreement (name), WhatsApp answers of 29 October 2026 (the rest).
export const site = {
  name: "Tarot by Satakshi",
  owner: "Satakshi Kapoor",
  firstName: "Satakshi",
  offering: "Tarot & Astrology",
  phone: {
    display: "+91 88821 39419",
    href: "tel:+918882139419",
  },
  /** The Contact form opens a chat with this number (digits only, with country code). Same as the phone. */
  whatsapp: "918882139419",
  email: "tarotwithsatakshi@gmail.com",
  hours: {
    days: "Monday to Saturday",
    daysShort: "Mon – Sat",
    time: "11 am – 9 pm",
    timeZone: "IST",
  },
  // Confirmed by Satakshi on WhatsApp (6 November 2026): address as she wrote it, her title,
  // not GST-registered, run as an individual (no registered business), 12-hour rescheduling,
  // under-18s may book. Add the tower/flat and PIN code here once she sends them.
  address: "Panchsheel Greens 2, Noida, Uttar Pradesh, India" as string | null,
  grievanceDesignation: "Founder" as string | null,
  /** Hours before a session by which a client must ask to move it. */
  rescheduleHours: 12,
} as const;

// Links in the footer's policy row. Every page here is one that Razorpay's website checks
// or consumer law asks for: pricing, the three policies, shipping and the grievance officer.
export const policies = [
  { href: "/pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms and conditions" },
  { href: "/refund-policy", label: "Refund and cancellation" },
  { href: "/shipping-policy", label: "Shipping and delivery" },
  { href: "/contact#grievance", label: "Grievance officer" },
] as const;

// The studio credit in the footer. The link was supplied by the user.
export const studio = { name: "WhyCreatives", url: "https://whycreatives.in" } as const;

export const navigation = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
] as const;
