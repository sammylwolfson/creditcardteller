# Credit Card Teller

A local-first Expo app that answers one question fast — **which card do I use here?** — and shows its work. Optional geofence nudges remind you at stores you pin.

Nothing leaves your phone. There is no backend, no account and no bank connection.

## Quick start

```bash
npm install
npm run check    # typecheck + 49 unit tests
npm start        # Expo dev server
```

Geofencing needs a development build (`npm run ios` / `npm run android`), not Expo Go, because background location requires the native permissions declared in `app.json`.

## How a recommendation is made

Every card is scored down to a single **cash-equivalent effective rate**, so cards that earn in different currencies can be compared honestly. The pipeline, in order:

1. **Acceptance.** If the merchant restricts networks (Costco only takes Visa), non-matching cards are marked ineligible with the reason, not silently ranked last.
2. **Rule selection.** Among the card's rules that apply to this merchant, category, channel and payment method, the one with the **highest post-cap rate** wins. Specificity is only a tiebreaker.
3. **Caps.** A capped bonus category checks the local spend ledger. Exhausted → the post-cap rate. Partially exhausted with a known amount → the rate is blended across both tiers (`$200 left of a $6,000 cap on a $1,000 purchase` → 2.0%, not 6%).
4. **Point valuation.** Points and miles are multiplied by the card's `rewardUnitValue`, which defaults to the 1¢ cash-redemption floor so the app never overstates a card.
5. **Foreign transaction fee.** Subtracted from the effective rate. A 3% earn on a card with a 3% fee correctly shows as a wash.

The result carries a `factors` list — one entry per step above, with the rate delta it contributed — plus `caveats` for things the engine cannot model (annual fees, issuer category exclusions, Costco's annual certificate). That list is what the "Why" section renders.

Ties are reported as ties. Overrides are honoured but the engine still says what it would have picked, and an override for a card the merchant rejects is skipped with an explanation.

## Merchant matching

Typed text, card-statement descriptors and checkout URLs all go through the same matcher, which returns a **confidence level** and the runners-up:

| Input | Result |
| --- | --- |
| `SQ *TRADER JOES #204` | Trader Joe's — high (processor prefix and store number stripped) |
| `https://www.costco.com/cart` | Costco.com — high (domain) |
| `pavillions` | Pavilions — high (fuzzy) |
| `blue bottl` (two similar stores) | ambiguous — both offered, user confirms |
| `zzzqqx bodega` | no match — pick a category and still get a ranking |

Anything below **high** asks for confirmation before you act on the rate. Confirming a spelling saves it as a learned alias, so the same descriptor is a one-tap match next time. An unknown store falls back to an ad-hoc merchant in a category you pick, so the flow never dead-ends.

## Geofence nudges

Off by default and limited to favorites you have pinned.

1. Favorite a store on the **Places** tab.
2. Stand in the store once and tap **Pin current location**. Seeded merchants ship without coordinates on purpose — a Costco in one city is not a Costco in another.
3. Turn on **Geofence nudges** and grant location (Always) plus notifications.

When you arrive, iOS wakes the app, which rebuilds cards, settings and throttle state from storage, runs the same engine the screen runs, and sends a notification naming the actual card and rate (`Use Citi Double Cash — 2%`). Tapping it opens that store's recommendation.

A nudge is suppressed unless it clears every gate: feature enabled, a real winner, not a tie, wins by at least your threshold, outside quiet hours, past the global cooldown (45m default) and past the per-store cooldown (4h default). Throttle state is **persisted**, so a cold background launch cannot reset it. **Test nudge** on any pinned store dry-runs the exact background path without driving anywhere.

## Card data

Seeded cards: Costco Anywhere Visa, Apple Card, Chase Freedom Unlimited, Citi Double Cash, Amex Blue Cash Preferred. Seeded merchants: 50, hand-curated (no paid API).

Each records `termsAsOf` and a `sourceNote`. **Issuers change reward terms — verify against your issuer before relying on a recommendation.** Rates are edited in `src/data/cards.ts`; the in-app editor adds flat-rate cards and adjusts point valuations.

## Project layout

```
App.tsx                       screens, state and persistence wiring
src/types/domain.ts           domain model
src/data/cards.ts             seeded card terms
src/data/merchants.ts         seeded merchants, aliases, domains, defaults
src/engine/rewards.ts         scoring, caps, explanation
src/engine/merchantMatch.ts   normalisation, fuzzy matching, confidence
src/engine/spend.ts           cap ledger
src/services/geofence.ts      regions, permissions, background task
src/services/nudgePolicy.ts   anti-spam gating (pure, testable)
src/services/schema.ts        validators for stored data
src/services/storage.ts       versioned AsyncStorage access
src/ui/                       theme and shared components
tests/                        unit tests + a small zero-dependency runner
```

## Testing

`npm test` compiles the pure modules with `tsc` and runs them on node — no mobile test runner needed. 56 tests cover rule selection, network acceptance, cap exhaustion and blending, foreign fees, point valuation, ties, overrides, text normalisation, match confidence, nudge gating, wallet scoping, catalogue integrity and stored-data validation.

## Your wallet vs. the catalogue

The app ships with a **catalogue** of known card definitions. Your **wallet** is
the subset you actually carry, chosen on the Wallet tab. Only wallet cards are
ever ranked — recommending a card you do not hold is worse than no
recommendation, so an empty wallet says so rather than guessing.

## Docs

- [docs/STATUS.md](docs/STATUS.md) — what is verified working, what is limited, what is not built.
- [docs/SECURITY.md](docs/SECURITY.md) — security and privacy review, data model, validation.
- [docs/RELEASE.md](docs/RELEASE.md) — App Store / Play Store checklist and cost breakdown.
