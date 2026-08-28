# Working on Credit Card Teller

Read this before changing anything in `src/engine/`. It records the invariants
that previous bugs violated, so the same mistakes don't get reintroduced.

Tool-agnostic on purpose: any coding assistant or human should be able to work
from this file alone.

## What it is

An Expo (iOS + Android) app that tells you which of *your* credit cards to use
at the store you're standing in. Toggle the cards you carry in Wallet → search a
store or let a geofence detect it → get one card, a rate, and the reasoning.

The differentiator is real-time location. Without geofencing it's a lookup tool
that competitors already have.

## Quick start

```bash
npm install
npm run check      # typecheck + 82 tests. This is what CI runs.
npm start          # Expo dev server
npm run ios        # dev build (required for geofencing)
```

`npm run check` must stay green. It's the only automated gate.

## How the engine works

Every card is reduced to one **cash-equivalent effective rate**, so cards
earning in different currencies compare honestly. In order:

1. **Network acceptance** — Costco takes Visa only; other cards come back
   ineligible *with a reason*, never silently ranked last.
2. **Rule selection** — the applicable rule with the **highest post-cap rate**
   wins.
3. **Issuer exclusions** — a rule that excludes this *kind of store* is dropped.
4. **Caps** — exhausted → post-cap rate; a purchase straddling a cap blends
   across both tiers.
5. **Point valuation** — multiplied by `rewardUnitValue`.
6. **Foreign transaction fee** — subtracted.
7. **Annual fee** — a caveat by default; deducted if amortisation is on.

Each step appends to a `factors` list with the rate delta it contributed. That
list *is* the "Why" section in the UI. **If you add a step to the pipeline, add
a factor for it** — an unexplained number is a regression, even if correct.

## Invariants — do not regress

Each of these is a bug that actually shipped and got fixed. There's a test
pinning every one; if you find yourself deleting one of those tests, stop.

1. **Highest rate wins; specificity is only a tiebreak.** The original engine
   sorted by specificity first, so a 1% merchant-specific rule shadowed a 5%
   category rule on the same card.
2. **Only cards in the wallet are scored.** `cards` is the catalogue;
   `walletCardIds` is what the user carries. Scoring the catalogue recommends
   cards they can't pay with. This applies in the background geofence path too —
   use `walletCards(snapshot)`, not `snapshot.cards`.
3. **Issuer exclusions key off `MerchantTrait`, not `category`.** Issuers
   exclude by kind of store. Deriving exclusions from category makes them
   accidental — they break the moment a merchant is re-categorised or a user
   saves their own store under a matching category.
4. **The nudge throttle must stay persisted.** It once lived in a module
   variable, which reset every time iOS relaunched the app for a region event —
   exactly when it needed to hold.
5. **The geofence task stays registered at module scope** in
   `src/services/geofence.ts`. iOS delivers region events to a cold-started app;
   the task must exist before the app finishes booting. `App.tsx` imports the
   module for this reason — that import is not dead.
6. **Never write to storage before hydration completes.** `App.tsx` guards this
   with `hydratedRef`; without it the first render overwrites saved data with
   seeds.
7. **Bump `STORAGE_VERSION` when a persisted shape changes.** Old records are
   rejected, not migrated. That's deliberate: a wrong rate is worse than a reset.
8. **The engine imports nothing from `react-native`.** This is why `npm test`
   runs on plain node with no mobile test runner. Importing RN into
   `src/engine/` or `src/services/nudgePolicy.ts` breaks the whole test setup.

## Hard constraints

- **No card numbers.** No PAN, CVV, expiry or cardholder name field exists
  anywhere. The nickname input rejects 13+ digit runs — keep that guard.
- **No outbound network calls** in app code. No analytics. No crash SDK.
- **No paid APIs**, including places/merchant APIs. Zero monthly cost is a
  project constraint. Merchant data is hand-curated plus user-saved stores.
- **Offline-first.** Everything lives in AsyncStorage on device.
- **Unencrypted AsyncStorage is an accepted decision** for this data model. If
  anything sensitive ever gets stored, move to `expo-secure-store` — see
  `docs/SECURITY.md`.
- **No new runtime dependencies** unless first-party Expo/React Native.
- Keep `strict` and `noUncheckedIndexedAccess` on.

## Layout

```
App.tsx                       all four tabs + state (~1300 lines, untested)
src/engine/rewards.ts         scoring, exclusions, caps, explanation
src/engine/merchantMatch.ts   normalisation, fuzzy matching, confidence
src/engine/spend.ts           cap ledger + quarterly activation ledger
src/data/cards.ts             7 seeded cards
src/data/merchants.ts         51 seeded merchants + default settings
src/services/geofence.ts      regions, permissions, background task
src/services/nudgePolicy.ts   anti-spam gating (pure, testable)
src/services/schema.ts        validators for anything read from storage
src/services/storage.ts       versioned AsyncStorage access
tests/                        82 tests + a zero-dependency runner
```

## What is real vs. placeholder

Be careful here — some seeded data is deliberately provisional and labelled.

| Thing | Status |
| --- | --- |
| Card reward rates | Hand-transcribed from public terms, stamped `2026-08`. Decays. |
| **Rotating quarterly categories** | **Placeholder.** The quarter-to-category mapping in `rotatingQuarters` (`src/data/cards.ts`) is *not* a published calendar. Issuers publish a new one yearly. Confirm before trusting; do not present it as verified. |
| Geofence radii | Guesses, 60–150m, never validated in the field. |
| Icon / splash | Generated placeholder art. Keep `icon.png` opaque — Apple rejects alpha. |
| Quarterly activation | Self-reported. The app can't know if you activated with the issuer. |
| Cap ledger | Self-reported. Only as accurate as the user's logging. |

## Known traps

- **`npm install` can produce a tree missing `expo-asset`** (a transitive dep of
  `expo`) even though `npm ls` reports it satisfied. Metro can't bundle without
  it. Install it explicitly at the version `expo@52` wants if bundling fails.
- **`expo-doctor` has four checks that need network access** to Expo's API. In a
  sandboxed environment they fail with `Host not in allowlist` — that's the
  environment, not a finding. Run it locally to get a real result.
- **Geofencing cannot be tested in Expo Go.** Background location needs a
  development build.

## What's next

`docs/STATUS.md` holds the full backlog and an honest account of what's verified
vs. limited. The short version:

1. **P1 — run the geofence path on a physical device.** See
   `docs/GEOFENCE-DEVICE-PASS.md`. It's the differentiator and it has *never*
   run on hardware. Everything else is downstream.
2. Confirm the rotating category calendars against the issuers.
3. Prepare the background-location justification for both app stores — the
   likeliest source of rejection. `docs/RELEASE.md`.
4. Replace the placeholder icon and splash.

Structural gaps worth knowing: `App.tsx` is 1300 lines with no tests, and there
is no mechanism to keep card terms fresh as they change.

## Other docs

- `README.md` — how the engine and matcher work, for users.
- `docs/STATUS.md` — verified / limited / not built, plus the backlog.
- `docs/SECURITY.md` — security review, data model, validation table.
- `docs/RELEASE.md` — store submission checklist and cost breakdown.
- `docs/GEOFENCE-DEVICE-PASS.md` — the P1 device test.
