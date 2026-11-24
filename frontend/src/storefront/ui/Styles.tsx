/** Every model's fonts + motion + buttons, in one `<style>` (the preview and the downloaded site both work without the
 *  app's stylesheet). Classes start with `sf-`; every animation stops for « reduce motion ». */

const FONTS =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Fraunces:wght@500;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&family=Nunito:wght@400;600;700;800&family=Playfair+Display:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Spectral:wght@400;500&display=swap";

export function StoreStyles() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FONTS} precedence="default" />
      <style>{`
        @keyframes sf-zoom { from{transform:scale(1)} to{transform:scale(1.12)} }
        @keyframes sf-marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes sf-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes sf-morph {
          0%,100% { border-radius:62% 38% 46% 54% / 55% 44% 56% 45% }
          50% { border-radius:40% 60% 58% 42% / 42% 58% 42% 58% }
        }
        @keyframes sf-shine { from{background-position:-200% 0} to{background-position:200% 0} }
        @keyframes sf-bloomA { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(2%,-3%,0) scale(1.12)} }
        @keyframes sf-bloomB { 0%,100%{transform:translate3d(0,0,0) scale(1.05)} 50%{transform:translate3d(-3%,2%,0) scale(1)} }
        @keyframes sf-drift { 0%,100%{transform:translate3d(0,0,0) rotate(0deg)} 50%{transform:translate3d(24px,-30px,0) rotate(20deg)} }

        .sf-zoom { animation: sf-zoom 22s ease-in-out infinite alternate }
        .sf-marquee { animation: sf-marquee 40s linear infinite }
        .sf-marquee:hover { animation-play-state: paused }
        .sf-bob { animation: sf-bob 5s ease-in-out infinite }
        .sf-morph { animation: sf-morph 14s ease-in-out infinite }
        .sf-shine {
          background: linear-gradient(90deg, transparent, var(--sf-primary), transparent) 0 0 / 200% 100%;
          animation: sf-shine 4s linear infinite;
        }
        .sf-bloom { position:absolute; border-radius:50%; filter:blur(48px); opacity:.55 }
        .sf-bloomA { animation: sf-bloomA 9s ease-in-out infinite }
        .sf-bloomB { animation: sf-bloomB 11s ease-in-out infinite }
        .sf-drift { opacity:.55; animation: sf-drift 15s ease-in-out infinite }

        .sf-cta, .sf-ghost {
          display:inline-flex; align-items:center; justify-content:center; gap:9px; cursor:pointer;
          font-weight:600; font-size:15px; padding:13px 24px; border-radius:var(--sf-button-radius);
          text-decoration:none; transition: transform .25s cubic-bezier(.2,.7,.2,1), box-shadow .25s, background .25s;
        }
        .sf-cta {
          color:var(--sf-on-primary); background:var(--sf-primary);
          box-shadow:0 10px 26px -10px color-mix(in oklab, var(--sf-primary), transparent 35%);
        }
        .sf-cta:hover { transform:translateY(-2px); box-shadow:0 16px 34px -10px color-mix(in oklab, var(--sf-primary), transparent 25%) }
        .sf-ghost { color:inherit; border:1.5px solid currentColor }
        .sf-ghost:hover { transform:translateY(-2px); background:color-mix(in oklab, currentColor, transparent 92%) }
        .sf-cta:active, .sf-ghost:active { transform:translateY(0) }

        .sf-card { transition: transform .35s cubic-bezier(.2,.7,.2,1), box-shadow .35s }
        .sf-card:hover { transform:translateY(-6px) }
        .sf-card img { transition: transform .6s cubic-bezier(.2,.7,.2,1) }
        .sf-card:hover img { transform:scale(1.06) }

        @media (prefers-reduced-motion: reduce) {
          .sf-zoom, .sf-marquee, .sf-bob, .sf-morph, .sf-shine, .sf-bloomA, .sf-bloomB, .sf-drift { animation:none !important }
          .sf-card, .sf-card img, .sf-cta, .sf-ghost { transition:none !important }
        }
      `}</style>
    </>
  );
}
