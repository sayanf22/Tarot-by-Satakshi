import type { Metadata } from "next";
import { Bullets, LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { site } from "@/lib/site";

const description = "What personal information we collect, why we use it, who sees it, and your choices.";

export const metadata: Metadata = {
  title: "Privacy policy",
  description,
};

const sections: LegalSection[] = [
  {
    heading: "Who we are",
    body: (
      <p>
        {site.owner} runs this website as {site.name} and decides how your personal information is used. You
        can reach us at {site.email} or {site.phone.display}.
      </p>
    ),
  },
  {
    heading: "What we collect",
    body: (
      <Bullets>
        <li>
          Booking details: your name, email address, WhatsApp number, the topic you choose, and any question
          you write.
        </li>
        <li>
          Astrology bookings: your date of birth, your time of birth (or that you do not know it), and your
          place of birth.
        </li>
        <li>Contact messages: your name, email address, phone number if you add one, and your message.</li>
        <li>
          Payment records: the Razorpay order and payment IDs, the amount, the payment status and any refund
          ID. We never receive or store your card or bank details.
        </li>
        <li>
          Email records: the address each email was sent to, what it was about, and whether it was sent.
        </li>
        <li>
          Technical records: a scrambled (hashed) version of your internet address. We use it only to slow
          down repeated form submissions and sign-in attempts.
        </li>
      </Bullets>
    ),
  },
  {
    heading: "Why we use it",
    body: (
      <Bullets>
        <li>To hold your chosen time, take your booking and confirm your reading.</li>
        <li>To take your payment and send any refund.</li>
        <li>To send booking confirmations and reply to your messages.</li>
        <li>To keep bookings fair and to block spam and repeated attempts.</li>
        <li>To meet tax and legal record-keeping rules.</li>
      </Bullets>
    ),
  },
  {
    heading: "Who we share it with",
    body: (
      <>
        <Bullets>
          <li>
            <strong>Razorpay</strong>, to take payments and process refunds.
          </li>
          <li>
            <strong>Resend</strong>, which sends our emails. Your email address and booking details pass
            through it to reach you.
          </li>
          <li>
            <strong>Cloudflare</strong>, which hosts this website and stores its data. Cloudflare Turnstile
            also checks that a person, not a bot, is filling in a form.
          </li>
          <li>
            <strong>{site.firstName}</strong>, who uses your booking and message details to deliver your
            reading.
          </li>
        </Bullets>
        <p>We do not sell your personal information, and we do not use it for advertising.</p>
      </>
    ),
  },
  {
    heading: "Cookies",
    body: (
      <p>
        This website sets no advertising or tracking cookies. Cloudflare Turnstile may set a technical cookie
        to run its check. The only other cookie is the sign-in cookie for the admin area, which only{" "}
        {site.firstName} uses.
      </p>
    ),
  },
  {
    heading: "How long we keep it",
    body: (
      <Bullets>
        <li>Unpaid bookings that expired are deleted two days after they were made.</li>
        <li>Sign-in codes and sign-in attempt records are deleted after one day.</li>
        <li>The email log is kept for 90 days.</li>
        <li>Payment and admin activity records are kept for one year.</li>
        <li>
          Paid bookings are kept for as long as needed to deliver the reading, handle refunds, and meet tax or
          legal record-keeping rules.
        </li>
      </Bullets>
    ),
  },
  {
    heading: "Security",
    body: (
      <p>
        Every page is served over HTTPS. Only {site.firstName} can sign in to the admin area, and she does so
        with a one-time code sent to her email. Card and bank details are handled by Razorpay and never reach
        this website.
      </p>
    ),
  },
  {
    heading: "Your rights",
    body: (
      <>
        <p>Under India’s Digital Personal Data Protection Act, 2023, you can:</p>
        <Bullets>
          <li>ask what personal information we hold about you;</li>
          <li>ask us to correct it;</li>
          <li>ask us to delete it once the purpose it was collected for has ended;</li>
          <li>withdraw your consent. If you do, we may no longer be able to provide your reading.</li>
        </Bullets>
        <p>
          To use these rights, email us. We may ask you to confirm who you are first. If you are not satisfied
          with our answer, contact our grievance officer on the Contact page. You can also complain to the
          Data Protection Board of India.
        </p>
      </>
    ),
  },
  {
    heading: "Changes to this policy",
    body: <p>We may update this policy. The date at the top shows when it last changed.</p>,
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" description={description} sections={sections} />;
}
