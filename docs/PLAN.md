# Tarot by Satakshi: Website and Booking Platform Plan

**Version 3, 29 October 2026.** Changes from version 2: white-and-gold design direction based on the client's reference; Resend for emails; booking questions modelled on competitor sites; a payment gateway recommendation; the dependencies are now installed. Questions for Satakshi are sent to her on WhatsApp.

Sources: `docs/agreement.txt` (the contract, which governs), `docs/quotation.txt`, and the links in section 14.

---

## 1. What the contract covers

₹20,000 fixed (agreement dated 4 October 2026). **Status:** the agreement is accepted, the project has started, and the ₹10,000 advance has been received. The one-month timeline runs from the advance date.

| Area | In scope |
|---|---|
| Public site, 5 pages | Home, About Satakshi, Services, Book a Session, Contact |
| Admin dashboard | Secure login, service manager, booking calendar, client list, revenue overview |
| Payments | Gateway checkout inside the booking flow; merchant account in the client's name |
| Hosting | Cloudflare Workers, D1, R2 in the client's account, on the client's domain |
| SEO | Basic on-page SEO |
| Footer | "Made by WhyCreatives" credit (the agreement allows a small WhyCreatives credit) |

**Excluded:** blog, WhatsApp reminders, multi-language, subscription plans, extra admin logins, pages beyond the 5. The reference site has Blogs, FAQs, Astrokarma and Siddhhi pages. Here, FAQs become a section on the Services page and the rest are left out.

### Satakshi's answers (WhatsApp, 29 October 2026)

| Topic | Answer | Effect on the build |
|---|---|---|
| Services and plans | She'll write the categories and services on paper and explain them | **Open.** No sample plans: until she adds plans in the admin, the pages show a "readings coming soon" notice |
| Session format | Call and text sessions; she contacts the client once booked | Booking step 1 asks Call or Text. The FAQ says she connects after booking |
| Hours | Monday to Saturday, 11 am – 9 pm | Default availability; shown in the footer, FAQ and Contact page |
| Booking flow | Approved | As in section 6 |
| Booking form | Approved ("perfect") | As in section 6 |
| Refunds | No refunds | Booking review step has a "non-refundable" consent; FAQ states it |
| Payment gateway | Razorpay is fine; she has no account yet | **Razorpay confirmed.** She needs to sign up and complete KYC |
| Photos, logo, reviews | She'll share them | Until then: an illustrated hero, a text wordmark, no testimonials section |
| Contact | Email tarotwithsatakshi@gmail.com (booking alerts and dashboard login); phone 8882139419 | Phone and email on the Contact page and footer |
| After payment | A confirmation email | Client confirmation email, as planned |
| Domain | Wants guidance on buying one | Guidance given in chat; the domain must be in her name |

**Still unanswered:** break between sessions, maximum sessions per day, rescheduling, Instagram link, packages, and session durations and prices.

---

## 2. Stack (confirmed)

**Next.js static export with an API Worker, on the Cloudflare free plan.**

- Next.js builds every page to plain HTML. Cloudflare serves those files as static assets, which are free, unlimited, and don't run the Worker.
- One Worker (Hono) runs `/api/*`: slots, bookings, payments, emails and the admin API, using D1 and R2.
- The free plan's 10 ms CPU limit only applies to API calls. Those mostly wait on D1, which doesn't count as CPU.
- When Satakshi edits a service, the pages rebuild. Bookings always use live prices from D1.
- **Why not OpenNext:** every page view would run Next.js in the Worker. Cloudflare says server rendering typically takes 10–20 ms, which is over the free limit, and OpenNext issue #1381 reports server-rendered pages degrading into 1102 errors. OpenNext also doesn't guarantee Windows support. It's the right choice later if the site moves to Workers Paid and needs server rendering.
- **Why not Vinext:** Cloudflare now recommends it for Next.js and announced 1.0, but its own Next.js guide still calls it beta.
- **What static export gives up:** server rendering, Server Actions, middleware, ISR, built-in `next/image` optimisation, and dynamic routes without `generateStaticParams`. Instead, admin record views use query strings (`/admin/clients?id=…`), security headers come from `public/_headers`, and images are resized at build time (site photos) or in the browser before upload (admin photos).
- Worker size is no longer a constraint: since 4 September 2026, every plan allows 64 MiB.
- If the daily request quota ran out, Cloudflare would return 429 errors on `/api/*` but keep serving the static pages.

---

## 3. Free-plan budget

| Resource | Free limit | Expected use |
|---|---|---|
| Worker requests | 100,000 / day | A few thousand (API only) |
| CPU per request | 10 ms | Measured per endpoint before launch |
| D1 | 5M reads, 100k writes / day, 5 GB | Thousands of rows a day |
| D1 point-in-time restore | 7 days | Plus a weekly export to R2 |
| R2 | 10 GB, 1M writes, 10M reads / month | A few hundred photos |
| Cron triggers | 5 per account | 1 |
| Workers Builds | 3,000 minutes / month | A few minutes per build |
| **Resend** | **100 emails / day, 3,000 / month; 3 domains.** Each recipient counts as one email | About 2 emails per booking (client and Satakshi), plus 1 per enquiry |

At 2 emails per booking, Resend's daily cap covers about 45 bookings and their enquiry emails a day. If a send fails because of the cap, the booking still saves and shows in the admin. The email is retried after the daily reset, and the admin flags any email that hasn't gone out.

**What would force paid plans:** more than 100,000 API calls a day (Cloudflare $5/month), more than 100 emails a day (Resend Pro), or more than 7 days of database restore. None is expected at launch.

---

## 4. Design direction

### Reference (client's screenshots) and what we keep

| Reference element | Our version |
|---|---|
| Logo centred, links split either side | Kept. Left: Home, About, Services. Right: Contact and a gold **Book a Session** button. On mobile: logo left, menu button right, full-screen ivory menu |
| Warm cream background, lots of space | White main background with ivory alternate sections; generous spacing |
| Hero: headline and text left, photo collage right, two buttons | Kept. Photos sit in arch-topped frames (see below). Follower-count stats appear only if Satakshi confirms the numbers |
| "Offerings" carousel, centre card raised, line-art illustrations | Kept, restyled as tarot-card-shaped service cards (below) |
| Testimonial carousel with quote and photo | Kept only if Satakshi supplies real testimonials. Quotes are set upright, not italic |
| Maroon section bands and footer | Replaced. Section headers are ivory with gold rules; the footer is dark warm ink with gold headings |
| Floating WhatsApp button, chatbot | WhatsApp link only if Satakshi wants it and gives a number. No chatbot |

### Colours: white and gold

| Token | Hex | Use | Contrast |
|---|---|---|---|
A warm, saturated gold (hue 40–44°). Tokens 200–600 are the metal itself and carry ink text, never white. Tokens 700–800 are for gold text on light backgrounds.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `white` | #FFFFFF | Main background | – |
| `ivory` | #FDF9F0 | Softest panels, page intros | – |
| `champagne` | #F7EDD3 | Icon tiles, selected states | `gold-800` text on it: 6.2:1 |
| `gold-200` | #F3DC9C | Foil highlight | Ink on it: 12.8:1 |
| `gold-300` | #ECCF85 | Gold text on dark surfaces | 12.8:1 on black, 12.1:1 on night |
| `gold-400` | #E2B955 | Foil body | – |
| `gold-500` | #D4A542 | **Decoration only:** lines, rings, particles, line art | 2.3:1, so never used for text |
| `gold-600` | #C4922C | Foil shadow, selected borders | Ink on it: 6.2:1 (the foil's darkest point) |
| `gold-700` | #8F6514 | Gold text, links, card line art | 5.2:1 on white, 4.9:1 on ivory |
| `gold-800` | #73500E | Deep gold text | 7.3:1 on white |
| `ink` | #1E1A14 | Headings and body text | 17.3:1 on white |
| `ink-muted` | #5A5145 | Secondary text | 7.8:1 on white |
| `line` | #EFE3C9 | Hairline borders | – |
| `night` / `black` | #17140F / #000000 | Dark card faces / footer (pure black, no grain) | `gold-300` 13.8:1 on black |

All contrast values were calculated with the WCAG formula. Two gold utilities in `app/globals.css`:

- **`bg-gold-foil`:** a 115° gradient 200 → 400 → 600 → 400 → 200 at double width. On hover the shine slides across (`hover:bg-[position:100%_50%]`). Used for primary buttons, the active booking step, the selected date and open FAQ toggles, always with ink text, plus `shadow-gold` (a light top edge and a warm glow).
- **`text-gold-foil`:** gradient lettering for large accent words only, `gold-800` → #A87A1C → `gold-700` → `gold-800`. Its lightest stop is 3.8:1 on white, which passes for large text. Falls back to solid `gold-700`.

### Fonts: one pair, no italics or thin weights

- **Headings: EB Garamond** (500 and 600, normal style only), the pairing from the user's wisprflow.ai reference.
- **Body and interface: Figtree** (500 body, 600–700 buttons and labels). Nothing lighter than 500 anywhere.
- Labels and eyebrows: Figtree 700, 12 px, uppercase, letter-spaced, in `gold-700`.
- Prices and times use tabular, lining figures.
- Both fonts are self-hosted with `next/font`, so no requests go to outside font servers.

### Details that make it distinctive (as built, 29 October 2026)

- **Readings deck (home):** the client's "Offerings & Insights" coverflow. The chosen card is raised in the middle and the others wait smaller behind it. Arrows, dots, swipe or a click on a side card move the deck, and it loops (wrapped cards fade in rather than crossing the deck). Hovering or tapping the middle card turns it over.
- **Reading cards:** 7:11, white with a fine gold border. Front: gold line art made from the public-domain Rider–Waite–Smith card (`scripts/make-card-lineart.mjs`, card numerals cropped off), the name, an icon ornament and one line of text. Back: the full colour card, the session type, price (or a Sample tag) and a Book link. The Services page shows the same cards in a grid.
- **No numbers as decoration:** icons replace Roman numerals and "Step 01" labels. Home steps show the icon on the left and the step number in its own circle on the right of the card's top row; the booking steps use icons and a check when done.
- **Hero:** three colour RWS cards on a turning gold mandala, in front of a warm glow, slow gold light rays and thin orbit rings. With a mouse they arrive as a face-down pile, fan out and turn face up in turn; a mouse over the fan opens it wider and lifts the card under it. On phones (no hover) scrolling drives the same sequence and reverses it on the way back up. Tapping turns a single card.
- **Hero on phones:** no badge above the title (removed on every screen size). Two full-width buttons of equal size, stacked, then one three-column card (Call / Phone reading, Text / Chat reading, Mon – Sat / 11 am – 9 pm). From 640 px up the buttons sit side by side and the facts are a light icon row.
- **Text order on load:** the title word by word (each word rises out of its own line), then the line under it word by word, then the buttons and the icon row one at a time. Section headings do the same when scrolled into view, with their description after the title.
- **Word panel (home, under the hero):** a rounded champagne panel with a label, a headline whose words rise in slowly when it scrolls into view (1.2 s per word, 130 ms apart), and an endless strip of words with line-art icons that fades out at both edges. The strip moves with a transform only; the edge fades are two static gradients.
- **Footer:** pure black, with the slow-turning gold mandala in the corner. A large brand line with Book and Ask buttons, then four columns (brand, Explore, Get in touch, Hours) and the legal row. Links draw a gold underline from the left on hover or focus. Two columns on phones.
- **About:** intro with photo, three quick facts, "What she reads" (tarot and astrology, each with its engraved card), "What you can bring to a reading" (the topics from her approved booking form, beside the second photo), call or text sessions, FAQ. Her story, training and experience are added once she shares those facts.
- **Decoration:** gold particles (no stars), gold mandalas, diamond-ended rules, one word strip. Particles are soft round dots drawn with a radial gradient (no box-shadow), half as many on phones. Mandala markers are small circles in the mandala's own colour; the bright gold squares were removed because they read as square particles.
- **Photo frames** take the photo's own shape, so nothing is cropped.
- **Motion:** words rise in, blocks fade up on scroll, the FAQ accordion eases open (grid rows 0fr → 1fr), the mobile menu fades in with staggered links. All of it is turned off for visitors who prefer reduced motion. Only transform and opacity animate.
- **Contact in short form:** the FAQ, mobile menu and footer show Call, Email and Message buttons with icons, not the raw number. The Contact page still lists the number and email in full.
- **Buttons:** pill-shaped. Primary is gold foil with ink text; outline is a `gold-500` border with `gold-800` text that fills champagne on hover.
- **Layout:** 1200 px maximum content width.

**Assets needed from Satakshi:** logo (or approval of the text wordmark), more photos, testimonials, and her real services with prices and durations.

---

## 5. All pages and screens

### Public site (the 5 contract pages)

| Route | Page | Sections |
|---|---|---|
| `/` | Home | Hero; short About teaser; service card carousel; "How booking works" (3 steps); testimonials (if supplied); booking call to action |
| `/about` | About Satakshi | Story, credentials, philosophy (her content), portrait in an arch frame, call to action |
| `/services` | Services | All offerings as tarot cards with duration, price and a Book button; packages (pending question 3); FAQ section |
| `/book` | Book a Session | 4 steps: service → date and time → your details (questions depend on the service) → review and pay |
| `/contact` | Contact | Enquiry form with Turnstile; email, phone and social links from Satakshi |

### Supporting

| Route | Purpose |
|---|---|
| `/book/status` | Payment result: confirmed, processing, failed or expired |
| `/pricing` | Razorpay's "Pricing details" page: every reading with a price, in INR, with its photo (never cropped). Built with the plans saved at build time, then refreshed in the browser from `/api/services`, so price changes in the admin show without a rebuild. Shows a "Prices are being added" note when no plan has a price |
| `/terms`, `/privacy`, `/refund-policy`, `/shipping-policy` | Legal pages for Razorpay approval, in one text layout (`components/legal/legal-page.tsx`). Drafted from Razorpay's list and the Consumer Protection (E-Commerce) Rules, 2020; Satakshi confirms the wording. Linked from the footer and the checkout checkbox |
| `404`, `sitemap.xml`, `robots.txt`, share image, favicon | System files |

### Admin

| Route | Screen |
|---|---|
| Cloudflare Access | Login with a one-time code sent to Satakshi's email |
| `/admin` | Overview: today's and upcoming sessions, items that need attention, this month's revenue, email delivery problems |
| `/admin/bookings` | Calendar (month, week, day) and a list. The detail panel shows all of the client's answers, the payment reference and status, and actions to mark a session completed or cancelled |
| `/admin/availability` | Weekly hours, days off, buffer, minimum notice, booking window |
| `/admin/services` | Add or edit a service: price, duration, active switch, order, image, and which questions the booking form asks |
| `/admin/clients` | Search; client detail with booking history |
| `/admin/revenue` | Totals by month and by service |
| `/admin/enquiries` | Contact form messages (also emailed to Satakshi) |

---

## 6. Booking flow and notifications

### Proposed flow (for Satakshi to approve, question 1 in the client list)

1. The client picks a service, a date and a free time. Times are shown in IST.
2. The client answers the booking questions for that service and agrees to the terms.
3. The client pays through the gateway checkout. The slot is held for 15 minutes.
4. The server confirms the payment from a verified gateway webhook, never from the browser alone.
5. **The client gets a confirmation email:** service, date and time, duration, booking reference, amount paid, how the session will happen, and contact details for changes, with a calendar file (.ics) attached.
6. **Satakshi gets a "New booking" email** with every answer the client gave and a button that opens the booking in the admin.
7. Satakshi signs in to the admin dashboard to see everything: calendar, client details, answers, payment and revenue.
8. Optional: an email reminder to the client 24 hours before the session (question 9).

Contact form messages go to Satakshi by email and are saved in the admin.

### Booking questions (based on competitor booking forms)

Competitors' astrology bookings ask for **date, time and place of birth**, plus the main question. Some ask clients to write "unknown" if they don't know their birth time. Tarot intake forms ask for the **area of focus** and the client's **question**, with "general reading" as an option. Our form follows that pattern. Each service gets a **question set**, chosen in the admin:

| Question set | Fields |
|---|---|
| **All services** | Full name; email; phone with country code (WhatsApp); area of focus (Love and relationships, Career, Money and business, Family, Health and wellbeing, Spiritual growth, General reading); your question (optional, up to 1,000 characters); terms and privacy consent |
| **Tarot** | Nothing extra. Optional: "Have you had a tarot reading before?" |
| **Astrology** | Date of birth; time of birth with an "I don't know my exact time" option, which then asks for an approximate time; place of birth (city, state, country) |
| **Couple or compatibility** (only if offered) | Astrology fields for both people |

Only these fields are collected. Birth details are visible only in the admin and are deleted on request.

### Emails with Resend

- The Worker sends emails through Resend's API after the payment is confirmed, in the background, so the webhook replies at once.
- Templates are plain HTML strings with every client value escaped, styled to match the site in white and gold. React-based email rendering isn't used, because it would cost Worker CPU.
- Sent from a subdomain (for example `bookings@mail.<domain>`), as Resend recommends. Replies go to Satakshi's own email.
- DNS: Resend's SPF, DKIM and DMARC records are added in Cloudflare (Resend supports automatic setup for Cloudflare).
- Each email is recorded in `email_log`, sent once, and retried if it fails.

---

## 7. Payment gateway

**Decision: Razorpay.** Satakshi confirmed it on WhatsApp (29 October 2026), which is the written confirmation of the change from Cashfree (agreement section 10). She has no Razorpay account yet, so sign-up and KYC in her name are on the critical path for phase 7.

| | Cashfree | Razorpay |
|---|---|---|
| In the signed agreement | Yes, no scope change | Needs her written agreement (agreement section 10) |
| Standard fee (third-party reports; confirm on each official pricing page) | 1.95% | 2% |
| GST | 18% on the fee | 18% on the fee |
| New-merchant offer (third-party report, to be checked) | 0% MDR up to ₹20 lakh/month until 31 March 2027 | 0% platform fee for 90 days, up to ₹5 lakh |
| Technical fit | Equal: hosted checkout, signed webhooks, server-side status check | Equal |

### One interface for either gateway

A setting (`PAYMENT_GATEWAY=cashfree` or `razorpay`) picks the adapter, and nothing else in the system changes.

```ts
interface PaymentGateway {
  createOrder(booking): Promise<{ gatewayOrderId: string; checkout: CheckoutPayload }>;
  confirmFromClient(params): Promise<PaymentResult>;
  parseWebhook(req: Request, rawBody: string): Promise<WebhookEvent | null>; // null = bad signature
  fetchStatus(gatewayOrderId: string): Promise<PaymentResult>;
}
```

| Step | Cashfree | Razorpay |
|---|---|---|
| Create order (server only) | `POST /pg/orders` with `x-client-id`, `x-client-secret`, `x-api-version`; returns `payment_session_id` | Orders API with key ID and secret, amount in paise; returns `order_id` |
| Checkout (browser) | Cashfree JS SDK, `cashfree.checkout({ paymentSessionId })` | Checkout.js with the public key ID and `order_id` |
| Return | Redirect to `/book/status`; the server fetches the order status | The handler receives `razorpay_payment_id`, `razorpay_order_id` and `razorpay_signature`. The server checks the HMAC-SHA256 of `order_id + "|" + payment_id` with the key secret, then fetches the status |
| Webhook | `x-webhook-signature` and `x-webhook-timestamp`, HMAC-SHA256 over the raw payload | `X-Razorpay-Signature`, HMAC-SHA256 of the raw body with the webhook secret; duplicates skipped by `x-razorpay-event-id` |
| Confirm only when | Order status is paid | Payment is captured and the order is paid (automatic capture on) |
| Before go-live | Domain whitelisting; website review | KYC and website review |

For both gateways: the price comes from D1 and the amount paid is checked; each event is processed once; card and UPI details never reach our server; keys are Wrangler secrets, with sandbox and live keys kept separate; only the chosen gateway's script is allowed in the CSP.

**Timing:** KYC in Satakshi's name should start in week 1. Razorpay is built first. Cashfree stays available as a second adapter.

---

## 8. Architecture

```
Browser ─ pages (static, free) ─► Cloudflare static assets
        ─ /api/* ───────────────► Worker (Hono)
                                     ├─ D1 (data), R2 (photos)
                                     ├─ Gateway API (orders, status) ◄── webhooks
                                     └─ Resend API (emails)
Cloudflare Access ─ guards /admin* and /api/admin*
Workers Builds ─ builds on git push and on service edits
```

**Project layout:** `app/` (pages), `components/`, `lib/` (shared types, Zod schemas, time and price helpers), `worker/` (routes, booking, payments, email, auth), `migrations/`, `scripts/` (build steps), `public/_headers`, `wrangler.jsonc`.

---

## 9. Data model (D1, draft)

`services` (now including `question_set`), `availability_rules`, `availability_overrides`, `settings`, `clients`, `bookings` (now including `answers_json`, the validated intake answers), `booking_slot_units`, `payments`, `webhook_events`, `enquiries`, `email_log` (type, recipient, status, attempts, last_error), `rate_limits`.

Money is stored in paise. Each booking keeps a copy of the service as it was at booking time.

---

## 10. Security

**Admin sign-in (changed 2 November 2026): email code, no password.** Cloudflare Access needs a payment card, so the Worker sends its own one-time codes through Resend.
- Only addresses in `ADMIN_EMAILS` (wrangler.jsonc) can sign in; any other address gets the same reply and no email. `ADMIN_EMAILS` is re-checked on every request, so removing an address ends its sessions.
- Code: 6 digits, valid 10 minutes, works once, 5 tries. Only an HMAC of it (`RATE_LIMIT_SALT`) is stored, in `admin_login_codes`. A new code cancels the last one; at most 5 codes an hour per address.
- Lockout: 10 failures in 15 minutes per IP, or 30 from anywhere (`LOGS.login_attempts`), plus the `RL_LOGIN` rate limiter. Preview URLs are off (`preview_urls: false`), and plain-HTTP API/image requests redirect to HTTPS.
- Needs `RESEND_API_KEY` (secret), `EMAIL_FROM` (var) and `RATE_LIMIT_SALT`; without them `/admin` says sign-in isn't set up.
- Session: random 32-byte token in a `__Host-tbs_admin` cookie (HttpOnly, Secure, SameSite=Strict, 3 days); only its SHA-256 is stored in `admin_sessions`. Sign out, or sign out on all devices.
- Every admin change also needs a same-origin request, and is written to `LOGS.audit_log`.
- Preview URLs are off. The `workers.dev` address stays on until the custom domain is connected; it runs the same checks.

**Inputs and requests**
- Zod validation on every input, with the same schemas in the browser and the Worker. Only `prepare().bind()` queries.
- Requests that change data must be JSON with a matching `Origin` header.
- Turnstile and per-IP limits (counted in D1) on the booking and contact forms.
- Booking references are random. Errors are generic. Logs never contain secrets, payment payloads or client contact details.

**Payments:** see section 7.

**Email (Resend)**
- The API key is a Wrangler secret with sending-only permission for the one domain.
- Line breaks are removed from names and subjects (no email header injection), and client values are HTML-escaped in templates.
- Recipient addresses are validated with Zod.

**Browser hardening (`public/_headers`)**
- Content-Security-Policy with `default-src 'self'`, allowing only the chosen gateway's script, Turnstile and `media.<domain>`.
- A build script hashes each page's inline Next.js scripts and writes them into that page's CSP, so `'unsafe-inline'` isn't needed. That fits within the `_headers` limits of 100 rules and 2,000 characters per line. If it can't hold, the fallback is `'unsafe-inline'` for scripts only.
- HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`.
- Fonts are self-hosted.

**Uploads (D1, not R2):** admin only. The browser (`lib/image-compress.ts`) re-encodes each photo as WebP at quality 0.9 (visually lossless; PNG graphics also tried lossless), longest side up to 2,400 px with step-down resizing, camera rotation applied and GPS/camera metadata removed, never cropped, so it fits one D1 row (2 MB limit). The Worker checks the real type from the file's first bytes (JPEG, PNG, WebP; SVG refused), hashes the bytes (SHA-256, `media.content_hash UNIQUE`), so an image already saved is reused instead of stored twice, then stores only the key and bytes in the least-full of `MEDIA_1..8` (each capped at 480 MB, about 3.75 GB in total). Type, size and hash are kept once, in the core `media` index. Deleting a plan deletes the plan and its image (bytes, index row, edge cache) unless another plan uses the same image; past bookings keep their own copy of the plan (`service_snapshot`, `service_id` set to NULL). Served from `/media/<key>` with `nosniff`, a sandbox CSP and long caching.

**Databases (free plan: 10 × 500 MB, 5 GB total), all 10 used:** `DB` (plans, hours, bookings, payments, messages, sessions, sign-in codes), `LOGS` (email, audit, payment events, sign-in attempts), `MEDIA_1..8` (image bytes only). Pruned hourly by the cron: unpaid lapsed holds after 2 days, sign-in codes and attempts after 1 day, `email_log` after 90 days, `payment_events` and `audit_log` after a year. Migrations live in `migrations/core`, `migrations/logs`, `migrations/media`. D1 Time Travel gives 7 days of point-in-time restore on the free plan.

**Payments (Razorpay Standard Checkout):** the amount always comes from D1, never the browser. `POST /api/bookings` holds the time (15 minutes) and creates the order; Checkout returns `payment_id`, `order_id`, `signature`; `POST /api/payments/verify` checks HMAC-SHA256(`order_id|payment_id`) with the key secret in constant time, using our own order id, then fetches the payment from Razorpay and confirms only if it is captured for exactly our order, amount and currency (authorized payments are captured). `POST /api/payments/webhook` verifies `X-Razorpay-Signature` over the raw body and settles the same way, so a closed browser still confirms. Settling is idempotent. A late payment re-claims the time if it's still free; if another client took it, the full amount is refunded automatically. A cron every 10 minutes releases lapsed holds, asks Razorpay about recent unpaid orders (missed webhooks), and prunes old data. The admin can refund a paid booking (locked first, so it can't refund twice).

**Spam:** Cloudflare Turnstile on the contact form and on Pay (widget "Tarot by Satakshi forms"; secret `TURNSTILE_SECRET`; hostname checked). Add the custom domain to the widget when it exists.

**Content-Security-Policy:** `scripts/csp.mjs` hashes each page's inline scripts at build time and writes a per-page policy (no `'unsafe-inline'` for scripts; outside scripts only from `*.razorpay.com` and `challenges.cloudflare.com`). API responses send `default-src 'none'`.

**Accounts:** two-factor login on Cloudflare, the gateway and Resend. Deploys use a scoped Cloudflare API token.

**Personal data:** only the needed fields are collected, with consent and a privacy policy link (India's DPDP Act applies). Birth details are visible only in the admin. Migrations are backed up first; point-in-time restore covers 7 days, plus a weekly export to R2.

**Tests before launch:** admin API without a token or with a forged one; forged and replayed webhooks; payments with the wrong amount; two clients booking the same slot at once; bad input on every form; email header injection; CSP with no console violations; CPU time per endpoint.

---

## 11. Installed dependencies (done 29 October 2026)

`npm audit`: **0 vulnerabilities.** A clean reinstall from `package.json` and `package-lock.json` works.

### Runtime

| Package | Version | Purpose |
|---|---|---|
| next | 16.4.3 | Framework (static export) |
| react, react-dom | 19.3.1 | UI |
| hono | 4.13.14 | API router in the Worker |
| zod | 4.6.7 | Validation shared by browser and Worker |
| resend | 6.35.0 | Email API client |
| jose | 6.2.13 | Verifying Cloudflare Access tokens |
| date-fns, @date-fns/tz | 4.4.0, 1.5.0 | Dates and the IST time zone |
| react-hook-form, @hookform/resolvers | 7.91.0, 6.0.2 | Booking, contact and admin forms with Zod |
| react-day-picker | 10.0.2 | Accessible date picker for booking and admin |
| embla-carousel-react | 8.6.0 | Service and testimonial carousels |
| lucide-react | 1.63.0 | Interface icons |
| clsx, tailwind-merge | 2.1.1, 3.7.0 | Class name helpers |
| @marsidev/react-turnstile | 1.6.3 | Turnstile widget |

### Development

| Package | Version | Purpose |
|---|---|---|
| typescript | 7.0.2 | Type checking (Next.js 16.3+ supports TypeScript 7) |
| @types/react, @types/react-dom, @types/node | 19.3, 19.3, 22.x | Types |
| tailwindcss, @tailwindcss/postcss, postcss | 4.3.3 | Styling |
| oxlint | 1.90.0 | Linting, with built-in Next.js, React, jsx-a11y and TypeScript rules |
| prettier, prettier-plugin-tailwindcss | 3.9.10, 0.8.1 | Formatting |
| wrangler | 4.154.0 | Local Worker, D1, deploys |
| vitest, @cloudflare/vitest-pool-workers | 4.1.12, 0.23.0 | Tests running inside the Workers runtime with D1 |
| @playwright/test | 1.64.1 | Screenshots and booking-flow tests (Chromium downloaded) |
| sharp | 0.35.5 | Resizing images at build time |

### Notes

- **Oxlint instead of ESLint.** `typescript-eslint`, which `eslint-config-next` depends on, supports only TypeScript below 6.1. TypeScript 7 doesn't yet have the compiler API it needs.
- **npm 11 for installs.** The npm 10.9.2 bundled with Node 22 crashes on this project's peer dependencies with `Cannot read properties of null (reading 'edgesOut')`. Installs ran with `npx npm@11 install`; use the same command, or upgrade npm.
- **`overrides`** in `package.json`: the Workers test pool pins older nested `sharp`, `undici` and `zod` versions with high-severity advisories. They're overridden to the patched versions (sharp 0.35.5, undici 7.30.1, zod 4.6.7). These are development-only tools. Remove the overrides once Cloudflare publishes a pool update.
- **`allowScripts`:** the install scripts for esbuild and workerd, needed by Wrangler, are approved by exact version.
- **Next.js 16 export bug on Windows** ([vercel/next.js#85374](https://github.com/vercel/next.js/issues/85374)): on Windows the export writes segment prefetch files as `about/__next.about/__PAGE__.txt` instead of `about/__next.about.__PAGE__.txt`, so every link prefetch 404s. `npm run build` runs `scripts/fix-export-segments.mjs` afterwards to rename them; on Linux (Workers Builds) the script finds nothing to fix. Remove it once Next.js ships the fix.
- **Deploy build:** `wrangler.jsonc` has a `build` step (`scripts/cf-build.mjs`) that runs `npm run build` before `wrangler deploy`, so Workers Builds creates `./out` even with no build command set in the dashboard. The first deploy failed without it ("assets.directory … does not exist"). The script skips the build for `wrangler dev` and `wrangler types`. Leave the dashboard build command empty, or the site is built twice.
- **Commands:** `npm run build` (static export plus the fix), `npm run preview` (build, then serve everything as one Worker on port 8787), `npm run screenshots` (Playwright screenshots, console errors and overflow at 375/768/1280 px).
- **Deliberately not installed:** ESLint (see above); React Email (CPU cost in the Worker); an animation library (CSS is enough); a chart library (simple CSS bars for revenue); OpenNext; `@cloudflare/workers-types` (types come from `wrangler types`).

---

## 12. Build phases

| Phase | Status | Contents |
|---|---|---|
| 0a Dependencies | **Done** | `package.json`, lockfile, `.gitignore`, all packages, Chromium |
| 0b Project setup | **Done** | Configs (Next, TypeScript, Tailwind, Oxlint, Prettier, Wrangler), Hono Worker with `/api/health`, `_headers`. D1 binding moves to phase 4 |
| 1 Design system | **Done** | Tokens in `app/globals.css`, Marcellus + Manrope, buttons, ornaments, line-art icons, tarot cards |
| 2b Design refresh | **Done** | Playfair Display headings (as on the reference site, upright only), white background, rounded panels and cards, black footer, word-by-word heading animation, scroll reveals, Lenis smooth scrolling, longer home page (topics, call or text, what to have ready, four steps, FAQ) |
| 2d White-and-gold refresh | **Done** | EB Garamond headings and Figtree body (the reference pairing, Medium and up, no italics); gold particles instead of stars; one word ribbon; hero card on a turning mandala; readings as a one-at-a-time slider with real Rider–Waite–Smith cards (1909, public domain, from Wikimedia Commons via `scripts/fetch-tarot-cards.mjs`; nude figures excluded); cards turn on hover or tap |
| 2e Polished gold | **Done** | Greyish olive gold replaced with a warm gold scale (200–800); foil buttons, ribbon, steps, date picker and FAQ toggles with ink text; foil lettering on accent words; card line art regenerated in `gold-700`; favicon updated |
| 2f Word panel and footer | **Done** | Gold ribbon replaced by a rounded champagne panel (label, slow word-by-word headline, icon word strip with edge fades); footer pure black with the turning mandala; deploy fixed with a Wrangler build step |
| 2c Home redesign | **Done** | Hero of four tarot cards dealt from the centre that turn face up (tap to turn again); crossing word ribbons; "Meet Satakshi" with her two photos and a turning badge; readings as a fanned deck of flip cards; topics as a line of words; drawn four-step timeline; one black session panel; open FAQ list. Photos: originals in `image/` (not deployed), web versions made by `node scripts/process-photos.mjs` (watermark strip cropped, metadata removed, 480/800/1200 px WebP) |
| 2 Public pages (sample data) | **Done** | Home, About, Services (with FAQ), Book (4 steps, Pay disabled), `/book/status`, Contact, 404. Legal pages wait for policy text; sitemap and share image wait for the domain |
| 3 Admin UI | **Done** | `/admin`: sign-in (passphrase + authenticator code), Overview, Bookings (detail, note, done, cancel, refund), Plans (add, edit, archive, restore, delete if never booked, Publish to website via a Workers Builds deploy hook), Hours (weekly, days off, booking rules), Messages, Images |
| 7 Payments | **Built and tested against a mock** | Razorpay adapter, verify, webhook, reconcile cron, auto refund for taken times. Switched off until `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` are set (webhook URL `/api/payments/webhook`, events `payment.captured`, `payment.authorized`, `order.paid`, `payment.failed`, `refund.processed`) |
| 4 Backend foundation | **Done** (CSP still to do) | D1 `tarot-by-satakshi-db` (APAC) with `migrations/0001_init.sql` applied locally and remotely; Hono routes in `worker/routes/`; shared Zod schemas; same-origin check, JSON size limit and D1 rate limits (salted IP hash, secret `RATE_LIMIT_SALT`); `/api/contact` saves to `enquiries` and emails via Resend once configured |
| 5 Booking engine | **Done** (no payment yet) | `/api/slots` from weekly hours, overrides, notice and window; `/api/bookings` creates a 15-minute hold; 15-minute `booking_slot_units` primary key blocks double booking (tested with two simultaneous requests: 201 and 409); `/api/bookings/:ref` status. The booking page now shows real free times |
| 6 Admin API | **Done** | `/api/admin/*` behind the session check (see section 10). Images in D1 media databases instead of R2 |
| 8 Emails and content | | Resend templates, DNS, real copy and photos |
| 9 Security and free-plan check | | Full test pass, CPU per endpoint |
| 10 Launch | | Domain, live keys, onboarding |

---

## 13. Decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Stack | Next.js static export + API Worker, free plan (confirmed) |
| 2 | Footer credit | "Made by WhyCreatives" (your choice to leave to me) |
| 3 | Packages | Ask Satakshi |
| 4 | Booking questions | Based on competitors (section 6) |
| 5 | Session format | Ask Satakshi. Satakshi gets a booking alert email with all answers |
| – | Emails | Resend |
| – | Colours | White and gold (section 4) |
| – | Payment gateway | Suggest Razorpay; Satakshi confirms in writing |
| – | Site copy | WhyCreatives writes it. Satakshi doesn't send written text; we use only the facts she confirms |

Open questions for Satakshi are sent to her on WhatsApp.

---

## 14. Sources (checked 29 October 2026)

- Resend quotas: https://resend.com/docs/knowledge-base/resend-sending-limits
- Resend pricing and domains: https://resend.com/docs/knowledge-base/what-is-resend-pricing
- Resend with Cloudflare Workers: https://www.resend.com/docs/send-with-cloudflare-workers
- Resend domain setup on Cloudflare: https://resend.com/docs/knowledge-base/cloudflare
- Competitor booking forms: https://vedgyanam.com/, https://www.rahasyavedicastrology.com/book-consultation/, https://astrologyayurveda.com/consultations/vedic-astrology-reading/, https://tidycal.com/for/astrologers-and-tarot-readers
- Gateway fees (third-party, to be confirmed officially): https://www.analyticsinsight.net/amp/story/finance/razorpay-vs-payu-vs-cashfree-which-is-the-best-payment-gateway-for-2026, https://www.itechguides.com/freecharge-vs-razorpay-vs-cashfree-which-payment-aggregator-is-best-for-small-businesses-in-2026/
- Next.js 16.3 with TypeScript 7: https://www.achromatic.dev/blog/nextjs-16-3-typescript-7-upgrade
- Oxlint plugins: https://oxc.rs/docs/guide/usage/linter/plugins.html
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- 64 MiB Worker size on all plans: https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/
- Static assets billing: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- Static site routing: https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/
- `_headers`: https://developers.cloudflare.com/workers/static-assets/headers/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- D1 Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Workers Builds limits: https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
- Cloudflare's Next.js guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Vinext 1.0: https://blog.cloudflare.com/vinext-nextjs-on-vite/
- OpenNext: https://opennext.js.org/cloudflare and issue https://github.com/opennextjs/opennextjs-cloudflare/issues/1381
- Next.js static exports: https://nextjs.org/docs/app/guides/static-exports
- Next.js CSP: https://nextjs.org/docs/app/guides/content-security-policy
- Access token validation: https://developers.cloudflare.com/access/setting-up-access/validate-jwt-tokens/
- Cashfree: https://www.cashfree.com/docs/payments/online/web/redirect, https://www.cashfree.com/docs/payments/online/webhooks/signature-verification, https://www.cashfree.com/docs/payments/online/go-live/whitelist
- Razorpay: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/, https://razorpay.com/docs/webhooks/validate-test/, https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/best-practices/

### Plans and photos added on 2 November 2026

Four plans from Satakshi's earlier booking page (names, prices and lengths from the screenshots the user sent), all editable in the admin under Plans:

| Plan | Price | Length | Session | Photo |
|---|---|---|---|---|
| Tarot – 1 question | ₹222 | 10 min | Call or text | Three-card spread with candles |
| Tarot reading | ₹890 | 10 min | Call or text | Three-card spread |
| Tarot – 10 questions | ₹1,888 | 10 min | Call or text | Celtic cross spread |
| Consultation call | ₹777 | 15 min | Call | Three-card spread (same image, stored once) |

Photos, all CC0 (no attribution required) by Nosferattus on Wikimedia Commons, re-encoded as WebP (longest side 1,000 px, quality 75, metadata removed, not cropped):
- `File:Tarot cards - 3 card spread.jpg`: 2.27 MB → 102 KB, in MEDIA_1
- `File:Tarot cards - 3 card spread with candles.jpg`: 1.86 MB → 75 KB, in MEDIA_2
- `File:Tarot cards - Celtic cross spread.jpg`: 2.71 MB → 126 KB, in MEDIA_3

Loaded with the D1 import API (admin sign-in needs Resend, which isn't set up yet). Note for future bulk loads: `data || X'…'` turns a BLOB into TEXT in SQLite, so chunked image SQL must end with `CAST(data AS BLOB)`. `/media/<key>` keeps an edge copy for a day, so a wrong first response needs a new key, not just a fix in place.

Not added yet, waiting on a decision: the spell, ritual, healing, package and recorded-content items from the old page (see the chat of 2 November 2026).
