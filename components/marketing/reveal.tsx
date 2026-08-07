'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Fade-and-rise on scroll into view.
 *
 * The element starts VISIBLE and only hides itself in an effect, once the
 * observer is known to be running. A reveal that starts hidden and depends on
 * JavaScript to un-hide it leaves the page blank for anyone whose script failed
 * — and blank to most crawlers.
 *
 * `once: true` in effect: the observer disconnects after the first intersection,
 * so scrolling back up never replays it. Re-animating content someone has
 * already read is the single most irritating thing this pattern can do.
 */
export function Reveal({
  children,
  className,
  as: Tag = 'div',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** Milliseconds. Use sparingly — only to stagger siblings. */
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<'idle' | 'pending' | 'shown'>('idle');

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Respect the OS setting before doing anything: under `reduce` the content
    // simply stays where it is.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setState('shown');
      return;
    }

    // Already on screen at mount (above the fold): show it without the observer,
    // so the first paint is not a flash of hidden content.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) {
      setState('shown');
      return;
    }

    setState('pending');

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setState('shown');
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal={state === 'idle' ? undefined : state}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}
