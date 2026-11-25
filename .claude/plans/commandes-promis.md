# Plan (draft): Sobrus tickets → stock endommagé → Promis → module Commandes (2026-11-24)

Status: **every question answered (2026-11-24)**; waiting for « go ».

Sources read in full:

| Source | What it gives |
|---|---|
| ClickUp « Sprint 01 — commande Module » (20 tasks, no subtasks) | 6 TODO / IN MEET + purchasing tasks 01 → 14 |
| `resources/clickup/conditions-laboratoires-board.html` (task 01) | conditions of 21 labs, made for the pharmacy « Para Les Joyaux » |
| `resources/PharmaGest_Gestion_des_Promis_…pdf` (23 p.) | Promis: states, 4 screens, rules, messages, tests |
| `resources/PharmaGest_Module_Commandes_…pdf` (31 p.) | Commandes: Journalières, Directes, Campagnes, Promis, Avoirs |
| Our code | `PharmacyStock` (current_stock, min, max, one expiry date, zone), `Achat` (BL lines + supplier name), `Vente` (lines + client text), `Medicament` (catalogue, laboratoire, pph, ppv) |

Decided already (user, 2026-11-24):

| Decision | |
|---|---|
| Damaged stock | a screen where the pharmacy marks boxes as damaged |
| Promis | built inside PharmaGest, before the purchasing engine |
| Ticket 13 Campagnes | skipped |
| Plan first | full plan + questions, discussion, then build |
| Suppliers (Q-A3) | **one list shared by all pharmacies** (admin manages it; Sobrus suppliers of every pharmacy merged into it, same name = same supplier) |
| Damaged boxes (Q-B1) | Sobrus can't remove them → **we subtract them in PharmaGest**: free stock = Sobrus stock − damaged boxes (while not « remis en vente ») |
| Damage reason (Q-B3) | the user **types the reason** (required text), no fixed list |
| Promis messages (Q-C2) | free: « Envoyer sur WhatsApp » button, the text ready, a person clicks |
| Pickup time (Q-C5) | **7 days, fixed**, nobody can change it |
| State name (Q-C6) | not « Remis » (« remise » = discount in French) → **« Retiré »** (the customer took it); the sale stays in Sobrus |
| Who sets prices (Q-D1, Q-D2) | supplier → pharmacy conditions: **the same for every pharmacy, typed by the admin**; pharmacy → customer discounts: **each pharmacy its own, typed by the owner** |
| Order sending (Q-D3) | **Excel file**; the user will add real order forms to `resources/` as models |
| Damaged = forever (Q-B1) | Sobrus keeps counting a damaged box forever → we subtract it **forever**, even once sent back / destroyed; only « Remis en vente » stops it |
| Expired (Q-B2) | one expiry date per product → **never subtracted**, red warning « date dépassée » on the product |
| Owner discounts (Q-D2) | the owner sets, per product, **a counter discount** (shown in Promis) **and** the online store promo (exists) |
| Other picks | Sobrus product list `.xlsx`, admin + Support only · Promis for owner + employees, permission ON by default · customer list per pharmacy · Promis line may be a product outside the catalogue (typed name) · purchasing-groups screen built empty · unknown wholesalers / delivery times shown « inconnu » until typed · 2–3 Hugging Face models tested on the 25 files before choosing · small automatic tests for the discount formulas (engine only) · admin ticks the exact products of each lab rule |
| Home delivery (Q-C3) | **not now**: pickup at the pharmacy only |
| Reserve without stock (2026-11-25) | « Rendre prêt » with too little free stock (Sobrus stock only arrives at the nightly import) → **allowed + orange warning**; the reservation still counts |
| Promis access (2026-11-25) | own feature `promis`, ON for every pharmacy / owner / employee; menu group « Commandes » |
| Build order of C (2026-11-25) | C-1 tables + wizard + list → C-2 sheet + states + reservation → C-3 WhatsApp + reminders + dashboard + J+7 expiry → C-4 counter discount; stop after each |
| AWS | the whole app may move to AWS if cheaper; then plan microservices (separate decision, not in this plan). The AI reader is built as its own service already |
| Docs `resources/suppliers-stuff/` (25 files) | same content as the board; **no wholesaler, no purchasing group, no delivery days / cut-off / lead time** anywhere |

---

## UX rules for every screen of this plan (user, 2026-11-24)

Pharmacy staff are not computer people and their computers are slow.

| Rule | Example |
|---|---|
| One screen = one job, one big main button | Promis sheet: the next step is the big button (« Rendre prêt »); the rest in a small menu |
| Forms one question per screen (wizard) | Nouveau promis: client → produits → résumé |
| Plain pharmacy words, never tech words | « Prêt à retirer », not « READY »; « Boîtes abîmées », not « stock damage » |
| Numbers explained in one line | « Commander 4 : 3 pour le rayon + 1 pour Mme Alami » |
| The computer suggests, the person clicks | Journalières already filled; the user only checks the orange lines |
| Light pages | lists paged on the server, search on the server, no animation inside the app, skeleton in < 1 s |
| Long jobs in the background | AI reading, big exports: « en cours… », a notification when done, the page stays usable |
| Mistakes easy to undo | « Annuler » on the last action where possible; dangerous actions ask to confirm in plain words |
| Row actions: « ⋮ » → a pop-up of plain choices (user, 2026-11-25: « from now we follow this way ») | « Stock abîmé »: « ⋮ » → « Que s'est-il passé ? » → window « Qu'avez-vous fait de ces boîtes ? » with big cards « Je les ai jetées » + one line « Elles restent hors du stock libre » → « Valider » |

## 0. Order of work

```
A. Sobrus tickets (small)  →  B. Stock endommagé  →  C. Promis  →  D. Commandes 01 → 12 + 14  →  F. UI review  →  E. Tests (end)
```

Each step: build → I give you a UI test list → your OK → next step (memory « stop after each step »).
E2E for everything at the very end (§8).

---

## A. Sobrus tickets (TODO in ClickUp)

| # | Ticket | Plan | Example |
|---|---|---|---|
| A1 | « scraping product page → CSV » | Admin, Catalogue: button « Exporter les produits Sobrus ». The worker already reads every Sobrus product page (run mode `products`); we keep each field it reads and export the file | 9 000 products → 1 file, 1 row per product, French headers |
| A2 | « scraping fournisseur » | new worker run mode `suppliers`: reads the Sobrus suppliers page of a connected account → table `suppliers` (name, phone, email, address, Sobrus id), per pharmacy. Seeds D2 | Pharmacie Demo → « Sophadims », « Ginipharm », « Bottu » … |
| A3 | « avoir by date » | worker reads `reports/salesreturnsmain` for the run's date range (like the cash closing) → table per day / line → Comptabilité block « Retours / avoirs clients » + its row in Gestion des imports | 15/10 → 14/11: 12 returns, −1 351,90 MAD |
| A4 | « connect domain » | waits for the meeting (no description) | — |
| — | « support creation », « cash desk file path » | done → you close them in ClickUp | — |

---

## B. Stock endommagé (new)

Why: Commandes needs **free stock** = what can really be sold.

```
free stock = Sobrus stock − damaged (still on the shelf) − reserved for Promis
example:      10           −  2                          −  1            = 7
```

| Part | Plan |
|---|---|
| Where | Produits → product sheet: button « Déclarer des boîtes abîmées » (quantity, reason, note). Page « Stock abîmé »: list of all declarations, filters, export `.xlsx` |
| Reason | typed by the user, optional (« carton écrasé à la livraison »), user 2026-11-25 |
| What happens next (state) | « À traiter » → « Rendu au fournisseur » (→ can create a supplier avoir, D10) · « Détruit » · « Remis en vente » (error) |
| Who | owner + employee with a new permission « Stock abîmé » (ON by default) |
| History | every declaration / change in « Historique » (who, when, why) |
| Table | `stock_damage(id, pharmacy_id, medicament_id, quantity, reason, note, status, created_by, created_at, closed_at)` |

Open point: Q-B2 (expired boxes).

---

## C. Promis (from the 23-page spec, adapted to us)

A **promis** = a product a customer asked for that the pharmacy cannot give right now. The pharmacy follows it until the
customer takes it.

### C1. States

```
Brouillon → Créé → À commander → Commandé → Reçu → Prêt (réservé, J+7) → Retiré
                                              ↘ Incident        ↘ Expiré (J+7 passé) → Rendu au stock
any state before « Retiré » → Annulé (reason required)
```

| State | Means | Allowed when |
|---|---|---|
| Créé | file saved | customer + ≥ 1 product + a way to contact (or « client injoignable » ticked) |
| À commander | not enough free stock | free stock < quantity |
| Commandé | ordered from a supplier | supplier chosen (or a note) |
| Reçu | box arrived, not checked yet | from Commandé / Créé |
| Prêt | checked + reserved + shelf place typed | full quantity reserved; starts the 7 days (`ready_at`) |
| Retiré | customer took it (the sale is made in Sobrus) | from Prêt |
| Expiré | 7 days passed | automatic, every night |
| Rendu au stock | reservation freed | from Expiré, after checking the box |
| Annulé | customer / error | reason required; frees the reservation |

Rule: the screen never changes a state itself; it asks the server, which checks, writes, logs.

### C2. Screens (all under « Commandes » → « Promis »)

| Screen | Content |
|---|---|
| Tableau de bord | counters per state (click = filter), « À retirer aujourd'hui » in red, « Expirés », list of files needing an action (most urgent first), retraits of the next 7 days |
| Liste | search (name, phone, product, barcode), filters (state, deadline: today / tomorrow / 7 days / late), server-side pages, export `.xlsx` |
| Nouveau promis | wizard, one question per screen (memory « forms step by step »): 1 customer (search or new) → 2 products + quantity (search in catalogue, shows free stock) → 3 summary → « Créer » |
| Fiche | customer, lines, state, timeline (every step: who, when), only the allowed buttons (« Marquer commandé », « Marquer reçu », « Rendre prêt », « Retiré par le client », « Envoyer un rappel », « Annuler », « Rendre au stock ») |

### C3. Messages to the customer

| When | Message |
|---|---|
| Created | « Votre demande de {produit} est enregistrée. » |
| Prêt | « Votre {produit} est prêt. À retirer avant le {date}. » |
| J+5, J+6, J+7 | reminders |
| Rendu au stock | « Votre réservation est terminée. » |

How they are sent: a button « Envoyer sur WhatsApp » opens WhatsApp with the text ready (free; a person clicks). The
dashboard lists the messages due today (J+5, J+6, J+7…), so nobody forgets.

Price shown in a Promis: the product's PPV minus the owner's **counter discount** for that product (set on the product
sheet, « Remise comptoir », %); 0 % when none.

### C4. Tables

| Table | Fields |
|---|---|
| `customers` | pharmacy_id, name, phone (+212…), consent WhatsApp / SMS, note |
| `promis` | pharmacy_id, customer_id, state, ready_at, pickup_deadline, version, created_by, created_at |
| `promis_lines` | promis_id, medicament_id (empty for a product outside the catalogue) + typed name, quantity, reserved_qty, shelf_place, price + counter discount at creation |
| `pharmacy_product_edits.counter_discount` | the owner's counter discount per product (%) |
| `promis_events` | promis_id, from → to, actor, reason, at (never edited) |
| `promis_messages` | promis_id, kind (created / ready / J5 / J6 / J7 / returned), planned_at, sent_at, status |

Reservation: `reserved` per product = sum of `reserved_qty` of « Prêt » lines. Two employees can't reserve the last box
(checked in one SQL update).

### C5. Not in v1 (spec chapters left out, decided)

| Spec part | Why left out |
|---|---|
| Home delivery + online payment (ch. 12) | needs a payment provider, a carrier, product eligibility rules |
| Farmatic connector (ch. 16) | we use Sobrus; Sobrus is read-only for us |

---

## D. Commandes (ClickUp 01 → 12, 14; 13 skipped)

Behind the access « Commander » (`orders`, OFF by default, admin switches it on).
Menu « Commandes » → Journalières · Directes · Promis · Avoirs.

Build order of D (2026-11-25), stop + commit after each:

| Step | What |
|---|---|
| D-1 | supplier sheet (admin, Support): order fields (contact, channel, delivery days, cut-off, lead time, payment, transport), « inconnu » in orange, archive |
| D-2 | conditions: tables + per-supplier screen in plain words, state badges, add / edit step by step |
| D-3 | import of the board (21 labs, « non vérifié ») |
| D-4 | conditions engine (pure function) + its small tests |
| D-5 | purchasing groups screen (empty) |
| D-6 | stock link + needs calculation |
| D-7 | Journalières · D-8 Directes · D-9 validation + Excel · D-10 Promis inside · D-11 avoirs |
| D-12 | AI reader (own service) |

### D1. Data (ticket 01)

| Table | Holds | Example |
|---|---|---|
| `suppliers` | wholesalers, labs, distributors: name, kind (grossiste / laboratoire / distributeur), contact, phone, payment, delivery days, cut-off, lead time, ordering channel (téléphone / fax / e-mail / WhatsApp / EDI / délégué), transport fees + free from (MAD), status | Bottu · laboratoire · 05 22 67 51 51 · chèque comptant · CTM |
| `purchasing_groups` + `…_members` | groups and which pharmacies belong | (none known yet: Q-D5) |
| `supplier_conditions` | one rule: scope (supplier / product / list / order), kind (minimum, quantity tiers, amount tiers, product discount, pack, payment discount, transport, packaging multiple, return rule), basis (units / MAD / references), value(s), valid from → to, state (confirmé / non vérifié / manquant), source, version | Afric-Phar · tiers on units · 100 → 20 %, 200 → 23 %, 300 → 25 % · confirmé |
| `condition_products` | which products a rule covers (explicit list, never « all the lab ») | Strepsils rule → the Strepsils products |
| `condition_history` | old versions, never deleted | |

Import of the board: 5 labs complete + 16 « à compléter » (state « non vérifié », only what is written). Unknowns stay
Board check (2026-11-25): the 5 fields missing for all 21 labs = delivery days, cut-off, lead time, ordering channel,
transport fees; the board says they will come from the « talks » (WhatsApp with the delegates), not in the 25 files.
Most documents date from 2023–2024 → every imported rule stays « non vérifié » until the admin confirms it is still
true; GSK « FD » + currency and Afric-Phar 1,5 % / 60 j stay flagged.
empty and visible: Afric-Phar « 4 000–5 000 DH → 7 % » scope, GSK « FD » + currency, Pharma5 « 90 jours »,
Classeur1 = no lab name, Anginib PPH > PPV.

### D1b. AI reads the supplier documents (the « IA » of the spec)

Why: every lab sends its conditions in its own layout (PDF, scanned PDF, phone photo, Excel order form), and there are
many more than the 25 files in `resources/suppliers-stuff/`. Typing them by hand doesn't scale.

```
Admin uploads a file  →  our model reads it  →  draft rules (state « à vérifier »)  →  admin checks each rule  →  « confirmé »
example: « APCM LABORATOIRE PHI CONDITIONS ET DUREX.jpg »
  → Durex: 36 u → 20 %, 48 u → 24 %, 96 u → 30 %, colisage 288 / 72
  → Strepsils: minimum 30 u (panaché), 30 → 16 %, 40 → 20 %, 60 → 25 %, colisage 144
  → Gaviscon: colisage 10 / 12, « non livré si colisage non respecté »
  → Paiement: comptant, escompte 2 % · Retour: ni repris ni échangés
```

| Part | Plan |
|---|---|
| Model | **our own model, self-hosted** (user, 2026-11-24: no external AI API), downloaded from Hugging Face. An open « vision » model (reads text + photos), e.g. the Qwen-VL family, Llama Vision, Mistral Small (vision) or Gemma — final pick: Q-D11 |
| Serving | a separate service next to the backend (vLLM or Ollama, Docker), only the backend calls it; no data leaves our servers |
| Input | PDF with text: the text · scanned PDF / photo: the page image (or OCR first, e.g. Tesseract / PaddleOCR, then the text) · Excel: turned into text by the backend |
| Output | JSON forced to match our rule table (vLLM « guided JSON » / Ollama `format` = schema): supplier, rule kind, basis, tiers, products as written, packaging, payment, returns, « absent du document » per missing field, the sentence it came from |
| Product names | the model proposes catalogue products for « Doliprane », « Strepsils »…; the admin ticks the right ones (never automatic) |
| Safety | the model never decides an order and never confirms a rule: everything it reads starts « à vérifier »; the conditions engine (D4) stays plain code |
| Where | Admin → Fournisseurs → sheet → « Lire un document »; reading runs in a queue (like Sobrus runs), the page shows « en cours » then the draft rules |
| History | the file + what the model read + what the admin changed, kept for each rule (source) |
| Hardware | **no GPU, DigitalOcean only** (user, 2026-11-24). Runs on CPU: a small model, quantized (llama.cpp / Ollama), several minutes per page. OK because reading is a background job (queue, like Sobrus runs) and documents are rare. Scans / photos: OCR first (Tesseract) to help the small model |
| Service | its own service `SERVICE=ai` on its own Droplet (needs RAM, ~16 GB), so it never slows the app and can move alone (see AWS below) |
| Quality check | before choosing the model: run it on the 25 files of `resources/suppliers-stuff/`, compare with the board (the board = expected answers) |

### D2 – D5. Screens to manage suppliers and conditions (tickets 02, 03, 05)

| Screen | Content |
|---|---|
| Fournisseurs | list + sheet: contact, payment, delivery (days, cut-off, lead time), « manquant » shown in orange, archive |
| Conditions | per supplier: every rule in plain words (« Dès 200 unités : 16 % »), state badge, source, validity; add / edit form step by step |
| Groupements | list, members, their conditions (if Q-D5 says they exist) |

### D4. Conditions engine (ticket 04)

Pure function, no supplier-specific code:

```
input:  lines (product, quantity, price) + rules valid today and « confirmé »
output: per line and per order: discount, net price, minimum reached?, missing info, explanation
example: Afric-Phar, 230 units → tier 200 → 23 % ; next tier 300 (70 units more) — shown, never added
```

Rules never combined unless the rule says so. « Non vérifié » rules are shown, never applied automatically.

### D6. Stock link (ticket 06)

| Input | From |
|---|---|
| stock, min, max, expiry | `PharmacyStock` (Sobrus) |
| damaged | B |
| reserved | C (Promis « Prêt ») |
| sales 7 / 30 / 90 days | `ventes` |
| incoming | our own orders « envoyée / confirmée / partielle » |

### D7. Calculation (ticket 07), from the spec

```
normal need  = max(0, max − free stock − incoming in time)
promis need  = max(0, promis quantity − already reserved − incoming for promis)
need         = normal need + promis need
example: min 2, max 3, free 0, promis 1 → 3 + 1 = 4 units
```

Never more than the need to reach a minimum or a tier. Each line gets a short reason in plain words.

### D8. Journalières (ticket 08)

Every day: one proposal, already split by supplier. Groups: Urgences · Réassort · Promis · En attente de direct · À
vérifier. The user edits a quantity → totals and tiers recalculated → « Valider ».

### D9. Directes (ticket 09)

Per lab: eligible needs added up virtually; « 4 820 / 5 000 MAD (minimum) ». The part needed before the direct order
arrives stays with the wholesaler. When the minimum is reached: « Dossier direct à valider ».

### D10. Validation + suivi (ticket 10)

Brouillon → Validée → Envoyée → Confirmée → Partielle / Refusée → Livrée. Frozen copy of stock + rules used at
validation. Sending: **see Q-D3**.

### D11. Promis inside Commandes (ticket 11)

Promis lines « À commander » show in Journalières under « Promis »; ordering them moves the Promis to « Commandé ».

### D12. Avoirs fournisseurs (ticket 12)

Créé → En attente → Accepté / Refusé → Avoir reçu → Payé / compensé · Annulé. Linked to a supplier, an order, a damaged
declaration (B). Number, date, amount, reason.

---

## F. UI review of the whole app (user, 2026-11-25)

Every page, old and new, follows the pop-up and message style the user approved on « Stock abîmé » (2026-11-25).

| Check | The rule |
|---|---|
| Row actions | « ⋮ » menu; an action that needs a choice opens a pop-up, never a bare menu of state words |
| Pop-up | `Dialog` + `DialogHeader` (icon, question as title, what it is about as subtitle) + `DialogBody` + `DialogFooter`; choices = big `ChoiceCard`s, each a first-person sentence (« Je les ai jetées ») + one line saying what happens (« Elles reviennent dans le stock libre. ») |
| Buttons | « Annuler » + one main button (« Valider »); disabled → the reason written next to it (« Choisissez une réponse. ») |
| Words | states named as the user says them (« Jetées », « Bonnes, remises en stock »), never codes or tech words |
| Messages | toasts short and plain (« C'est noté. »); errors say what to do |
| Controls | numbers with `QuantityField` (« − » / « + »), never the browser's arrows; app components only |

How: one page at a time, a list of what breaks the rule (screenshot + file), the user picks, then fixes; same « stop after each step ».

## 8. Tests (end of the whole batch)

| Kind | What |
|---|---|
| E2E (Playwright) | every screen of A, B, C, D through the UI, oracle `resources/tests/oracle.py` extended (free stock, needs, tiers) |
| Engine tests | see Q-D6 (the tickets ask for unit tests) |

---

## 9. Questions

All answered 2026-11-24: see the decisions table at the top.

## Resume here (2026-11-25, session stopped for token use)

- C done: C-1 + C-2 (0742379), C-3 (592c306), C-4 « Remise comptoir » (migration 0049, product sheet « Prix et
  marge », price − discount in the Promis wizard + sheet). Then: account button top right (35d53e2), no « Premium » (d7b952b),
  D-1 supplier sheet (c4888af), D-2 conditions (53bf37c), D-3 board import (a747a3a), D-4 engine + 12 tests (next commit). Next: D-5 groups, D-6 needs.
