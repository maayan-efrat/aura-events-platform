"use client";

import { useState } from "react";
import type { Category } from "@/lib/types";

const inlineInputClassName =
  "h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:border-primary";

export function CategoryTreePicker({
  categories: initialCategories,
  selectedIds,
  onChange,
}: {
  categories: Category[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [creatingUnder, setCreatingUnder] = useState<string | "top" | null>(null);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const topLevel = categories.filter((c) => c.parentId === null);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  function startCreating(target: string | "top") {
    setCreatingUnder(target);
    setNewName("");
    setCreateError(null);
  }

  function cancelCreating() {
    setCreatingUnder(null);
    setNewName("");
    setCreateError(null);
  }

  async function handleCreate(parentId: string | null) {
    if (!newName.trim()) return;
    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), parentId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setCreateError(data.error?.message ?? "יצירת הקטגוריה נכשלה.");
        return;
      }

      const created = data as Category;
      setCategories((current) => [...current, created]);
      onChange([...selectedIds, created.categoryId]);
      cancelCreating();
    } catch {
      setCreateError("לא ניתן להתחבר לשרת. נסו שוב מאוחר יותר.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">קטגוריות</span>

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {topLevel.map((top) => {
          const subs = childrenOf(top.categoryId);
          return (
            <details key={top.categoryId} className="group px-3 py-1">
              <summary className="flex cursor-pointer list-none items-center gap-2 py-1.5 [&::-webkit-details-marker]:hidden">
                <span className="inline-block w-3 text-muted-foreground transition-transform group-open:rotate-90">›</span>
                <label className="flex flex-1 items-center gap-2 text-sm font-medium text-foreground" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.includes(top.categoryId)} onChange={() => toggle(top.categoryId)} />
                  {top.name}
                </label>
              </summary>

              <div className="me-5 flex flex-col gap-1.5 border-e-2 border-border pe-3 pb-2 ps-0">
                {subs.map((sub) => (
                  <label key={sub.categoryId} className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={selectedIds.includes(sub.categoryId)} onChange={() => toggle(sub.categoryId)} />
                    {sub.name}
                  </label>
                ))}

                {creatingUnder === top.categoryId ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="שם תת-קטגוריה חדשה"
                      className={inlineInputClassName}
                    />
                    <button
                      type="button"
                      disabled={isCreating}
                      onClick={() => handleCreate(top.categoryId)}
                      className="text-sm font-semibold text-primary hover:text-primary-hover disabled:opacity-50"
                    >
                      הוספה
                    </button>
                    <button type="button" onClick={cancelCreating} className="text-sm text-muted-foreground">
                      ביטול
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startCreating(top.categoryId)}
                    className="w-fit text-xs font-semibold text-primary hover:text-primary-hover"
                  >
                    + תת-קטגוריה חדשה
                  </button>
                )}
              </div>
            </details>
          );
        })}

        <div className="px-3 py-2">
          {creatingUnder === "top" ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="שם קטגוריה ראשית חדשה"
                className={inlineInputClassName}
              />
              <button
                type="button"
                disabled={isCreating}
                onClick={() => handleCreate(null)}
                className="text-sm font-semibold text-primary hover:text-primary-hover disabled:opacity-50"
              >
                הוספה
              </button>
              <button type="button" onClick={cancelCreating} className="text-sm text-muted-foreground">
                ביטול
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => startCreating("top")}
              className="text-sm font-semibold text-primary hover:text-primary-hover"
            >
              + קטגוריה ראשית חדשה
            </button>
          )}
        </div>
      </div>

      {createError && <p className="text-sm text-error">{createError}</p>}
    </div>
  );
}
