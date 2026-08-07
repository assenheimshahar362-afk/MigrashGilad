import Link from 'next/link';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-[720px] flex-col items-center justify-center px-6 text-center"
    >
      <h1 className="text-h1">{t('error.not_found_title')}</h1>
      <Button asChild variant="secondary" className="mt-6">
        <Link href="/">{t('common.back_home')}</Link>
      </Button>
    </main>
  );
}
