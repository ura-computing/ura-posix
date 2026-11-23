/** Lumière ambient animations + shared CSS utility classes.
 *  Injected inline (single <style>) so /preview + editor-inline both work
 *  without touching the global stylesheet. Scoped by class prefix `.lum-*`. */

export function LumiereStyles() {
  return (
    <style>{`
      @keyframes lum-bloomA { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(2%,-3%,0) scale(1.12)} }
      @keyframes lum-bloomB { 0%,100%{transform:translate3d(0,0,0) scale(1.05)} 50%{transform:translate3d(-3%,2%,0) scale(1)} }
      @keyframes lum-drift1 { 0%,100%{transform:translate3d(0,0,0) rotate(0deg)} 50%{transform:translate3d(26px,-34px,0) rotate(22deg)} }
      @keyframes lum-drift2 { 0%,100%{transform:translate3d(0,0,0) rotate(0deg)} 50%{transform:translate3d(-30px,-22px,0) rotate(-18deg)} }
      @keyframes lum-drift3 { 0%,100%{transform:translate3d(0,0,0) rotate(0deg)} 50%{transform:translate3d(18px,28px,0) rotate(14deg)} }
      @keyframes lum-bob    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }

      .lum-bloom { position:absolute; border-radius:50%; filter:blur(48px); opacity:.55; will-change:transform }
      .lum-bloomA { animation: lum-bloomA 9s ease-in-out infinite }
      .lum-bloomB { animation: lum-bloomB 11s ease-in-out infinite }
      .lum-leaf { opacity:.55 }
      .lum-leaf1 { animation: lum-drift1 14s ease-in-out infinite }
      .lum-leaf2 { animation: lum-drift2 17s ease-in-out infinite }
      .lum-leaf3 { animation: lum-drift3 12s ease-in-out infinite }
      .lum-bob   { animation: lum-bob 4.5s ease-in-out infinite }

      .lum-cta {
        position:relative; display:inline-flex; align-items:center; gap:9px;
        font-weight:600; font-size:15px; padding:14px 24px; border-radius:9999px;
        color:#fff; background:linear-gradient(120deg, var(--lum-primary), color-mix(in oklab, var(--lum-primary), white 15%));
        box-shadow:0 10px 26px -8px color-mix(in oklab, var(--lum-primary), transparent 40%);
        transition: transform .25s cubic-bezier(.2,.7,.2,1), box-shadow .25s;
        cursor:pointer; text-decoration:none;
      }
      .lum-cta:hover { transform: translateY(-2px); box-shadow:0 16px 34px -8px color-mix(in oklab, var(--lum-primary), transparent 30%); }
      .lum-cta:active { transform: translateY(0); }

      @media (prefers-reduced-motion: reduce) {
        .lum-bloom, .lum-leaf, .lum-bob, .lum-bloomA, .lum-bloomB, .lum-leaf1, .lum-leaf2, .lum-leaf3 { animation: none !important; }
      }
    `}</style>
  );
}
