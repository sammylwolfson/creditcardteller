# Release checklist

What it takes to get Credit Card Teller onto the App Store and Play Store, and
what it costs.

## Costs

Running costs are effectively zero. The unavoidable costs are the developer
accounts:

| Item | Cost | Notes |
| --- | --- | --- |
| Apple Developer Program | **$99/year** | Required to ship to the App Store or TestFlight. |
| Google Play Developer | **$25 one-time** | Required to ship to Play. |
| EAS Build | **$0** | Free tier covers low-volume builds; local builds are unlimited and free. |
| EAS Update (OTA) | **$0** | Free tier is generous for a personal app. Optional. |
| Backend / APIs / hosting | **$0** | There is no backend. All data is local and hand-seeded. |
| Merchant data | **$0** | Hand-curated seed list, not a paid API. |

**Total ongoing: $99/year if shipping to iOS, $0/month otherwise.** Nothing in
the architecture introduces a per-user or per-request cost.

## Before the first build

1. **Replace the placeholder art.** `assets/icon.png`, `assets/adaptive-icon.png`
   and `assets/splash.png` are generated placeholders — a flat card mark on a
   navy field. They are valid and will build, but they are not a brand. Apple
   rejects icons with alpha channels; `icon.png` is already opaque, so keep it
   that way if you replace it.
2. **Run `eas init`.** This writes `extra.eas.projectId` into `app.json`. It is
   deliberately absent from source control because it is account-specific and a
   placeholder value would fail the build.
3. **Confirm the bundle identifiers.** Currently `com.sammy.creditcardteller`
   on both platforms. These are permanent once published.
4. **Write a privacy policy and host it.** Both stores require a public URL, and
   because this app requests background location, neither will approve without
   one. `docs/SECURITY.md` has the substance; it needs to become a public page
   (a GitHub Pages file is free and sufficient).

## Building

```bash
npm install
npm run check                       # typecheck + tests, must be green
npx expo-doctor                     # dependency and config sanity

eas build --profile development --platform ios      # dev client for on-device testing
eas build --profile preview --platform android      # installable APK
eas build --profile production --platform all       # store binaries
```

Geofencing **cannot be tested in Expo Go** — background location requires a
development build. Use the `development` profile first.

## App Store submission

- **Background location justification is the hard part.** Apple scrutinises
  `UIBackgroundModes: ["location"]` and `NSLocationAlwaysAndWhenInUseUsageDescription`.
  The review notes must explain that location is used solely to notify the user
  which card to use at stores they explicitly pinned, that it is opt-in and off
  by default, and that no location leaves the device. Expect a request for a
  demo video showing the feature.
- **App Privacy questionnaire:** declare Location as collected-but-not-linked
  and not used for tracking. There is no analytics SDK, no identifier
  collection, and no data leaves the device — answer accordingly.
- Screenshots for 6.7" and 6.5" iPhone are mandatory. Four tabs give you four
  natural screenshots.
- Set the age rating and the finance category.
- Route the first builds to **TestFlight** and use them for the on-device
  geofence verification that has not happened yet.

## Play Store submission

- **Data safety form:** declare location collection, no sharing, no off-device
  transmission.
- **Background location requires a separate declaration** plus a demo video and
  a written justification. Google is as strict as Apple here, sometimes
  stricter, and background-location approval can take several review cycles.
- `ACCESS_BACKGROUND_LOCATION` requires the prominent-disclosure pattern: the
  app must explain the use before the system dialog. The permission flow shows
  a description and reports exactly what is missing, which satisfies this, but
  screenshot it for the review notes.
- Target API level must meet Play's current floor; Expo SDK 52 does.
- Start with an **internal testing** track.

## Versioning

`app.json` holds `version` (user-facing), `ios.buildNumber` and
`android.versionCode`. The `production` EAS profile has `autoIncrement: true`,
so build numbers advance automatically. Bump `version` by hand per release.

`runtimeVersion` uses the `appVersion` policy: OTA updates only reach clients on
a matching app version, which is the safe default when native permissions are
involved.

## Environment variables

**There are none, by design.** No API keys, no endpoints, no secrets — so there
is no `.env` to validate and nothing to leak. `.gitignore` already excludes
`.env*` in case that changes.

If configuration is ever added, put it in `app.json` under `expo.extra`, read it
through `expo-constants`, and validate it at startup rather than trusting it at
the call site. Do not introduce a `.env` file for anything that ships in the
bundle — everything in a mobile bundle is readable by the user.

## Still blocking a confident release

1. **Geofencing has never run on physical hardware.** This is the differentiator
   and the least-verified part. Do this first, via a development build.
2. Card reward terms are a hand-checked snapshot and need re-verification
   against issuer sites before anyone but you relies on them.
3. No crash reporting. Sentry's free tier would cover a personal app if you want
   visibility after release; it is the only third-party service worth adding.
