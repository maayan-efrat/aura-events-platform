# AuraEvents Mobile (Expo)

Basic Expo/React Native client: login against Identity.Api directly (no BFF — mobile apps have
no XSS/DOM surface to defend, so the access + refresh tokens live in `expo-secure-store`
instead of httpOnly cookies), a registered-events list from Events.Api, and each ticket's real
QR code (rendered by Events.Api, fetched via `GET /api/events/{eventId}/registrations/me/qr`).

## Structure

```
mobile-app/
├── App.tsx                    # session bootstrap + simple state-based screen switching,
│                               # wraps every screen in the persistent AppHeader/AppFooter
└── src/
    ├── lib/
    │   ├── config.ts          # API base URLs (EXPO_PUBLIC_* env vars)
    │   ├── auth.ts             # login/logout, SecureStore token persistence, refresh-on-401
    │   └── events.ts           # GET /api/users/me/registrations
    ├── components/
    │   ├── AppHeader.tsx       # persistent top bar (brand + user greeting/logout)
    │   └── AppFooter.tsx       # persistent bottom bar
    └── screens/
        ├── LoginScreen.tsx
        ├── EventsScreen.tsx
        └── QrCodeScreen.tsx    # fetches the ticket QR via authedFetch and renders it as a
                                 # base64 data URI — <Image>'s `headers` option isn't honored by
                                 # react-native-web, so a real fetch is what works on every target
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
- No RTL layout mirroring (`I18nManager.forceRTL`) yet — copy is in Hebrew but layout is LTR.
  Enabling RTL requires a native reload and is worth doing as a dedicated pass.
