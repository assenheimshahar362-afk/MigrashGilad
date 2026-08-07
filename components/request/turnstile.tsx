'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * FR-15: Cloudflare Turnstile in invisible mode.
 *
 * The widget script is the one third-party script the CSP allows (next.config).
 * When NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset the component resolves the token
 * immediately with a development placeholder, so the form is usable locally and
 * in Playwright without a Cloudflare account — the server side makes the
 * matching allowance, and only when its secret is also unset.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          appearance?: 'always' | 'execute' | 'interaction-only';
          size?: 'normal' | 'flexible' | 'invisible';
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const id = useId();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) {
      onToken('development-no-turnstile');
      return;
    }

    let cancelled = false;

    const render = () => {
      const container = containerRef.current;
      if (cancelled || !container || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(container, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        callback: onToken,
        'expired-callback': () => window.turnstile?.reset(widgetId.current ?? undefined),
      });
    };

    if (window.turnstile) {
      render();
    } else if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          render();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, onToken]);

  return <div ref={containerRef} id={`turnstile-${id}`} className="my-2" />;
}
