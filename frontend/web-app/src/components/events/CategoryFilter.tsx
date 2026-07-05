"use client";

import { useRouter, usePathname } from "next/navigation";
import type { Category } from "@/lib/types";

const selectClassName =
  "h-11 rounded-xl border border-border bg-surface px-4 text-sm text-foreground focus-visible:border-primary";

export function CategoryFilter({ categories, selectedCategoryId }: { categories: Category[]; selectedCategoryId?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(categoryId: string) {
    router.push(categoryId ? `${pathname}?categoryId=${categoryId}#events` : `${pathname}#events`);
  }

  return (
    <div className="mb-8 flex items-center gap-3">
      <label htmlFor="category-filter" className="text-sm font-medium text-foreground">
        סינון לפי קטגוריה
      </label>
      <select
        id="category-filter"
        className={selectClassName}
        value={selectedCategoryId ?? ""}
        onChange={(event) => handleChange(event.target.value)}
      >
        <option value="">כל הקטגוריות</option>
        {categories.map((category) => (
          <option key={category.categoryId} value={category.categoryId}>
            {category.name}
          </option>
        ))}
      </select>
    </div>
  );
}
