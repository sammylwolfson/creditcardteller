# Security and privacy review

Reviewed 2026-08-21 against the `develop` branch.

## Summary

No secrets, no network calls, no card numbers. The app is fully offline: it has
no backend, no account system and no analytics, so there is no server-side
attack surface and no data in transit to protect.

| Check | Result |
| --- | --- |
| Hardcoded secrets, API keys, tokens | None. Verified by pattern scan across all source and config. |
| Outbound network calls | None. No `fetch`, `XMLHttpRequest`, `axios` or WebSocket anywhere in app code. |
| Card numbers / CVV / expiry stored | None. No such field exists in the data model or any input. |
| Third-party analytics or crash SDKs | None. |
| Runtime dependencies | Four, all first-party Expo or React Native core. |

## What the app actually stores

Card records hold a **nickname, network, reward rules, fees and a point
valuation** — the information needed to rank cards. That is all.

```ts
interface Card {
  id: string; name: string; shortName: string;
  network: CardNetwork; rewardCurrency: RewardCurrency; rewardUnitValue: number;
  annualFee: number; foreignTransactionFee: number; rewardRules: RewardRule[];
}
```

There is deliberately **no field for a card number, CVV, expiry date or
cardholder name**, and the app never asks for one. The custom-card form is
labelled "Nickname" and rejects any input containing a 13+ digit run, so a user
who pastes a real card number out of habit is stopped with an explanation
rather than silently having it written to disk.

Also stored locally: pinned store coordinates, favorites, reward-category spend
totals you enter yourself, decision history, and learned merchant spellings.

## Storage model

Everything lives in `AsyncStorage`, which is unencrypted but sandboxed to the
app by the OS. **This is an accepted decision, not an oversight**: the stored
data is not sensitive enough to justify the cost of `expo-secure-store`, which
is size-limited and slower.

That decision depends on the data staying non-sensitive. **If a future version
ever stores a card number, account identifier or credential, it must move to
`expo-secure-store` or the OS keychain.** Nothing in the current design needs
one.

Residual risk: OS-level backups (iCloud, Google Backup) include the app
sandbox, so card nicknames and pinned store coordinates can appear in a device
backup. Low severity — no financial credential is exposed — but worth knowing
before pinning a home address as a "store".

## Location handling

- Coordinates are captured only when the user explicitly taps **Pin current
  location**, and only for stores they favorited.
- Geofence regions are registered with the OS and stored locally. They are
  never transmitted, because there is nowhere to transmit them to.
- Background location is opt-in, off by default, and gated behind an explicit
  permission flow that reports exactly which grant is missing.
- Seeded merchants ship with **no coordinates**. The app cannot know where your
  Costco is until you pin it.

## Input validation

| Input | Validation |
| --- | --- |
| Card nickname | 1–60 characters; rejects 13+ digit runs (card-number guard) |
| Base / bonus reward rate | Finite, 0–100% |
| Annual fee | Finite, $0–$10,000 |
| Foreign transaction fee | Finite, 0–100% |
| Purchase amount | Non-numeric characters stripped; must parse positive and finite |
| Saved store name | 1–80 characters; duplicate ids rejected |
| Spend ledger entries | Non-finite and non-positive amounts discarded |
| Assumed annual spend | Chosen from a fixed chip list, never free text; a zero estimate disables amortisation rather than dividing by zero |
| Quarterly activation | A boolean toggle per rule, stored per quarter; no free input |
| Anything read from storage | Shape-validated per record type, including the activation ledger; invalid data is ignored and seeds are used |

Stored data is treated as untrusted on read. `src/services/schema.ts` validates
every record type, so corrupt JSON, a hand-edited file or a stale v1 record
falls back to seed data instead of producing a confidently wrong rate.

## Expo / React Native practice notes

- The geofence task is registered at module scope so it exists before iOS
  delivers a region event to a cold-started app.
- Background task failures are caught and swallowed; a crashing background task
  can get an app's location privileges revoked by the OS.
- Storage writes are wrapped so a failed write degrades to in-memory state
  rather than breaking a recommendation.
- Writes are suppressed until hydration completes, so first render cannot
  overwrite stored data with seed defaults.
- `usesNonExemptEncryption: false` is declared, which is accurate — the app
  performs no encryption — and avoids an export-compliance prompt per upload.

## Known gaps

- No jailbreak/root detection. Out of proportion for a local rewards app.
- No app-level lock (Face ID to open). Reasonable to add later; the data does
  not currently warrant it.
- Dependencies are not pinned by a `npm audit` gate in CI, because there is no
  CI yet.
