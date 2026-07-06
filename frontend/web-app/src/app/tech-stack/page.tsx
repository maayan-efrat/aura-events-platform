import { Footer } from "@/components/layout/Footer";

export const metadata = { title: "הסטאק הטכנולוגי — AuraEvents" };

interface StackItem {
  title: string;
  chips: string[];
  description: string;
}

interface StackLayer {
  label: string;
  hint: string;
  items: StackItem[];
}

const LAYERS: StackLayer[] = [
  {
    label: "שכבת לקוח",
    hint: "מה שהמשתמש רואה — דפדפן ומובייל",
    items: [
      {
        title: "Web — frontend/web-app",
        chips: ["Next.js 16.2.10", "React 19.2.4", "TypeScript 5", "Tailwind CSS 4", "Framer Motion 12", "jsQR 1.4"],
        description:
          "Next.js App Router עם React Server Components לשליפת נתונים בצד שרת. ניהול המצב הוא React state מקומי — אין Redux בפרויקט.",
      },
      {
        title: "Mobile — mobile/mobile-app",
        chips: ["React Native 0.86", "Expo SDK 57", "TypeScript 6"],
        description: "אפליקציה נפרדת מבוססת Expo, חולקת קוד React עם ה-Web.",
      },
    ],
  },
  {
    label: "שכבת שירותים",
    hint: ".NET 10 · ארכיטקטורת Microservices",
    items: [
      {
        title: "Identity.Api",
        chips: [".NET 10", "JWT Bearer 10.0.9", "EF Core + Npgsql"],
        description: "אימות והרשאות — JWT חתום בזוג מפתחות RSA, תפקידים: Attendee / Organizer / Admin.",
      },
      {
        title: "Events.Api",
        chips: [".NET 10", "QRCoder 1.6.0", "OpenAI 2.12.0", "EF Core + Npgsql"],
        description: "ניהול אירועים, הרשמות וצ׳ק-אין; הפקת כרטיסי QR; המלצות מותאמות אישית דרך OpenAI.",
      },
    ],
  },
  {
    label: "שכבת תוכן",
    hint: "Headless CMS",
    items: [
      {
        title: "Umbraco",
        chips: ["Headless", "Management API"],
        description: "ניהול תוכן אירועים וקטגוריות; מסתנכרן עם Events.Api דרך Sync Key ייעודי בכל כיוון.",
      },
    ],
  },
  {
    label: "נתונים ותשתית",
    hint: "מסד נתונים והרצה",
    items: [
      {
        title: "PostgreSQL 17",
        chips: ["auraevents_identity", "auraevents_events", "auraevents_cms"],
        description: "שלושה מסדי נתונים נפרדים (לא סכמות בתוך מסד אחד) על אותו instance — כל שירות עם ה-DB שלו.",
      },
      {
        title: "Docker Compose",
        chips: ["postgres", "identity-api", "events-api", "umbraco"],
        description: "מתזמר את כל השירותים; תקשורת בין-שירותית מאובטחת ב-Sync Keys ייעודיים לכל ערוץ.",
      },
    ],
  },
];

const SOURCES = [
  "frontend/web-app/package.json",
  "mobile/mobile-app/package.json",
  "src/services/Identity.Api/Identity.Api.csproj",
  "src/services/Events.Api/Events.Api.csproj",
  "docker-compose.yml",
  "deploy/postgres/init-databases.sql",
];

export default function TechStackPage() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Tech Stack</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">הסטאק הטכנולוגי</h1>
        <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
          כל שורה כאן נבדקה מול קוד המקור בפועל — קבצי package.json, csproj ו-docker-compose.yml — ולא מסתמכת על
          ניחוש.
        </p>

        <div className="mt-14 flex flex-col gap-14">
          {LAYERS.map((layer) => (
            <div key={layer.label}>
              <div className="flex items-baseline gap-3 border-b border-border pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">{layer.label}</h2>
                <span className="text-sm text-muted-foreground">{layer.hint}</span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {layer.items.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-surface p-6">
                    <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                    <div className="mt-3 flex flex-wrap gap-1.5" dir="ltr">
                      {item.chips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-md border border-border bg-surface-muted px-2 py-0.5 font-mono text-xs text-foreground"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-surface to-surface p-6">
          <h3 className="text-sm font-semibold text-foreground">מקורות שנבדקו</h3>
          <div className="mt-3 flex flex-wrap gap-1.5" dir="ltr">
            {SOURCES.map((source) => (
              <span
                key={source}
                className="rounded-md border border-border bg-surface-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
              >
                {source}
              </span>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
