import { Suspense } from "react";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { EventListing } from "@/components/events/EventListing";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />

      <section id="events" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            אירועים קרובים
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">
            ניהול חכם של אירועים, מונע תוכן עריכתי מ-Umbraco וזמינות חיה מ-Events.Api.
          </p>
        </div>

        <Suspense
          fallback={<p className="text-center text-muted-foreground">טוען אירועים...</p>}
        >
          <EventListing />
        </Suspense>
      </section>

      <Footer />
    </div>
  );
}
