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
  email: "tarotwithsatakshi@gmail.com",
  hours: {
    days: "Monday to Saturday",
    daysShort: "Mon – Sat",
    time: "11 am – 9 pm",
    timeZone: "IST",
  },
  // Still to be confirmed by Satakshi. Each one appears on the Contact page only once it is set,
  // so no placeholder text reaches the live site. Razorpay needs the address and the grievance
  // officer's title before it approves the site.
  address: null as string | null,
  grievanceDesignation: null as string | null,
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
