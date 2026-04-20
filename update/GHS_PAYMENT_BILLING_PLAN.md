# GHS Payment & Billing Plan

**Status:** Planning only — do not implement until explicitly triggered.
**Phase:** 3 (after Phase 2 credit tracking is live)
**Target market:** Global from day one (not Nigeria-only)
**Author:** Opus architect · Date: 2026-04-19

---

## 1. Credit Conversion (locked)

- **1 credit = $0.001 USD**
- Monthly allowances are deposited at subscription renewal
- Credits do not expire
- Credits are not cashable / not refundable once spent
- Credits are refundable within 14 days if fully unused (edge case)

| Bucket | Credits | USD value |
|--------|---------|-----------|
| Free tier monthly | 100 | $0.10 |
| Starter tier monthly | 500 | $0.50 |
| Pro tier monthly | 2,000 | $2.00 |
| Premium tier monthly | 8,000 | $8.00 |
| Top-up pack A | 10,000 | $10 |
| Top-up pack B | 55,000 | $50 (10% bonus) |
| Top-up pack C | 115,000 | $100 (15% bonus) |
| Top-up pack D | 600,000 | $500 (20% bonus) |

---

## 2. Payment Provider Decision — Paddle (Merchant of Record)

**Why Paddle wins for global day-1:**

Paddle (or Lemon Squeezy) acts as the legal merchant. They collect payment, remit sales tax/VAT, issue invoices, and pay Henry a net amount. Zero tax compliance burden.

| Provider | Fee | Countries | Tax | Verdict |
|----------|-----|-----------|-----|---------|
| Paddle | 5% + $0.50 | 200+ | Auto | **Default pick** |
| Lemon Squeezy | 5% + $0.50 | 200+ | Auto | Acceptable alternative |
| Stripe | 2.9% + $0.30 | 47 (as seller) | Manual | Revisit at $50K MRR |
| Flutterwave | 1.4% | Africa focus | Partial | Secondary for African users |

**Tradeoff accepted:** 2.1% higher fees vs Stripe; in return, Henry never files a tax return in 50 countries.

---

## 3. Payment Methods (supplied by Paddle)

- Visa / Mastercard / American Express / Discover / JCB / Diners
- Apple Pay + Google Pay — **critical** for mobile conversion (25–40% lift)
- PayPal — some countries strongly prefer it
- SEPA Direct Debit (EU)
- iDEAL (Netherlands), Bancontact (Belgium), Trustly (EU bank transfer)
- Alipay + WeChat Pay (China)
- Local cards in India, Brazil, Mexico
- Bank transfer (invoice payment, minimum $500)

---

## 4. Pricing Strategy — Purchasing Power Parity (PPP)

Subscription tier price varies by country group. Credit top-ups stay flat USD.

| Tier | Example countries | Pro monthly | Rationale |
|------|-------------------|-------------|-----------|
| PPP 1 | US, UK, Germany, Australia, Canada, Japan | $49 | Base price |
| PPP 2 | Spain, Italy, Poland, Turkey, Portugal | $35 | 70% of base |
| PPP 3 | Brazil, Mexico, South Africa, Argentina | $24 | 50% |
| PPP 4 | India, Philippines, Indonesia, Vietnam | $19 | 40% |
| PPP 5 | Nigeria, Kenya, Pakistan, Bangladesh, Egypt | $12 | 25% |

Detection:
- Primary: IP geolocation (MaxMind GeoIP or Paddle's built-in)
- Secondary: User-selectable country dropdown on pricing page
- Override: logged-in users keep their billing country (no surprise charges when travelling)

---

## 5. Billing Flows

### 5.1 Subscription flow
1. User clicks a locked tier → Paddle Checkout (hosted) opens
2. Paddle collects card / Apple Pay / PayPal → immediate charge for first month
3. Webhook `subscription_created` hits GHS → tier unlocked → monthly credits deposited
4. 30 days later, Paddle auto-renews → webhook → new credits deposited
5. On failed payment: Paddle retries 3x over 7 days → sends dunning email → cancel + downgrade to Free
6. User clicks Cancel → access continues until period end → auto-downgrade at period end
7. User clicks Upgrade (Pro → Premium) → Paddle prorates → webhook → immediate unlock + pro-rata credit top-up
8. User Downgrades → effective at next renewal (keep spent credits, stop future deposits)

### 5.2 Credit top-up flow
1. User clicks "Buy credits" → pack selector modal → Paddle Checkout
2. One-time charge → webhook `transaction_completed` → credits deposited
3. Receipt emailed automatically by Paddle

### 5.3 Auto-top-up (opt-in)
- User enables toggle: "Auto top up $10 when balance < 200 credits"
- When balance crosses threshold → Paddle auto-charges → credits deposited
- Capped at max 3 auto top-ups per 24 hours (abuse prevention)

### 5.4 Free tier
- Email + Google/Apple OAuth → no card required
- 100 credits/month, auto-renewed on 1st of the calendar month
- Cannot exceed 100 credits — generation blocks with upgrade prompt

---

## 6. Technical Architecture

```
User clicks Generate (any button in GHS)
        ↓
   [Credit Middleware]
        ↓
   Enough credits? ─── No ──→ Show "Top up?" modal with pack options
        │ Yes
        ↓
   [Pre-authorize hold of N credits]
        ↓
   [Call provider — FAL / Pruna / Kling / etc.]
        ↓
   Success? ─── No ──→ Release hold, no charge
        │ Yes
        ↓
   [Commit: deduct N credits, log transaction]
        ↓
   Return output to user
```

### 6.1 Database schema (Prisma additions)

```prisma
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  createdAt         DateTime  @default(now())
  tier              Tier      @default(FREE)
  creditBalance     Int       @default(100)
  billingCountry    String?   // ISO-2 code, e.g. "US"
  paddleCustomerId  String?   @unique
  autoTopUp         Boolean   @default(false)
  autoTopUpPackId   String?
  subscriptions     Subscription[]
  transactions      CreditTransaction[]
}

enum Tier {
  FREE
  STARTER
  PRO
  PREMIUM
}

model Subscription {
  id                    String    @id @default(cuid())
  userId                String
  paddleSubscriptionId  String    @unique
  tier                  Tier
  status                String    // active, paused, canceled, past_due
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean   @default(false)
  user                  User      @relation(fields: [userId], references: [id])
}

model CreditTransaction {
  id              String    @id @default(cuid())
  userId          String
  type            String    // deposit | deduct | refund | bonus
  amount          Int       // credits (positive number)
  reason          String    // "tier_renewal", "topup", "generation:ad_editor:fal_flux_schnell"
  costToHenry     Float?    // USD cost charged to Henry's provider account
  modelUsed       String?   // model registry id
  generationRef   String?   // content item id or asset id
  createdAt       DateTime  @default(now())
  user            User      @relation(fields: [userId], references: [id])
}

model PaddleEvent {
  id              String    @id @default(cuid())
  paddleEventId   String    @unique
  eventType       String    // subscription_created, transaction_completed, etc.
  payload         Json
  processed       Boolean   @default(false)
  createdAt       DateTime  @default(now())
}
```

### 6.2 Required API routes

- `POST /api/checkout/subscription` — creates Paddle checkout link for a tier
- `POST /api/checkout/topup` — creates Paddle checkout for a credit pack
- `POST /api/paddle/webhook` — receives all Paddle events, verifies signature, records + processes
- `GET /api/credits/balance` — returns current user's credit balance + tier
- `POST /api/credits/reserve` — internal (called by generation routes), pre-authorizes credit hold
- `POST /api/credits/commit` — internal, finalizes the deduction
- `POST /api/credits/release` — internal, releases the hold on failure
- `GET /api/billing/history` — user's transaction history
- `POST /api/billing/cancel` — cancel subscription at period end

### 6.3 Webhook security
- Verify `Paddle-Signature` header on every webhook
- Idempotent processing — dedupe via `paddleEventId`
- Process asynchronously with retry — never block the response

---

## 7. Auto-Switch Fallback Ladder (no-credit UX)

Henry's user-facing rule: users never see "no credit" errors from the provider side.

### 7.1 Ladder logic
```
1. Try user's selected model (e.g. Flux Dev)
2. If provider returns 402 (no credit) OR rate limit OR 5xx
   → silently try next model in same tier band
3. If all tier-band models fail → fall back to free local (Ollama/Piper/stock)
4. If that also fails → show user "temporary issue, try again" (never mention billing)
5. If USER has no credits → clean upgrade prompt, never a provider error
```

### 7.2 Circuit breaker
- Per-provider: if 5 consecutive 402s or 5xx in 10 min → mark provider "cold" for 30 min
- Skip cold providers in the ladder
- Admin dashboard shows provider health
- Alert email to Henry when provider goes cold

---

## 8. Legal & Compliance Updates Needed

Add to `update/LEGAL/ghs_legal_framework.md` before launch:

1. **Billing Terms** section
   - Subscription auto-renewal language
   - 14-day cooling-off period (EU legal requirement)
   - Refund policy: credits unused = refundable; credits spent = not refundable
   - Cancellation mechanism clear and accessible
2. **Paddle as Merchant of Record** disclosure
3. **Data Processing Addendum** — Paddle becomes a processor
4. **Tax** — "Prices shown exclude applicable taxes. Final total shown at checkout."
5. **Currency** — "All charges are in USD unless otherwise noted."
6. **Chargebacks** — account suspension if chargeback pattern detected
7. **AI Usage Acknowledgment** — user acknowledges generation costs are non-refundable once consumed

---

## 9. Pre-Launch Operations Checklist

- [ ] Register legal entity (US LLC via Firstbase or UK Ltd via Tide — both remote-friendly)
- [ ] Open bank account (Mercury if US, Starling if UK)
- [ ] Paddle seller application (2-7 day review)
- [ ] Stripe account as backup (1 day setup)
- [ ] Update Legal Framework with billing terms
- [ ] Privacy policy update (add Paddle as processor)
- [ ] Add GDPR data export + delete endpoints
- [ ] Add CCPA "Do Not Sell" link
- [ ] Support email configured (support@giohomestudio.com)
- [ ] Dunning email templates (3-day, 7-day, final)
- [ ] Invoice template (Paddle handles, but brand with GHS logo)
- [ ] Test coupons / promo codes for launch

---

## 10. Implementation Phases

| Phase | Goal | Duration |
|-------|------|----------|
| 1 ✅ | Finance & Growth visibility page — DONE | shipped |
| 2 | Credit DB + deduction middleware (no real billing yet; internal balance only) | 2–3 sessions |
| 3a | Paddle integration + subscription checkout + webhooks | 2 sessions |
| 3b | Credit top-up checkout + receipts | 1 session |
| 3c | PPP pricing detection + country switcher | 1 session |
| 4 | Auto-switch fallback ladder + circuit breaker | 1–2 sessions |
| 5 | Dunning emails + refund flow + PDF invoices | 1 session |
| 6 | Auto-top-up + billing history UI + admin dashboard | 1–2 sessions |

**Do not mix phases.** Each phase ships clean before the next begins.

---

## 11. Success Metrics (once live)

Track in Finance & Growth page:
- MRR (monthly recurring revenue) — total across all tiers
- ARPU (average revenue per user)
- Credit burn rate per user per month
- Conversion rate: Free → paid tier
- Churn rate per tier per month
- Refund rate
- Failed payment rate
- Top-up attach rate (% of users who buy top-ups)
- LTV:CAC ratio (once acquisition cost is known)

**Target by month 3:** 100 paying users, $3K MRR.
**Target by month 12:** 1,000 paying users, $35K MRR, 30% margin post-API-costs.
