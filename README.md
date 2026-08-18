# Credit Card Teller MVP

Mobile app MVP that recommends which credit card to use at a merchant for maximum rewards, with optional geofence nudges for favorite locations.

## Implemented scope

- Card templates for Costco Anywhere Visa and Apple Card.
- Rules engine with explainable output (`best card`, `%`, and `why`).
- In-store and online recommendation modes.
- Payment method awareness (`Apple Pay`, `physical`, `online checkout`).
- Favorites list (stores to monitor for optional geofence nudges).
- Optional geofence automation toggle with permissions flow.
- Anti-spam and quiet-hour gating for nudges.
- User override per merchant.
- Basic event logging (`accepted` vs `dismissed`).
- Custom card editor (MVP-level: default base rate rule).

## Product reality constraints reflected in code

- Geofence automation is opt-in and limited to favorites only.
- Reminders are gated by a minimum reward delta threshold and quiet hours.
- Manual one-tap recommendation flow is always available with no heavy permissions.

## Run locally

```bash
npm install
npm run start
```

Open in iOS/Android simulator or Expo Go.

## File map

- `App.tsx` - UI, state management, logging, overrides, and tab flows.
- `src/engine/rewards.ts` - card scoring and explainable decision logic.
- `src/data/seed.ts` - seed cards, merchants, and settings.
- `src/services/geofence.ts` - geofence registration and nudge gating logic.
- `src/services/storage.ts` - AsyncStorage helpers.
- `src/types/domain.ts` - domain model types.

## Future features

- Stronger online purchase recommendations:
  - Merchant normalization for checkout domains.
  - Browser extension + share-sheet hooks for card hints at checkout.
  - Partner merchant sync for cards like Apple Card and rotating bonus categories.
- Better merchant detection confidence and fallback prompts when uncertain.
- Offer/coupon stacking suggestions and card-linked offer awareness.
