/** Shows on the Sobrus page what the full-history import does: the page goes dark except the element
 *  being used (date de début, date de fin, « Télécharger en CSV »), the dates are written in the fields,
 *  the button pulses. Purely visual: the export itself is read from its URL (`fullExport.ts`). */

const START_INPUT = "#start_date";
const END_INPUT = "#end_date";
const DOWNLOAD_BUTTON = 'button[data-testid="télécharger_en_csv"]';

const SPOT_STYLE_ID = "__pharmagest-spotlight";
const SPOT_CLASS = "__pharmagest-spot";
const PULSE_CLASS = "__pharmagest-pulse";

/** Lets the user see each step (a few hundred ms). */
export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ensureStyle() {
  if (document.getElementById(SPOT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = SPOT_STYLE_ID;
  style.textContent = `
    .${SPOT_CLASS} { position: relative !important; z-index: 2147483640 !important; border-radius: 8px;
      outline: 3px solid #0e9e8c !important; outline-offset: 3px;
      box-shadow: 0 0 0 100vmax rgba(18, 26, 24, 0.55) !important; transition: box-shadow .25s, outline-color .25s; }
    .${PULSE_CLASS} { animation: __pharmagest_pulse .5s ease-out 2; }
    @keyframes __pharmagest_pulse { 0% { transform: scale(1); } 50% { transform: scale(.94); } 100% { transform: scale(1); } }
  `;
  document.head.appendChild(style);
}

let lit: Element | null = null;

/** Darkens the page except `el` (nothing to light: the page stays as is). */
function light(el: Element | null) {
  lit?.classList.remove(SPOT_CLASS, PULSE_CLASS);
  lit = el;
  if (!el) return;
  ensureStyle();
  el.classList.add(SPOT_CLASS);
  el.scrollIntoView({ block: "center", behavior: "smooth" });
}

/** Writes `value` in a field of Sobrus' React form (its own setter, so the page sees the change). */
function fill(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Step « dates »: each field lit, then filled. */
export async function showDates(start: string, end: string): Promise<void> {
  for (const [selector, value] of [
    [START_INPUT, start],
    [END_INPUT, end],
  ] as const) {
    const input = document.querySelector<HTMLInputElement>(selector);
    light(input);
    await pause(350);
    if (input) fill(input, value);
    await pause(350);
  }
}

/** Step « click »: the download button lit and pulsing. */
export async function showClick(): Promise<void> {
  const button = document.querySelector(DOWNLOAD_BUTTON);
  light(button);
  button?.classList.add(PULSE_CLASS);
  await pause(800);
}

/** Back to the page as it is. */
export const clearSpotlight = () => light(null);
