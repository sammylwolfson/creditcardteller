# Status

Last updated: 2026-08-21.

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
| App compiles and bundles | Working | `tsc --noEmit` clean; `expo export --platform ios` bundles 705 modules |
| Native config for background geofencing | Working | `expo config --type prebuild` resolves all three plugins, `UIBackgroundModes: ["location"]`, and Android background-location permissions |

## Fixed this week

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
- **Custom cards are flat-rate only.** The in-app editor cannot add bonus categories, caps or conditions; those need editing `src/data/cards.ts`.
- **The merchant catalogue is 21 entries.** Unknown stores work via the ad-hoc category fallback but are not saved for reuse.
- **Favoriting an online-only merchant** (Costco.com) will list it as "not pinned" in the geofence sync summary, which is accurate but noisy.
- **No UI tests.** Components are unverified beyond typechecking and a successful bundle; all tests target the pure modules.
- **Upgrading storage discards old data.** v1 records are rejected rather than migrated. That is deliberate — a wrong rate is worse than a reset — but it means an upgrade loses history.

## Not built

- Online checkout detection (browser extension, share-sheet hook). The matcher accepts a URL, but the URL must be pasted in by hand.
- Card-linked offers and coupon stacking.
- Sign-up bonus and minimum-spend tracking.
- Multi-card split strategies for a single basket.
- Any sync, export or backup. Reinstalling the app loses everything.

## Suggested next steps

1. Run the geofence path on hardware end to end, then delete the caveat above.
2. Add rotating-category support (an `activeQuarters` condition plus an activation reminder) — the biggest missing modelling feature for common cards.
3. Let a matched-but-unknown merchant be saved to the catalogue from the recommend screen, so the ad-hoc fallback compounds into coverage.
4. Amortise annual fees behind a toggle, using logged spend to estimate a break-even.
