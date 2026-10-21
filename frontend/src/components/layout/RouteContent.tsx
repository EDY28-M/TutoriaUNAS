import { useLayoutEffect, useRef } from 'react';
import type { SyntheticEvent } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

/** Contenido sin animaciones; el shell y los formularios permanecen montados. */
export function RouteContent() {
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    ref.current?.style.removeProperty('min-height');
  }, [pathname]);

  function preserveViewport(event: SyntheticEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest('[role="tab"], button[aria-pressed], .segmented a');
    if (!control || !ref.current?.contains(control)) return;
    // Mantiene solo el espacio necesario para que una vista más corta no recorte el scroll actual.
    const height =
      window.scrollY > 0 ? Math.max(0, innerHeight - ref.current.getBoundingClientRect().top) : 0;
    ref.current.style.minHeight = height ? `${height}px` : '';
  }

  return (
    <div
      ref={ref}
      className="workspace__page"
      onClickCapture={preserveViewport}
      onKeyDownCapture={(event) => {
        if (['Enter', ' ', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
          preserveViewport(event);
      }}
    >
      <Outlet />
    </div>
  );
}
