"use client";

import { useEffect, useRef, type ReactNode, type ElementType } from "react";

/**
 * Progressive-enhancement scroll reveal. Content is visible without JavaScript; once
 * mounted, it arms the hidden state and fades items in as they enter the viewport.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className = "",
  style,
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("reveal-armed");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            window.setTimeout(() => el.classList.add("is-visible"), delay);
            io.unobserve(el);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <Tag ref={ref} className={`reveal ${className}`} style={style}>
      {children}
    </Tag>
  );
}
