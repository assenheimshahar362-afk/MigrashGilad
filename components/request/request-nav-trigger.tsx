'use client';

import { useRequestModal } from '@/components/request/request-modal-context';

/**
 * Drop-in replacement for `<Link href="/#request">` wherever the booking
 * form used to be an anchor: the nav bar, the footer, the tab bar. Takes a
 * `className` so each caller keeps its own conditional styling (active
 * state, light/dark chrome, …) exactly as it did for the Link it replaces.
 */
export function RequestNavTrigger({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { openRequestModal } = useRequestModal();
  return (
    <button type="button" onClick={() => openRequestModal()} className={className}>
      {children}
    </button>
  );
}
