import { useEffect, useState } from 'react';

interface Viewport {
  /** Visible height in CSS pixels, or null before we know (and on old browsers). */
  height: number | null;
  /** How far the visible area has been pushed down inside the page. */
  offsetTop: number;
  /**
   * How much of the page the keyboard is covering, in CSS pixels. Part of the
   * tracked state rather than something callers work out for themselves: the
   * window fires no React update of its own, so anything derived from it
   * outside here goes stale without warning.
   */
  keyboardInset: number;
}

/**
 * The part of the screen the page can actually use right now, which on iOS is
 * not the same thing as the window.
 *
 * The keyboard there does not resize the window and does not shrink `100dvh`:
 * it covers them. To keep the focused field in sight Safari then scrolls the
 * page underneath it, and since our shell is exactly as tall as the window,
 * scrolling it up is the same as shoving the whole app behind the status bar —
 * header, sheet and all. Sizing the shell to the *visual* viewport instead
 * leaves nothing hidden under the keyboard, so Safari has nothing to scroll
 * out of the way and everything stays where it was put.
 */
export function useVisualViewport(): Viewport {
  const [v, setV] = useState<Viewport>({ height: null, offsetTop: 0, keyboardInset: 0 });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // Applied straight from the event rather than on the next animation frame:
    // a page that is not being shown paints no frames, so a frame-deferred
    // read would leave the shell sized for a viewport that is already gone —
    // and coming back to a stale height is the very jump this hook prevents.
    // Returning the previous object unchanged is what keeps the keyboard's
    // per-frame resize storm from turning into a re-render storm.
    const read = () => {
      // A viewport with no height is a page that is not being shown — a
      // backgrounded tab, a prerender. Sizing the shell to it blanks the app,
      // and if no further event arrives it stays blank. Keep the last real
      // measurement instead; it is still the right one when we come back.
      if (!(vv.height > 0)) return;
      // Measured against the LAYOUT viewport, deliberately not
      // `window.innerHeight`. Measured on an iPhone: while the keyboard
      // animates in, Safari briefly reports innerHeight as the shrunken
      // height too, so the last event of the animation computes an inset of
      // zero — and since nothing fires afterwards, that zero is what sticks.
      // documentElement.clientHeight is the layout viewport and stays put.
      const layout = document.documentElement.clientHeight || window.innerHeight;
      const next: Viewport = {
        height: vv.height,
        offsetTop: vv.offsetTop,
        keyboardInset: Math.max(0, layout - vv.height - vv.offsetTop),
      };
      setV((prev) =>
        prev.height === next.height &&
        prev.offsetTop === next.offsetTop &&
        prev.keyboardInset === next.keyboardInset
          ? prev
          : next,
      );
      // The shell covers exactly what is visible, so a scrolled document is
      // only ever Safari having tried to help. Put it back.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    // One more read once the keyboard has finished animating. Every value here
    // is sampled from a moving target, and the frame the last event lands on
    // is not necessarily the frame that tells the truth.
    let settle = 0;
    const readAndSettle = () => {
      read();
      window.clearTimeout(settle);
      settle = window.setTimeout(read, 400);
    };
    read();
    vv.addEventListener('resize', readAndSettle);
    vv.addEventListener('scroll', read);
    // Backstop. The visual viewport reports the keyboard, but it is not the
    // only thing that changes the height — rotating the phone and the URL bar
    // sliding away come through here, and a missed one leaves the shell sized
    // for a screen that no longer exists.
    window.addEventListener('resize', readAndSettle);
    window.addEventListener('orientationchange', readAndSettle);
    return () => {
      window.clearTimeout(settle);
      vv.removeEventListener('resize', readAndSettle);
      vv.removeEventListener('scroll', read);
      window.removeEventListener('resize', readAndSettle);
      window.removeEventListener('orientationchange', readAndSettle);
    };
  }, []);

  return v;
}
