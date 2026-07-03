"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/Button";

const TITLE_WORDS = ["עולם", "האירועים", "החכם", "שלך"];

export function Hero() {
  const shouldReduceMotion = useReducedMotion();
  const transitionDuration = shouldReduceMotion ? 0 : 0.6;

  const container: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: shouldReduceMotion ? 0 : 0.1, delayChildren: 0.1 },
    },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: transitionDuration, ease: "easeOut" },
    },
  };

  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-20 sm:px-6 sm:pt-28 lg:px-8">
      {/* Decorative glow blobs — purely visual, hidden from assistive tech */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden"
      >
        <div className="h-[36rem] w-[36rem] rounded-full bg-primary/30 blur-[120px]" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <motion.span
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: transitionDuration }}
          className="shadow-glow mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
        >
          <span aria-hidden="true">✨</span>
          המלצות מבוססות AI, מותאמות אישית עבורך
        </motion.span>

        <motion.h1
          variants={container}
          initial="hidden"
          animate="visible"
          className="text-balance text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl"
        >
          {TITLE_WORDS.map((word, index) => (
            <motion.span key={word} variants={item} className="inline-block me-3">
              {index === TITLE_WORDS.length - 1 ? (
                <span className="bg-gradient-to-l from-primary to-primary-glow bg-clip-text text-transparent">
                  {word}
                </span>
              ) : (
                word
              )}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: transitionDuration, delay: shouldReduceMotion ? 0 : 0.45 }}
          className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground"
        >
          AuraEvents מחברת בין מארגני אירועים למשתתפים, עם ניהול חכם, המלצות מותאמות אישית
          ותוכן שיווקי שנוצר אוטומטית — הכול במקום אחד.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: transitionDuration, delay: shouldReduceMotion ? 0 : 0.6 }}
          className="mt-10 flex flex-col gap-4 sm:flex-row"
        >
          <Button size="lg">גלו אירועים קרובים</Button>
          <Button variant="outline" size="lg">
            אני מארגן/ת אירוע
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
