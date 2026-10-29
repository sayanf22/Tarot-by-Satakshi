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
} as const;

export const navigation = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
] as const;
