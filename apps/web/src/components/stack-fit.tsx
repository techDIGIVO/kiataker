"use client";

import { useEffect } from "react";

/**
 * Makes the scroll-stack safe for any content: a section that is taller than the viewport
 * scrolls normally (marked ".tall") instead of pinning, so nothing is ever cut off. Short
 * sections keep the Mainstack-style pin-and-replace behaviour.
 */
export function StackFit() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".stack-item"));
    if (items.length === 0) return;

    const measure = () => {
      const vh = window.innerHeight;
      for (const el of items) {
        const wasTall = el.classList.contains("tall");
        // Temporarily neutralise to read the natural height.
        if (wasTall) el.classList.remove("tall");
        const section = el.firstElementChild as HTMLElement | null;
        const h = section ? section.scrollHeight : el.scrollHeight;
        // Leave headroom; if it does not comfortably fit, let it scroll normally.
        if (h > vh - 24) el.classList.add("tall");
        else el.classList.remove("tall");
      }
    };

    measure();
    window.addEventListener("resize", measure);
    const t = window.setTimeout(measure, 600); // after fonts/images settle
    return () => {
      window.removeEventListener("resize", measure);
      window.clearTimeout(t);
    };
  }, []);

  return null;
}
