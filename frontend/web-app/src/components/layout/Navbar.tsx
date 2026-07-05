"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/auth/AuthProvider";
import { UserMenu } from "@/components/layout/UserMenu";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#events", label: "אירועים" },
  { href: "/dashboard#recommendations", label: "המלצות AI" },
  { href: "/#about", label: "אודות" },
  { href: "/#contact", label: "צור קשר" },
];

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const { user, logout } = useAuth();
  const isOrganizer = Boolean(user?.roles.includes("Organizer") || user?.roles.includes("Admin"));

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md print:hidden">
      <nav
        aria-label="ניווט ראשי"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-foreground transition-colors hover:text-primary"
        >
          Aura<span className="text-primary">Events</span>
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <UserMenu user={user} isOrganizer={isOrganizer} onLogout={() => logout()} />
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>
                התחברות
              </Button>
              <Button variant="primary" size="sm" onClick={() => router.push("/register")}>
                הרשמה
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground md:hidden"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          aria-label={isMenuOpen ? "סגירת תפריט ניווט" : "פתיחת תפריט ניווט"}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {isMenuOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </nav>

      <div
        id="mobile-menu"
        className={cn(
          "overflow-hidden border-t border-border transition-[max-height] duration-300 ease-in-out md:hidden",
          isMenuOpen ? "max-h-96" : "max-h-0",
        )}
      >
        <ul className="flex flex-col gap-1 px-4 py-4">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
          {user && (
            <>
              <li>
                <Link
                  href="/dashboard#my-events"
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                >
                  האירועים שלי
                </Link>
              </li>
              {isOrganizer && (
                <li>
                  <Link
                    href="/organizer/new-event"
                    onClick={() => setIsMenuOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                  >
                    ניהול אירועים
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href="/settings"
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                >
                  הגדרות
                </Link>
              </li>
            </>
          )}
          <li className="mt-2 flex gap-3 px-3">
            {user ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setIsMenuOpen(false);
                  logout();
                }}
              >
                התנתקות
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setIsMenuOpen(false);
                    router.push("/login");
                  }}
                >
                  התחברות
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setIsMenuOpen(false);
                    router.push("/register");
                  }}
                >
                  הרשמה
                </Button>
              </>
            )}
          </li>
        </ul>
      </div>
    </header>
  );
}
