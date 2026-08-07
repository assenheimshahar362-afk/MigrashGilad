/**
 * §10.1 loading state: a skeleton grid, not a spinner. The shape of what is
 * coming is already known — showing it avoids the layout jump, and a spinner on
 * a schedule tells the visitor nothing.
 */
export default function Loading() {
  return (
    <div className="pitch-field" aria-busy="true" aria-live="polite">
      <span className="sr-only">טוען…</span>

      <div className="flex border-b border-[--grid-line]">
        <div className="w-11 shrink-0 pitch-touchline" />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex-1 py-2 text-center">
            <div className="skeleton-on-field mx-auto h-3 w-4 rounded" />
            <div className="skeleton-on-field mx-auto mt-1 h-3 w-5 rounded" />
          </div>
        ))}
      </div>

      <div className="flex">
        <div className="w-11 shrink-0 pitch-touchline" />
        {Array.from({ length: 7 }, (_, day) => (
          <div key={day} className="relative h-[60vh] min-h-[26rem] flex-1 pitch-daydivider">
            {Array.from({ length: 17 }, (_, hour) => (
              <div
                key={hour}
                className="pitch-hourline absolute inset-x-0"
                style={{ top: `${(hour / 17) * 100}%` }}
              />
            ))}
            {day % 2 === 0 ? (
              <div
                className="skeleton-on-field absolute inset-x-0.5"
                style={{ top: `${20 + day * 6}%`, height: '12%' }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
