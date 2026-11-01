import type { Metadata } from "next";
import { Bullets, LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { site } from "@/lib/site";

const description = "When a payment can be refunded, how to ask for one, and how long a refund takes.";

export const metadata: Metadata = {
  title: "Refund and cancellation policy",
  description,
};

const sections: LegalSection[] = [
  {
    heading: "Bookings are non-refundable",
    body: (
      <p>
        Once your payment is confirmed, bookings are non-refundable. This includes a booking you cancel and a
        session you do not attend.
      </p>
    ),
  },
  {
    heading: "When you get the full amount back",
    body: (
      <Bullets>
        <li>We cannot provide your reading, for example because we cancel the session.</li>
        <li>
          Your payment went through after the time you chose had already been booked by someone else. In this
          case the refund is automatic.
        </li>
        <li>Your payment was taken but the booking was not confirmed.</li>
      </Bullets>
    ),
  },
  {
    heading: "When you get part of it back",
    body: <p>If you paid more than once for the same booking, we refund the extra payment.</p>,
  },
  {
    heading: "How to ask for a refund",
    body: (
      <p>
        Email {site.email} or send a message from our Contact page. Include your name, the email address you
        booked with and your booking reference from your confirmation email.
      </p>
    ),
  },
  {
    heading: "How long a refund takes",
    body: (
      <p>
        Once a refund is approved, it goes back to the card, UPI or bank account you paid from. Razorpay
        usually processes it within 5 to 7 working days. Your bank may take longer to show the money.
      </p>
    ),
  },
  {
    heading: "If you disagree with a decision",
    body: (
      <p>
        Contact our grievance officer, whose details are on the Contact page. We acknowledge every complaint
        within 48 hours and resolve it within one month.
      </p>
    ),
  },
];

export default function RefundPolicyPage() {
  return <LegalPage title="Refund and cancellation policy" description={description} sections={sections} />;
}
