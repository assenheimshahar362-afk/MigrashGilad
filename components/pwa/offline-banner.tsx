'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { t } from '@/lib/i18n';

/**
 * §10.1 offline state: cached data plus a "מוצג מידע שנשמר במכשיר" bar.
 *
 * The bar is honest about what the visitor is looking at. The schedule they see
 * came out of the service-worker cache and may be up to a day old — at the
 * pitch gate that is far more useful than an error, but only if they know.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <p
      role="status"
      className="flex items-center gap-2 bg-ink-2 px-4 py-2 text-sm font-semibold text-white"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      {t('schedule.offline')}
    </p>
  );
}
