# AuraEvents — Tech Stack

נבדק מול קוד המקור בפועל (package.json, קבצי csproj, docker-compose.yml) — לא מבוסס על ניחוש.

## שכבת לקוח

### Web — `frontend/web-app`
- Next.js `16.2.10` (App Router, React Server Components)
- React `19.2.4`, TypeScript `^5`
- Tailwind CSS `^4`, Framer Motion `^12`
- jsQR `^1.4` — סריקת QR מהמצלמה בדפדפן

ניהול מצב הוא React state מקומי (`useState`) + Context (`AuthProvider`) — **אין Redux** בפרויקט.

### Mobile — `mobile/mobile-app`
- React Native `0.86`, Expo SDK `~57.0`
- TypeScript `~6.0`

## שכבת שירותים (.NET 10, Microservices)

### Identity.Api
- `net10.0`, `Microsoft.AspNetCore.Authentication.JwtBearer 10.0.9`
- JWT חתום בזוג מפתחות RSA (public/private key)
- תפקידים: `Attendee` / `Organizer` / `Admin`
- EF Core + Npgsql (PostgreSQL)

### Events.Api
- `net10.0`
- `QRCoder 1.6.0` — הפקת כרטיסי QR
- `OpenAI 2.12.0` — המלצות אירועים מותאמות אישית
- EF Core + Npgsql (PostgreSQL)

שני השירותים חושפים תיעוד API עם Swashbuckle (Swagger).

## שכבת תוכן

### Umbraco (Headless CMS)
מנהל תוכן עריכתי של אירועים וקטגוריות (כותרות, תיאורים, תמונות). מסתנכרן עם Events.Api בשני הכיוונים דרך Management API + Sync Key ייעודי — לא חלק מנתיב הנתונים הטרנזקציוני (הרשמות/capacity).

## נתונים ותשתית

- **PostgreSQL 17** — שלושה מסדי נתונים נפרדים על אותו instance: `auraevents_identity`, `auraevents_events`, `auraevents_cms` (לא סכמות משותפות בתוך מסד אחד).
- **Docker Compose** — מריץ ומתזמר את כל השירותים (postgres, identity-api, events-api, umbraco).
- תקשורת בין-שירותית מאובטחת ב-Sync Keys ייעודיים לכל ערוץ (למשל `USERS_SYNC_KEY`, `CATEGORY_SYNC_KEY`).

## מקורות שנבדקו
- `frontend/web-app/package.json`
- `mobile/mobile-app/package.json`
- `src/services/Identity.Api/Identity.Api.csproj`
- `src/services/Events.Api/Events.Api.csproj`
- `docker-compose.yml`
- `deploy/postgres/init-databases.sql`
