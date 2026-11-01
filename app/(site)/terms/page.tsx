import type { Metadata } from "next";
import { Bullets, LegalPage, TextLink, type LegalSection } from "@/components/legal/legal-page";
import { site } from "@/lib/site";

const description = "The rules for using this website and booking a reading with Tarot by Satakshi.";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description,
};

const sections: LegalSection[] = [
  {
    heading: "Who we are",
    body: (
      <p>
        This website is run by {site.owner} under the name {site.name}. In these terms, “we”, “us” and “our”
        mean {site.name}. “You” means anyone who uses this website or books a reading.
      </p>
    ),
  },
  {
    heading: "What we offer",
    body: (
      <p>
        We offer tarot and astrology readings by call or by text. Sessions take place Monday to Saturday, 11
        am to 9 pm IST, at the time you choose when you book.
      </p>
    ),
  },
  {
    heading: "Booking a reading",
    body: (
      <Bullets>
        <li>Choose a reading, a session type (call or text), a date and a time, then give your details.</li>
        <li>
          When you choose a time, it is held for you for 15 minutes while you pay. If payment is not completed
          in that time, the hold ends and the time becomes available to others.
        </li>
        <li>
          Your booking is confirmed once your payment goes through. You then receive a confirmation email.
        </li>
        <li>
          Please give accurate details. Astrology readings depend on the date, time and place of birth you
          give.
        </li>
      </Bullets>
    ),
  },
  {
    heading: "Prices and payment",
    body: (
      <Bullets>
        <li>
          Prices are shown in Indian rupees (INR) on the Services page and on the booking page, before you
          pay.
        </li>
        <li>Payment is taken in full when you book.</li>
        <li>
          Payments are handled by Razorpay, a payment service provider. You enter your card, UPI or bank
          details on Razorpay’s secure page. These details do not reach this website.
        </li>
      </Bullets>
    ),
  },
  {
    heading: "Sessions",
    body: (
      <p>
        After your booking is confirmed, {site.firstName} reaches out to you on the number you gave when
        booking, for the session type you chose.
      </p>
    ),
  },
  {
    heading: "What a reading is",
    body: (
      <p>
        Tarot and astrology readings help you reflect on your questions. They are not medical, legal,
        financial or other professional advice. Do not rely on a reading alone for decisions about your
        health, money or safety.
      </p>
    ),
  },
  {
    heading: "Refunds and cancellations",
    body: (
      <p>
        Bookings are non-refundable, except as set out in our{" "}
        <TextLink href="/refund-policy">refund and cancellation policy</TextLink>. Please read it before you
        pay.
      </p>
    ),
  },
  {
    heading: "Using this website",
    body: (
      <p>
        Please use this website lawfully. Do not try to break into, overload or misuse it, and do not send
        spam or abusive messages through its forms.
      </p>
    ),
  },
  {
    heading: "Our content",
    body: (
      <p>
        The text, photos and designs on this website belong to {site.firstName} or are used with permission.
        Please do not copy them for commercial use without written permission.
      </p>
    ),
  },
  {
    heading: "Our responsibility",
    body: (
      <p>
        We aim to deliver each reading you book. To the extent the law allows, our total responsibility for a
        booking is limited to the amount you paid for it. Nothing in these terms limits any rights you have
        under Indian law.
      </p>
    ),
  },
  {
    heading: "Changes to these terms",
    body: (
      <p>
        We may update these terms. The date at the top shows the latest version. The version you see when you
        pay applies to that payment.
      </p>
    ),
  },
  {
    heading: "Governing law and complaints",
    body: (
      <p>
        These terms are governed by the laws of India. If you have a complaint, please contact us first. You
        can also contact our grievance officer, whose details are on the Contact page.
      </p>
    ),
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms and conditions" description={description} sections={sections} />;
}
