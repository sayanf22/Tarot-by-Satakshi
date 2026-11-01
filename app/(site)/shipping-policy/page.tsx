import type { Metadata } from "next";
import { Bullets, LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { site } from "@/lib/site";

const description = "Tarot by Satakshi sends no parcels. This page explains how your reading is delivered.";

export const metadata: Metadata = {
  title: "Shipping and delivery policy",
  description,
};

const sections: LegalSection[] = [
  {
    heading: "What we deliver",
    body: (
      <p>
        Tarot by Satakshi offers online readings only. We do not ship any physical item, so there are no
        shipping or delivery charges.
      </p>
    ),
  },
  {
    heading: "How a reading is delivered",
    body: (
      <Bullets>
        <li>Call session: {site.firstName} reaches out to you by phone.</li>
        <li>Text session: {site.firstName} reaches out to you by text.</li>
        <li>Either way, she uses the number you gave when booking.</li>
      </Bullets>
    ),
  },
  {
    heading: "When",
    body: (
      <p>Your reading takes place at the date and time you booked, Monday to Saturday, 11 am to 9 pm IST.</p>
    ),
  },
  {
    heading: "Confirmation",
    body: (
      <p>
        Once your payment goes through, you receive a confirmation email with your booking details. You can
        also check your booking on our booking status page using your booking reference.
      </p>
    ),
  },
  {
    heading: "If we cannot deliver your reading",
    body: <p>You get a full refund, as set out in our refund and cancellation policy.</p>,
  },
];

export default function ShippingPolicyPage() {
  return <LegalPage title="Shipping and delivery policy" description={description} sections={sections} />;
}
