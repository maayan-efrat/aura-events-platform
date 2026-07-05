import { Suspense } from "react";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { EventListing } from "@/components/events/EventListing";
import { EventListingSkeleton } from "@/components/events/EventListingSkeleton";
import { getCurrentUser } from "@/lib/backend-fetch";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string | string[] }>;
}) {
  const [resolvedSearchParams, user] = await Promise.all([searchParams, getCurrentUser()]);
  const categoryId = Array.isArray(resolvedSearchParams.categoryId)
    ? resolvedSearchParams.categoryId[0]
    : resolvedSearchParams.categoryId;

  return (
    <div className="flex flex-1 flex-col">
      <Hero />

      {user && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-12 sm:px-6 lg:px-8">
          <Link
            href="/recommendations"
            className="flex items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-surface to-surface p-6 transition-colors hover:border-primary/40"
          >
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <span aria-hidden="true">✨</span>
                המלצות מותאמות אישית
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                מבוסס על היסטוריית ההרשמות שלך ותחומי העניין שתשתפו — לחצו לצפייה
              </p>
            </div>
            <span aria-hidden="true" className="text-xl font-semibold text-primary">
              ←
            </span>
          </Link>
        </div>
      )}

      <section id="events" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            אירועים קרובים
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">
            ניהול חכם של אירועים, מונע תוכן עריכתי מ-Umbraco וזמינות חיה מ-Events.Api.
          </p>
        </div>

        <Suspense fallback={<EventListingSkeleton />}>
          <EventListing categoryId={categoryId} />
        </Suspense>
      </section>

      <section id="about" className="scroll-mt-20 border-t border-border bg-surface/40 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">אודות AuraEvents</h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">
            AuraEvents היא פלטפורמה לניהול אירועים המחברת בין מארגנים למשתתפים: תוכן עריכתי המתפרסם
            ב-Umbraco, זמינות ומעקב הרשמות בזמן אמת, והמלצות אירועים מותאמות אישית מבוססות AI —
            הכול במקום אחד.
          </p>
        </div>
      </section>

      <section id="contact" className="scroll-mt-20 border-t border-border px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">צור קשר</h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">
            שאלות, פידבק או רעיונות לשיתוף פעולה? נשמח לשמוע מכם.
          </p>
          <a
            href="mailto:hello@auraevents.local"
            className="mt-4 inline-block text-lg font-semibold text-primary hover:text-primary-hover"
            dir="ltr"
          >
            hello@auraevents.local
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
