import messages from '@/messages/he.json';

export type MessageKey = keyof typeof messages;

/**
 * The whole product is Hebrew, RTL, single-locale (§1.4). This is deliberately
 * not a full i18n runtime — there is one catalogue, resolved synchronously, so
 * that server components can call it without a provider.
 *
 * Every Hebrew string in the UI must come from here (§0.4). If a string is
 * missing, the key itself is rendered, which is loud enough to be caught in
 * review but never blocks a page from rendering.
 */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const raw: string = messages[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** Narrow an arbitrary string to a known key, for dynamic lookups. */
export function isMessageKey(key: string): key is MessageKey {
  return key in messages;
}

/** Resolve a dynamic key, falling back to a generic message. */
export function tDynamic(key: string, fallback: MessageKey, vars?: Record<string, string | number>) {
  return isMessageKey(key) ? t(key, vars) : t(fallback, vars);
}
