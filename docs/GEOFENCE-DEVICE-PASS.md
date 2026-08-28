# P1 — what still needs a physical device

Everything in this repo is verified by typecheck, 73 unit tests, a Metro bundle
for both platforms, and now a CI gate. **None of that can verify geofencing.**
This note says exactly what remains unproven and how to prove it.

## Why CI cannot close this

The geofence path depends on behaviour that only exists on a real device:

- **iOS decides when a region event fires.** Region monitoring is coarse,
  battery-managed and debounced by the OS. There is no simulator fidelity for
  the delay between crossing a boundary and the callback.
- **The app is relaunched from cold with no React state.** `handleRegionEnter`
  rebuilds cards, wallet, settings, ledgers and throttle state from
  AsyncStorage. Tests cover the function; they cannot cover the OS actually
  waking a terminated app and the module-scope task being registered in time.
- **Permission behaviour is device-and-OS-version specific.** "Always" location
  can be granted, downgraded to "While Using", or silently revoked after a
  background crash.
- **Expo Go cannot run any of it.** Background location needs a development
  build.

## The pass

```bash
eas build --profile development --platform ios   # or: npm run ios
```

1. **Wallet tab** — switch on the cards you carry. An empty wallet deliberately
   produces no recommendation.
2. **Places tab** — favorite a store, stand in it, tap **Pin current location**.
   Seeded merchants ship with no coordinates on purpose.
3. Enable **Geofence nudges**; grant location **Always** plus notifications.
4. Confirm the Places tab reads **task registered / monitoring active**. If
   either half is false, nothing below will fire.
5. Tap **Test nudge** — this dry-runs the exact background code path in the
   foreground. It should name a real card and rate.
6. Leave the radius, wait, and return. Verify a notification arrives with the
   app **backgrounded**, then repeat with the app **fully swiped closed**.

## What to record

- Wall-clock delay between crossing the boundary and the notification.
- Whether the cold-start notification names the **correct** card — this is the
  path that rebuilds from storage, so a wrong card means a storage or wallet
  scoping bug, not a location bug.
- Whether the persisted anti-spam throttle survives a relaunch (leave and
  re-enter twice inside the per-store cooldown; the second should stay silent).
- Whether the pinned radius is right in practice. The seeded radii are guesses
  of 60–150m and have never been validated in the field.

## New since the last pass: quarterly activation

The rotating-category work adds state the background path now reads. When the
geofence fires at a store covered by an **activated** rotating category, the
notification must quote the bonus rate; when the quarter is **not** activated it
must quote the base rate. Both come from the activation ledger in AsyncStorage,
so this is a cold-start correctness check, not just a location check.

Worth testing at a store matching the current quarter's categories, with the
activation toggle flipped both ways between arrivals.

## Until this is done

Treat geofencing as **unproven**. The manual "What card?" flow is fully
exercised and safe to rely on; the geofence nudge is the differentiator and the
single largest open risk in the project.
