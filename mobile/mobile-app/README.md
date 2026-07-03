# AuraEvents Mobile (Expo)

Basic Expo/React Native client: login against Identity.Api directly (no BFF — mobile apps have
no XSS/DOM surface to defend, so the access + refresh tokens live in `expo-secure-store`
instead of httpOnly cookies), a registered-events list from Events.Api, and a visual QR-code
mockup for check-in.

## Structure

```
mobile-app/
├── App.tsx                    # session bootstrap + simple state-based screen switching
└── src/
    ├── lib/
    │   ├── config.ts          # API base URLs (EXPO_PUBLIC_* env vars)
    │   ├── auth.ts             # login/logout, SecureStore token persistence, refresh-on-401
    │   └── events.ts           # GET /api/users/me/registrations
    ├── screens/
    │   ├── LoginScreen.tsx
    │   ├── EventsScreen.tsx
    │   └── QrCodeScreen.tsx
    └── components/
        └── MockQrCode.tsx      # visual-only placeholder, not a scannable code
```

## Running locally

```bash
cp .env.example .env   # adjust API URLs for your setup — see comments in the file
npm install
npm run android   # or: npm run ios / npm run web
```

Requires Identity.Api and Events.Api running (`docker compose up` from the repo root).

## Known follow-ups

- Navigation is plain React state (no router library) — deliberately minimal for this scaffold.
  Reach for `expo-router` if the screen count grows.
- `MockQrCode` is a deterministic-but-fake visual pattern, not a real scannable QR code. Swap in
  `react-native-qrcode-svg` (encoding the registration ID) for a working check-in flow.
- No RTL layout mirroring (`I18nManager.forceRTL`) yet — copy is in Hebrew but layout is LTR.
  Enabling RTL requires a native reload and is worth doing as a dedicated pass.
