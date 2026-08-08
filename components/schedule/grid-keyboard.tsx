'use client';

import { useCallback, useRef } from 'react';

/**
 * A11Y-4: the schedule grid is keyboard operable — arrow keys move between the
 * free, requestable slots. Existing bookings are not part of this scope at
 * all (they carry no `data-grid-cell`): the public calendar is view-only, so
 * there is nothing for Enter to do on one and nothing for a keyboard user to
 * tab into.
 *
 * Implemented as a scope around the grid rather than per-cell state: cells mark
 * themselves with `data-grid-cell`, `data-grid-col` (the day, 0..6) and
 * `data-grid-row` (the hour slot). Movement is computed from those attributes
 * at keydown time, so the grid can be entirely server-rendered and this adds no
 * props to any cell.
 *
 * Direction is mirrored: in RTL, ArrowLeft moves to the NEXT day. The browser
 * does not do this for us on a custom grid.
 */
export function GridKeyboardScope({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;

    const container = ref.current;
    const active = document.activeElement;
    if (!container || !(active instanceof HTMLElement) || !active.dataset.gridCell) return;

    const cells = Array.from(
      container.querySelectorAll<HTMLElement>('[data-grid-cell]'),
    );

    const col = Number(active.dataset.gridCol ?? 0);
    const row = Number(active.dataset.gridRow ?? 0);

    let nextCol = col;
    let nextRow = row;

    switch (event.key) {
      case 'ArrowUp':
        nextRow = row - 1;
        break;
      case 'ArrowDown':
        nextRow = row + 1;
        break;
      // RTL: left is forwards through the week, right is backwards.
      case 'ArrowLeft':
        nextCol = col + 1;
        break;
      case 'ArrowRight':
        nextCol = col - 1;
        break;
      case 'Home':
        nextRow = 0;
        break;
      case 'End':
        nextRow = Number.MAX_SAFE_INTEGER;
        break;
    }

    const inColumn = cells
      .filter((cell) => Number(cell.dataset.gridCol ?? 0) === nextCol)
      .sort((a, b) => Number(a.dataset.gridRow ?? 0) - Number(b.dataset.gridRow ?? 0));

    if (inColumn.length === 0) return;

    // Land on the nearest slot in the target column rather than refusing to
    // move: columns have different numbers of cells once events are laid in.
    const target =
      inColumn.reduce<HTMLElement | null>((best, cell) => {
        const distance = Math.abs(Number(cell.dataset.gridRow ?? 0) - nextRow);
        const bestDistance = best ? Math.abs(Number(best.dataset.gridRow ?? 0) - nextRow) : Infinity;
        return distance < bestDistance ? cell : best;
      }, null) ?? inColumn[0];

    if (target) {
      event.preventDefault();
      target.focus();
    }
  }, []);

  return (
    <div ref={ref} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}
