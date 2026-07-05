"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AuraUser } from "@/components/auth/AuthProvider";

export function UserMenu({
  user,
  isOrganizer,
  onLogout,
}: {
  user: AuraUser;
  isOrganizer: boolean;
  onLogout: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const itemClassName = "block px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-muted";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1.5 ps-1 pe-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {user.firstName.charAt(0)}
        </span>
        שלום, {user.firstName}
        <svg
          className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute end-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
          <Link href="/dashboard" role="menuitem" className={itemClassName} onClick={() => setIsOpen(false)}>
            האזור האישי
          </Link>
          {isOrganizer && (
            <Link href="/organizer/new-event" role="menuitem" className={itemClassName} onClick={() => setIsOpen(false)}>
              ניהול אירועים
            </Link>
          )}
          <Link href="/settings" role="menuitem" className={itemClassName} onClick={() => setIsOpen(false)}>
            הגדרות
          </Link>
          <div className="border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className={cn(itemClassName, "w-full text-start text-error")}
          >
            התנתקות
          </button>
        </div>
      )}
    </div>
  );
}
