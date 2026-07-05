import { cn } from "@/lib/utils";

/**
 * Renders the organizer's uploaded hero image when one exists; otherwise falls back to a
 * deterministic, on-brand gradient + icon per event, so every card still gets a distinct visual
 * even for events created without a photo.
 */
const GRADIENTS = [
  "from-primary/50 via-primary-glow/25 to-transparent",
  "from-primary-glow/50 via-primary/25 to-transparent",
  "from-primary/40 via-transparent to-primary-glow/40",
  "from-primary-glow/40 via-transparent to-primary/40",
];

const ICONS = ["🎉", "🎤", "🎨", "🎶", "✨", "🥂", "🍷", "🧪"];

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index++) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function EventCardVisual({ seed, imageUrl, className }: { seed: string; imageUrl?: string | null; className?: string }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external Umbraco media origin, not in next.config's image domains
      <img src={imageUrl} alt="" className={cn("object-cover", className)} />
    );
  }

  const hash = hashString(seed);
  const gradient = GRADIENTS[hash % GRADIENTS.length];
  const icon = ICONS[hash % ICONS.length];

  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-surface-muted", className)}>
      <div aria-hidden="true" className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
      <div aria-hidden="true" className="absolute -inset-10 rounded-full bg-primary/25 blur-3xl" />
      <span aria-hidden="true" className="relative text-5xl">
        {icon}
      </span>
    </div>
  );
}
