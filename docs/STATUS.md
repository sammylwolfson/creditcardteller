# Status

Last updated: 2026-08-21 (second pass).

Honest accounting of what is working, what is limited, and what has not been built.

## Verified working

Verification method is listed for each item. "Tested" means a unit test in `tests/` covers it; "bundled" means it survives a real Metro build.

| Area | State | How it was verified |
| --- | --- | --- |
| Rule selection by highest post-cap rate | Working | Tested, including a regression test for the old specificity-first bug |
| Network acceptance (Costco → Visa only) | Working | Tested — Amex and Mastercard come back ineligible with a reason |
| Category caps: exhaustion and partial blending | Working | Tested — $6,000 supermarket cap changes the winner; a straddling purchase blends to 2.0% |
| Point valuation before ranking | Working | Tested — 1.5% at 1.5¢/pt scores 2.25% |
| Foreign transaction fees | Working | Tested — a 3% earn on a 3%-fee card nets to 0 and the no-fee card wins |
| Issuer-portal-only rules | Working | Tested — Chase's 5% travel only fires with the portal flag |
| Apple Pay fallback at merchants that reject it | Working | Tested — input is normalised and the adjustment is surfaced, not silent |
| Ties, overrides, ignored-override fallback | Working | Tested |
| "No usable card" case | Working | Tested |
| Every seeded card × merchant × channel returns a non-zero answer | Working | Tested as a sweep |
| Merchant matching: descriptors, domains, typos, ambiguity, unknowns | Working | Tested, including a sweep over every seeded name and alias |
| Learned aliases from user confirmation | Working | Tested |
| Nudge gating: threshold, quiet hours (incl. overnight wrap), global and per-store cooldowns, ties | Working | Tested, including a persisted-state round trip |
| Spend ledger: period buckets, headroom, pruning, junk input | Working | Tested |
| Stored-data validation rejects v1 records and corrupt JSON | Working | Tested |
| Wallet scoping: only held cards are ranked | Working | Tested — a card outside the wallet never appears; empty wallet returns no winner |
| Expanded merchant catalogue integrity | Working | Tested — unique ids, no superstore miscategorisation, Costco network rule intact, valid domains |
| App compiles and bundles | Working | `tsc --noEmit` clean; `expo export --platform ios` bundles cleanly |
| Native config for background geofencing | Working | `expo config --type prebuild` resolves all three plugins, `UIBackgroundModes: ["location"]`, and Android background-location permissions |

## Fixed in the consolidation pass

- **The app recommended cards you may not own.** All five seeded cards were
  always scored. There is now a catalogue/wallet split: only cards the user has
  switched on are ranked, in the UI and in the background geofence path alike.
  An empty wallet says so instead of inventing an answer.
- **Unknown stores were a dead end.** An unmatched search can now be saved into
  the merchant catalogue, learned as an alias, then favorited and pinned.
- **Custom cards were flat-rate only.** The editor now takes a network, base
  rate, annual fee, foreign transaction fee and one bonus category, all
  validated.
- **No card-number guard.** The nickname field now rejects 13+ digit runs and
  explains why, so a pasted card number cannot reach storage.
- **`geofenceStatus` was dead code.** It is now surfaced in the Places tab as a
  live "task registered / monitoring active" line, which is the fastest way to
  tell whether geofencing is really running.
- **Seed merchants went from 21 to 50**, with superstores and warehouse clubs
  deliberately kept out of the `grocery` category so they do not wrongly earn
  supermarket bonus rates.
- **No app icon or splash existed**, which blocks a store build. Placeholder art
  is generated and wired into `app.json`, along with `scheme`, `buildNumber`,
  `versionCode`, adaptive icon and export-compliance declaration.

## Fixed in the first pass

- **Specificity beat rate.** The old engine sorted a card's matching rules by specificity first, so a 1% merchant-specific rule shadowed a 5% category rule on the same card. Now the highest post-cap rate wins and specificity is only a tiebreaker.
- **In-memory nudge throttle.** The 45-minute throttle lived in a module variable, which reset every time iOS relaunched the app for a region event — exactly when it needed to hold. It is now persisted and gated on a per-store cooldown too.
- **Geofencing could never fire.** No seeded merchant had coordinates and there was no way to add them, so `registerFavoriteGeofences` always returned early. Stores are now pinned from the device's GPS.
- **The background notification said nothing useful.** It was a static "open the app" string. It now runs the engine from persisted state and names the card and rate.
- **Apple Pay at a merchant that rejects it** silently knocked out every Apple Pay rule, making the Apple Card look worse than it is. The input is now normalised with a visible note.
- **No merchant matching existed.** The merchant was a hardcoded picker. There is now a matcher with confidence levels and confirmation.
- **Stale regions.** Geofences are stopped before re-registering, capped at the 20 iOS allows, and skipped stores are reported with the reason.
- **Type errors under `noUncheckedIndexedAccess`.** `scores[0]` was dereferenced without a guard.

## Known limitations

- **Not tested on a physical device.** The geofence logic, permission flow and notification payload are unit-tested and the app bundles, but no real region entry has been observed on hardware. **Walk the Test nudge → pin → real arrival path once before trusting it.** This is the largest open risk.
- **Card terms are a snapshot.** Rates are as of `2026-08` from public issuer terms and are not fetched or refreshed. Verify against your issuer.
- **The cap ledger is manual.** Spend only counts when you enter an amount and tap "I used it". There is no bank feed, so the $6,000 supermarket cap is only as accurate as your logging.
- **Annual fees are not amortised.** The Blue Cash Preferred's $95 fee appears as a caveat, not in the rate. Comparing a fee card to a free one at the purchase level slightly favours the fee card.
- **No rotating quarterly categories.** Chase Freedom Flex and Discover-style 5% rotations are not modelled; the rule schema has no activation or quarter concept.
- **Apple Card's 3% partner list is static** and hardcoded to five merchants. Apple changes it and there is no sync.
- **Category coverage is coarse.** One category per merchant, 15 categories, US-centric. Amex's supermarket exclusions (superstores, warehouse clubs) are a caveat string, not a rule.
- **Custom cards support one bonus category.** Caps, payment-method conditions and multiple bonus tiers still need editing `src/data/cards.ts`.
- **The merchant catalogue is 50 entries** and US-centric. Unknown stores can now be saved, but there is no shared or imported source.
- **Icons and splash are placeholder art.** They build and look deliberate, but they are not a brand. See `docs/RELEASE.md`.
- **Favoriting an online-only merchant** (Costco.com) will list it as "not pinned" in the geofence sync summary, which is accurate but noisy.
- **No UI tests.** Components are unverified beyond typechecking and a successful bundle; all tests target the pure modules.
- **Upgrading storage discards old data.** v1 records are rejected rather than migrated. That is deliberate — a wrong rate is worse than a reset — but it means an upgrade loses history.

## Not built

- Online checkout detection (browser extension, share-sheet hook). The matcher accepts a URL, but the URL must be pasted in by hand.
- Card-linked offers and coupon stacking.
- Sign-up bonus and minimum-spend tracking.
- Multi-card split strategies for a single basket.
- Any sync, export or backup. Reinstalling the app loses everything.

## Backlog

The Linear project (`Credit Card Teller`) is at the workspace's **free issue
limit**, so it holds the brief but cannot accept issues without a paid upgrade.
Since keeping costs at zero is an explicit project constraint, the backlog lives
here instead. Move it to Linear if that workspace is ever upgraded.

### P1 — Verify geofencing end to end on a physical device

The differentiator, and the least-verified part of the app. The logic is unit
tested and both platforms bundle, but **no real region entry has ever been
observed on hardware**. Everything else is downstream of this working. Cannot be
tested in Expo Go; needs a development build.

1. `eas build --profile development --platform ios` (or `npm run ios`).
2. Wallet tab: switch on the cards you carry.
3. Places tab: favorite a store, stand in it, tap **Pin current location**.
4. Enable geofence nudges; grant location "Always" plus notifications.
5. Tap **Test nudge** — dry-runs the exact background path.
6. Leave and return; confirm entry fires with the app backgrounded *and* fully
   closed.

Watch for: the "task registered / monitoring active" line in Places; whether the
cold-start path names the right card (it rebuilds from storage with no React
state); whether the persisted throttle holds across a relaunch; and the real
delay between crossing the boundary and the notification.

### P2 — Prepare the background-location store justification

The likeliest source of rejection, and worth preparing before the first
submission rather than after the first rejection. Needs: a hosted privacy policy
URL (both stores require one; `docs/SECURITY.md` is the substance), written
reviewer notes, a demo video of the pin → arrive → notify flow, Apple's App
Privacy questionnaire, and Play's data-safety plus background-location
declarations. Blocked by P1 — the video needs a working build. Detail in
`docs/RELEASE.md`.

### P2 — Replace the placeholder icon and splash

`assets/*.png` are generated placeholders. They build and look deliberate but
are not a brand. Keep `icon.png` opaque; Apple rejects icons with alpha.

### P3 — Re-verify card reward terms

Rates are a hand-checked snapshot stamped `2026-08`. Re-confirm against issuer
sites before anyone but the author relies on them, and refresh `termsAsOf`.

### P3 — Rotating quarterly categories

The biggest missing modelling feature for common cards (Chase Freedom Flex,
Discover it). Needs an `activeQuarters` condition on `RewardRule` plus an
activation reminder, since unactivated quarters earn the base rate.

### P3 — Add CI

There is no automated gate on any push. A GitHub Actions workflow running
`npm run check` on pull requests would cost nothing and catch regressions.

### P4 — Amortise annual fees behind a toggle

The Blue Cash Preferred's $95 fee is a caveat, not part of the rate, which
slightly favours fee cards at the purchase level. Logged spend could estimate a
break-even.

### Open questions from the project brief

- **Merchant data source.** Currently 50 hand-curated entries plus user-saved
  stores. A paid places API would improve coverage but breaks the zero-cost
  constraint. The ad-hoc "save this store" path is the free alternative and
  compounds with use — worth measuring before paying for anything.
- **Store detection accuracy.** Geofence radii are per-merchant guesses
  (60–150m) and unvalidated in the field. P1 will produce the first real data.
- **Monetization.** Undecided. Nothing in the current architecture forecloses
  any option, and nothing depends on deciding now.

See also `docs/SECURITY.md` for the security review and `docs/RELEASE.md` for the
store-submission checklist and cost breakdown.
