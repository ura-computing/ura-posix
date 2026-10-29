/** Records a ~2–3 min demo video of PharmaGest: no narration, only the app in action (a visible
 *  cursor, its clicks, typing, scrolling). Drives the running dev app (`make dev`, :5173) as the demo
 *  owner of `backend/scripts/seed.json`; nothing is created or deleted (dialogs are opened, then closed).
 *
 *  Run: cd e2e && node scripts/demo-video.mjs        → ~/Downloads/pharmagest-demo.webm
 */
import { readFileSync, renameSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = process.env.DEMO_URL ?? "http://localhost:5173";
const OUT = resolve(homedir(), "Downloads", "pharmagest-demo.webm");
const SIZE = { width: 1600, height: 900 };
const { owner } = JSON.parse(readFileSync(resolve(ROOT, "backend/scripts/seed.json"), "utf8"));

// A visible cursor + a ripple on each click (the recording has no system cursor).
const CURSOR = () => {
  const add = () => {
    const c = document.createElement("div");
    c.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: "fixed", left: "-50px", top: "-50px", zIndex: 2147483647, pointerEvents: "none" });
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => Object.assign(c.style, { left: `${e.clientX - 4}px`, top: `${e.clientY - 2}px` }), true);
    addEventListener(
      "mousedown",
      (e) => {
        const r = document.createElement("div");
        Object.assign(r.style, {
          position: "fixed", left: `${e.clientX - 18}px`, top: `${e.clientY - 18}px`, width: "36px", height: "36px",
          borderRadius: "50%", background: "rgba(20,184,166,.35)", border: "2px solid rgba(20,184,166,.9)",
          zIndex: 2147483646, pointerEvents: "none", transition: "transform .45s ease-out, opacity .45s ease-out",
        });
        document.body.appendChild(r);
        requestAnimationFrame(() => Object.assign(r.style, { transform: "scale(1.8)", opacity: "0" }));
        setTimeout(() => r.remove(), 500);
      },
      true,
    );
  };
  if (document.body) add();
  else addEventListener("DOMContentLoaded", add);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: resolve(ROOT, "e2e/.demo"), size: SIZE }, locale: "fr-FR" });
await context.addInitScript(CURSOR);
const page = await context.newPage();
page.setDefaultTimeout(8000);

// Every pause × SPEED (0.72: the whole tour ≈ 2 min 30).
const SPEED = Number(process.env.DEMO_SPEED ?? 0.72);
const wait = (ms) => page.waitForTimeout(ms * SPEED);
async function moveTo(loc) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 14 });
  await wait(220);
}
async function click(loc, after = 900) {
  await moveTo(loc);
  await loc.click();
  await wait(after);
}
async function type(loc, text, after = 900) {
  await click(loc, 200);
  await loc.pressSequentially(text, { delay: 70 });
  await wait(after);
}
/** Smooth scroll of the page's content (main), `px` down (negative = up). */
async function scroll(px, ms = 1600) {
  const main = page.locator("main").first();
  const b = (await main.count()) ? await main.boundingBox() : null;
  await page.mouse.move(b ? b.x + b.width / 2 : SIZE.width / 2, b ? b.y + b.height / 2 : SIZE.height / 2, { steps: 10 });
  const n = Math.max(1, Math.round(ms / 40));
  for (let i = 0; i < n; i++) {
    await page.mouse.wheel(0, px / n);
    await wait(40);
  }
  await wait(400);
}
const nav = (name) => click(page.getByRole("complementary").getByRole("link", { name, exact: true }), 1600);
/** One scene: a failing selector skips the rest of that scene, the video goes on. */
async function scene(name, fn) {
  try {
    await fn();
  } catch (e) {
    const m = String(e.message ?? e);
    console.log(`  · ${name}: ${(m.match(/waiting for (.*)/) ?? [, m.split("\n")[0]])[1]}`);
  }
}

await scene("connexion", async () => {
  await page.goto(`${BASE}/login`);
  await wait(1200);
  await type(page.locator('input[type="email"]'), owner.email, 300);
  await type(page.locator('input[autocomplete="current-password"]'), owner.password, 400);
  await click(page.locator('button[type="submit"]'), 2000);
  // The home page, then « Aller à mon espace ».
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 120), await wait(60);
  await wait(800);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -120), await wait(40);
  await click(page.getByRole("link", { name: "Aller à mon espace" }).or(page.getByRole("button", { name: "Aller à mon espace" })).first(), 2500);
});

await scene("tableau de bord", async () => {
  await click(page.getByRole("button", { name: "Pharmacie", exact: true }).first(), 1500);
  await click(page.getByRole("button", { name: "Parapharmacie", exact: true }).first(), 1500);
  await click(page.getByRole("button", { name: "Mixte", exact: true }).first(), 1200);
  await scroll(1400, 2400);
  await scroll(1200, 2000);
  await scroll(-2600, 1500);
});

await scene("ventes", async () => {
  await nav("Ventes");
  await click(page.locator("main button[aria-pressed]").first(), 1500);
  await click(page.locator("main button[aria-pressed]").first(), 1000);
  await scroll(700, 1400);
  await click(page.getByRole("button", { name: "Page suivante" }).first(), 1300);
  await scroll(-700, 900);
});

await scene("achats", async () => {
  await nav("Achats");
  await scroll(800, 1500);
  await scroll(-800, 900);
});

await scene("stock", async () => {
  await nav("Stock");
  await click(page.getByRole("button", { name: /^Classe A : / }).first(), 1600);
  await scroll(600, 1200);
  await scroll(-600, 800);
  await click(page.getByRole("button", { name: /^Classe A : / }).first(), 1000);
});

await scene("produits", async () => {
  await nav("Produits");
  await scroll(400, 900);
  await click(page.locator("main table tbody tr a").first(), 2000);
  for (const tab of ["Codes", "Statistiques", "Traçabilité", "Historique", "Général"])
    await click(page.getByRole("tab", { name: tab, exact: true }), 1300);
  await scroll(600, 1100);
});

await scene("analyses", async () => {
  await nav("Analyses");
  await click(page.getByRole("tab").nth(1), 1500);
  await click(page.getByRole("tab").first(), 1000);
  await scroll(800, 1400);
  await scroll(-800, 800);
});

await scene("alertes", async () => {
  await nav("Alertes");
  await scroll(500, 1000);
  await click(page.locator("main section button").first(), 2000);
  await scroll(400, 900);
  await page.keyboard.press("Escape");
  await wait(700);
  await scroll(800, 1300);
  await scroll(-1300, 900);
});

await scene("comptabilité", async () => {
  await nav("Comptabilité");
  await scroll(500, 1000);
  await click(page.getByRole("button", { name: /Espèces/ }).first(), 1800);
  await page.keyboard.press("Escape");
  await wait(600);
  await scroll(700, 1200);
  await scroll(-1200, 800);
});

await scene("produits spéciaux", async () => {
  await nav("Produits spéciaux");
  await type(page.getByRole("searchbox").first(), "dol", 1800);
  await click(page.getByRole("tab", { name: "Bons de livraison" }), 1200);
  await click(page.getByRole("tab", { name: "Produit sur un BL" }), 1000);
  await type(page.getByRole("searchbox").first(), "dol", 1800);
  await click(page.getByRole("button", { name: "Voir ses BL" }).first(), 2200);
  await click(page.getByRole("button", { name: "Voir ses BL" }).first(), 800);
  await click(page.getByRole("tab", { name: "Fournisseurs" }), 1200);
});

await scene("équipe", async () => {
  await nav("Gérer mon équipe");
  await click(page.locator("main").getByRole("button", { name: /Ajouter|Nouvel|Créer|Inviter/ }).first(), 1200);
  await type(page.getByRole("dialog").locator("input").first(), "Salma Bennani", 900);
  await page.keyboard.press("Escape");
  await wait(800);
});

await scene("historique", async () => {
  await nav("Historique");
  await scroll(600, 1200);
  await scroll(-600, 700);
});

await scene("connexion sobrus", async () => {
  await nav("Connexion Sobrus");
  await scroll(500, 1000);
  await scroll(-500, 600);
});

await scene("imports", async () => {
  await nav("Gestion des imports");
  await scroll(400, 900);
  await page.goto(`${BASE}/upload-file`);
  await wait(1200);
  // Hover the 3 file types, pick « Ventes » → the file step.
  for (const name of [/^Achats/, /^Stock/]) await moveTo(page.getByRole("radio", { name }).first()), await wait(500);
  await click(page.getByRole("radio", { name: /^Ventes/ }).first(), 1800);
});

await scene("mon compte", async () => {
  await nav("Mon compte");
  await click(page.getByRole("tab").nth(1), 1200);
  await click(page.getByRole("tab").first(), 900);
});

await scene("langue + thème", async () => {
  await nav("Tableau de bord");
  await click(page.locator("header button", { hasText: /^ES$/ }), 2000);
  await scroll(500, 900);
  await scroll(-500, 600);
  await click(page.locator("header button", { hasText: /^FR$/ }), 1500);
  await click(page.getByRole("button", { name: "Clair", exact: true }), 2000);
  await click(page.getByRole("button", { name: "Sombre", exact: true }), 2000);
});

const video = page.video();
await context.close();
await browser.close();
mkdirSync(dirname(OUT), { recursive: true });
renameSync(await video.path(), OUT);
console.log(`video: ${OUT}`);
