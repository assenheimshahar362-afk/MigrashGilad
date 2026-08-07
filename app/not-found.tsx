import Link from 'next/link';
import { MapPinOff } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-[720px] flex-col items-center justify-center px-6 text-center"
    >
      <span
        aria-hidden
        className="flex size-16 items-center justify-center rounded-full bg-(--surface-sunken) text-(--ink-faint)"
      >
        <MapPinOff className="size-8" />
      </span>

      <h1 className="mt-5 text-h1">{t('error.not_found_title')}</h1>
      <Button asChild variant="secondary" className="mt-7">
        <Link href="/">{t('common.back_home')}</Link>
      </Button>
    </main>
  );
}
