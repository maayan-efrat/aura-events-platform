import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    title: "מוצר",
    links: [
      { href: "#events", label: "אירועים" },
      { href: "#recommendations", label: "המלצות AI" },
      { href: "#pricing", label: "תמחור" },
    ],
  },
  {
    title: "חברה",
    links: [
      { href: "#about", label: "אודות" },
      { href: "#careers", label: "קריירה" },
      { href: "#contact", label: "צור קשר" },
      { href: "/tech-stack", label: "הסטאק הטכנולוגי" },
    ],
  },
  {
    title: "משפטי",
    links: [
      { href: "#privacy", label: "פרטיות" },
      { href: "#terms", label: "תנאי שימוש" },
      { href: "#accessibility", label: "הצהרת נגישות" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
              Aura<span className="text-primary">Events</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              עולם האירועים החכם — פלטפורמה המחברת בין מארגנים למשתתפים, מונעת בינה מלאכותית.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} AuraEvents. כל הזכויות שמורות.
          </p>
          <p className="text-sm text-muted-foreground">נבנה עם ❤ בישראל</p>
        </div>
      </div>
    </footer>
  );
}
