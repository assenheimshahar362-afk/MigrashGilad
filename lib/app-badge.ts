/**
 * The number on the app icon — the thing WhatsApp, Gmail and Facebook put on
 * the home screen when something is waiting. Here it is the count of pending
 * booking requests, so an admin can tell there is something to decide without
 * opening anything.
 *
 * Two rules govern every call:
 *
 * 1. It is ALWAYS optional. The Badging API only exists in an installed PWA,
 *    and on iOS only from 16.4 and only once notification permission has been
 *    granted. A desktop browser tab has no icon to badge at all. Nothing here
 *    may throw or block on any of that — a missing badge is a missing nicety,
 *    never a broken dashboard.
 *
 * 2. Zero means CLEAR, not "show a zero". `setAppBadge(0)` is specified to show
 *    a dot with no number on some platforms, which reads as "something is
 *    waiting" — the exact opposite of what an empty queue means. Every caller
 *    would have to remember that, so it is handled once, here.
 */

/** The Badging API is missing from TypeScript's DOM and WebWorker libs, so the
 *  two methods are described here rather than cast at each call site. Both the
 *  window `Navigator` and a service worker's `WorkerNavigator` carry them. */
type BadgeCapableNavigator = {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function supportsAppBadge(nav: unknown = globalThis.navigator): boolean {
  return Boolean(nav && 'setAppBadge' in (nav as object));
}

/**
 * Set the icon badge to `count`, clearing it at zero. Never rejects.
 *
 * `nav` is injectable because the service worker calls this with its own
 * `WorkerNavigator` — the badge has to be settable from the push handler, which
 * is the whole point: the app is not open at that moment.
 */
export async function setAppBadgeCount(
  count: number,
  nav: unknown = globalThis.navigator,
): Promise<void> {
  const badge = nav as BadgeCapableNavigator | undefined;
  if (!badge) return;

  try {
    if (count > 0) {
      await badge.setAppBadge?.(count);
    } else {
      await badge.clearAppBadge?.();
    }
  } catch {
    // Permission not granted, not installed, or the platform simply has no
    // badge. All three are ordinary, and none of them is worth a log line on
    // every dashboard render.
  }
}
