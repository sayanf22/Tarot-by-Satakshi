import { site } from "@/lib/site";

// Every answer here comes from Satakshi's WhatsApp replies (29 October 2026).
// Add rescheduling once she confirms her rule.
export const faq = [
  {
    q: "How do sessions happen?",
    a: `Choose a call or a text session when you book. ${site.firstName} reaches out to you once your booking is confirmed.`,
  },
  {
    q: "When are sessions available?",
    a: `${site.hours.days}, ${site.hours.time} (${site.hours.timeZone}).`,
  },
  {
    q: "What do I share when booking?",
    a: "Your name, email, WhatsApp number, the topic and your question. For astrology readings, also your date, time and place of birth.",
  },
  {
    q: "How do I pay?",
    a: "Online, as the last step of booking. You get a confirmation email once the payment goes through.",
  },
  {
    q: "Can I get a refund?",
    a: "Bookings are non-refundable, except in the cases listed in our refund and cancellation policy.",
  },
] as const;
