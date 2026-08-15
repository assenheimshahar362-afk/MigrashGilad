import { describe, expect, it, vi } from 'vitest';
import { setAppBadgeCount, supportsAppBadge } from '@/lib/app-badge';

/**
 * The badge is decoration on top of a notification that already arrived, so the
 * governing requirement is that it can never break its caller — a dashboard
 * render or, worse, a service worker's push handler, where a rejection would
 * cost the notification itself.
 */
function fakeNavigator() {
  return {
    setAppBadge: vi.fn(async () => {}),
    clearAppBadge: vi.fn(async () => {}),
  };
}

describe('setAppBadgeCount', () => {
  it('sets the count when requests are waiting', async () => {
    const nav = fakeNavigator();
    await setAppBadgeCount(3, nav);

    expect(nav.setAppBadge).toHaveBeenCalledWith(3);
    expect(nav.clearAppBadge).not.toHaveBeenCalled();
  });

  it('CLEARS at zero rather than badging a 0', async () => {
    // setAppBadge(0) is specified to show a dot with no number on some
    // platforms, which reads as "something is waiting" — the opposite of what
    // an empty queue means.
    const nav = fakeNavigator();
    await setAppBadgeCount(0, nav);

    expect(nav.clearAppBadge).toHaveBeenCalled();
    expect(nav.setAppBadge).not.toHaveBeenCalled();
  });

  it('does not throw where the API does not exist', async () => {
    // A desktop tab, an uninstalled PWA, iOS below 16.4 — all ordinary.
    await expect(setAppBadgeCount(2, {})).resolves.toBeUndefined();
    await expect(setAppBadgeCount(2, undefined)).resolves.toBeUndefined();
  });

  it('swallows a rejection from the platform', async () => {
    // Permission revoked between render and call: must not take the caller down.
    const nav = {
      setAppBadge: vi.fn(async () => {
        throw new Error('NotAllowedError');
      }),
    };
    await expect(setAppBadgeCount(1, nav)).resolves.toBeUndefined();
    expect(nav.setAppBadge).toHaveBeenCalled();
  });
});

describe('supportsAppBadge', () => {
  it('detects presence and absence', () => {
    expect(supportsAppBadge(fakeNavigator())).toBe(true);
    expect(supportsAppBadge({})).toBe(false);
    expect(supportsAppBadge(undefined)).toBe(false);
  });
});
