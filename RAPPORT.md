# PharmaGest — Spécification Complète de l'Application

## 1. Vue d'ensemble

**PharmaGest** est un tableau de bord de gestion pharmaceutique destiné aux pharmacies marocaines utilisant le logiciel **Sobrus**. L'application comprend :

- **Frontend** : Application web React (dashboard)
- **Backend** : API FastAPI + PostgreSQL
- **Extension Chrome** : Capture automatique des exports CSV Sobrus
- **298 tests automatisés** (187 backend + 84 frontend + 27 extension)

### Identité visuelle
- **Nom** : PharmaGest
- **Slogan** : Gestion avancée de votre Pharmacie
- **Logo** : Icône "G+" dégradé cyan (#0CC0DF) → lime (#BFDE42)
- **Couleur primaire** : Cyan #0CC0DF
- **Thème** : Clair / Sombre (toggle dans le header)

### Rôles utilisateurs
| Rôle | Description |
|------|-------------|
| **Administrateur** | Gère les pharmacies, le catalogue, les demandes d'exclusion |
| **Propriétaire** | Gère sa pharmacie, ses employés, ses données |
| **Employé** | Accès limité selon les permissions définies par le propriétaire |

---

## 2. Pages d'authentification

### 2.1 Connexion (`/login`)
- **Accès** : Public
- **Contenu** :
  - Logo PharmaGest
  - Titre : "Connexion" / Sous-titre : "Bienvenue sur PharmaGest"
  - Champ email
  - Champ mot de passe (avec icône visibilité)
  - Lien "Mot de passe oublié ?"
  - Bouton "Se connecter" (avec spinner pendant le chargement)
  - Lien "Pas de compte ? Créer un compte"

### 2.2 Inscription (`/signup`)
- **Accès** : Public
- **Contenu** :
  - Logo PharmaGest
  - Titre : "Créer un compte" / Sous-titre : "Commencez avec PharmaGest"
  - **Sélection du rôle** (2 boutons) :
    - Propriétaire (icône bâtiment)
    - Employé (icône utilisateur)
  - Champs : Nom complet, Téléphone
  - Champ Email
  - Champs : Mot de passe, Confirmation
  - **Section pharmacie** (conditionnelle) :
    - Si propriétaire : choix "Nouvelle pharmacie" (saisie du nom) ou "Rejoindre existante" (dropdown)
    - Si employé : dropdown de sélection de pharmacie
  - Bouton "Créer mon compte"
  - Lien "Déjà un compte ? Se connecter"

### 2.3 Mot de passe oublié (`/forgot-password`)
- **Accès** : Public
- **Flux en 3 étapes** :

**Étape 1 — Choix de la méthode :**
- Toggle : Email | WhatsApp
- Champ email OU champ téléphone
- Bouton "Envoyer le lien" / "Envoyer le code WhatsApp"

**Étape 2a — Confirmation email :**
- Icône mail
- Message : "Un email de réinitialisation a été envoyé à [email]"
- Bouton "Renvoyer un email"

**Étape 2b — Saisie OTP WhatsApp :**
- Icône WhatsApp
- Message : "Un code à 6 chiffres a été envoyé sur WhatsApp au [phone]"
- Champ OTP (6 chiffres, centré, police mono)
- Bouton "Vérifier le code"
- Lien "Changer de méthode"

### 2.4 Réinitialisation (`/reset-password?token=...`)
- **Accès** : Public (avec token valide)
- **Contenu** :
  - Logo PharmaGest
  - Champ nouveau mot de passe
  - Champ confirmation
  - Bouton "Modifier le mot de passe"
  - Gestion erreur : token invalide/expiré → lien vers `/forgot-password`

### 2.5 Page d'attente (`/pending`)
- **Accès** : Utilisateurs en attente d'approbation
- **Contenu** :
  - Icône horloge (ambre) ou croix (rouge si rejeté)
  - Titre : "Compte en attente"
  - Message adapté selon le rôle (propriétaire / employé)
  - Badge de statut
  - Bouton "Se déconnecter"

---

## 3. Accueil (`/`)

### Vue non authentifiée
- Logo animé avec pilules décoratives en arrière-plan
- Titre : "Pharma**Gest**"
- Sous-titre : "La gestion pharmaceutique simplifiée pour les pharmacies marocaines"
- 2 boutons : "Se connecter" | "Créer un compte"
- 3 cartes de fonctionnalités :
  - Suivi des achats & ventes
  - Analyses & Rapports
  - Catalogue médicaments

### Vue administrateur
- "Bonjour, [Nom]"
- Sous-titre : "Accès rapide à votre espace administrateur"
- 5 liens rapides : Tableau de bord, Pharmacies, Demandes d'exclusion, Catalogue, Rapports

### Vue propriétaire
- "Bonjour, [Nom]"
- Nom de la pharmacie affiché
- Si en attente/rejeté : bannière de statut avec bouton déconnexion
- Si actif : 8 liens rapides (conditionnels selon permissions)

### Vue employé
- "Bonjour, [Nom]"
- Nom de la pharmacie
- Jusqu'à 5 liens rapides (filtrés par permissions)

---

## 4. Tableau de bord — Propriétaire/Employé (`/rapports`)

### Barre de filtres (sticky en haut)
- Sélecteur de dates : Du / Au (avec bouton Réinitialiser)
- Boutons type : **Mixte** | **Pharmacie** (vert) | **Parapharmacie** (violet)
- Bouton export Excel

### Section 1 — Bandeau de performance
- Ligne unique résumant : Marge moyenne %, Part parapharmacie du CA, Marge brute MAD

### Section 2 — Indicateurs clés (4 colonnes)
| Carte | Valeur | Formule |
|-------|--------|---------|
| Chiffre d'affaires | XXX MAD | `PPV × qté vendue` |
| Achats totaux | XXX MAD | `Σ(PU × qté achetée)` |
| Transactions ventes | N | Nombre de lignes de vente |
| Transactions achats | N | Nombre de lignes d'achat |

### Section 3 — Indicateurs avancés (6 cartes, grille 3×2)
| Carte | Formule affichée |
|-------|-----------------|
| Ticket moyen | `CA ÷ nb transactions` |
| Vente moyenne / jour | `CA ÷ nb jours avec ventes` |
| Meilleure journée (DH) | Date + montant |
| Meilleure journée (opé) | Date + nombre d'opérations |
| Moins bonne journée (DH) | Date + montant (carte rouge) |
| Moins bonne journée (opé) | Date + nombre (carte rouge) |

### Section 4 — Répartition & Santé financière (2 colonnes)
**Colonne gauche — Graphique donut :**
- Répartition par catégorie (Pharmacie vs Parapharmacie)
- Légende avec CA et pourcentage

**Colonne droite — Carte santé financière :**
- Note lettre dans un cercle (A+, A, B+, B, C, D, F)
- Couleur : vert (A+) → rouge (F)
- Valeurs marge brute et marge nette
- Barème affiché :
  - A+ : marge > 30%
  - A : > 25%
  - B+ : > 20%
  - B : > 15%
  - C : > 10%
  - D : > 5%
  - F : ≤ 5%

### Section 5 — Alertes Marges (4 cartes colorées)
| Carte | Couleur | Condition | Contenu |
|-------|---------|-----------|---------|
| Marge négative | Rouge | marge < 0% | Nombre de produits + perte totale MAD + top 3 produits |
| Marge 0% à 10% | Orange | 0 ≤ marge < 10% | Nombre + CA concerné + top 3 |
| Marge 60% à 89.9% | Jaune | 60 ≤ marge < 90% | Nombre + CA + top 3 |
| Marge ≥ 90% | Vert | marge ≥ 90% | Nombre + CA + top 3 |

### Section 6 — Déclaration TVA (3 cartes)
| Carte | Formule |
|-------|---------|
| TVA encaissée (ventes) | `Σ(PPV × qté × taux_TVA)` |
| TVA payée (achats) | `Σ(PU × qté × taux_TVA)` |
| TVA à déclarer | `encaissée − payée` (estimation) |

### Section 7 — Résumé marge (1 carte, 3 colonnes)
| Colonne | Formule |
|---------|---------|
| Marge % | `(1 − PU÷PPV) × 100` |
| Marge brute | `PPV − PU` (pondérée par qté) |
| Marge nette | `PPV_HT − PU_HT` où HT = `÷(1+TVA)` |

### Section 8 — Analyse de marge (tableau)
- **7 boutons de mode** : Produit | Catégorie | Fournisseur | BL | Labo | Opérateur | Mois
- Bouton "Créer une analyse" → ouvre le dialogue de simulation
- **Tableau** avec colonnes selon le mode sélectionné (voir section 5)

### Section 9 — Tendance mensuelle
- Graphique en barres : Ventes vs Achats sur 12 mois
- Axes : mois (X), montant MAD (Y)

### Section 10 — Tendance cumulée + Répartition
- **Graphique zone** : courbes ventes/achats cumulées
- **Graphique donut** : répartition par catégorie

### Section 11 — Top catégories
- Barres horizontales colorées avec nom de catégorie + montant MAD

---

## 5. Tableau de bord — Administrateur (`/rapports` quand admin)

### Section système (4 cartes)
| Carte | Donnée |
|-------|--------|
| Pharmacies | Nombre total |
| Utilisateurs actifs | Nombre |
| Médicaments au catalogue | Nombre |
| Demandes en attente | Nombre |

### Section pharmacie (après sélection)
- Dropdown de sélection de pharmacie
- Mêmes sections que le tableau de bord propriétaire (KPIs, TVA, marges, tendances, etc.)

---

## 6. Analyse (`/analyse`)
- **Accès** : Propriétaire, Employé (permission : rapports)
- **Titre** : Analyse
- **Sous-titre** : "Sélectionnez des produits pour analyser vos marges et exporter les données."

### Barre de filtres (sticky)
- Sélecteur de dates : Du / Au
- Boutons : Mixte | Pharmacie | Parapharmacie

### Boutons de mode (7)
| Mode | Colonnes du tableau |
|------|-------------------|
| Produit | Produit, Catégorie, TVA, PPV, Prix max/min/moy, Marge %, Marge DH, Qté, CA |
| Catégorie | Catégorie, Prix max/min/moy, Marge % moy, Marge DH moy, Qté, CA |
| Fournisseur | Fournisseur, Prix max/min/moy, Qté, CA |
| BL | Référence BL, Fournisseur, Date livraison, Nb produits, Quantité, Total achats |
| Laboratoire | Laboratoire, Prix max/min/moy, Qté, CA |
| Opérateur | Opérateur/Client, Transactions, Qté, CA |
| Mois | Mois, Transactions, Qté, CA |

### Cartes KPI (visibles quand lignes sélectionnées, 4 colonnes)
| KPI | Formule affichée |
|-----|-----------------|
| CA sélection | Somme des CA des lignes sélectionnées |
| Quantité | Total unités |
| Marge % | `(1 − PU÷PPV) × 100` |
| Marge DH | `PPV − PU` |

### Fonctionnalités
- Recherche dans les lignes
- Sélection par checkbox (clic sur la ligne ou la checkbox)
- Bouton "Tout sélectionner / Tout désélectionner"
- Bouton "Exporter CSV (N)" pour les lignes sélectionnées
- Compteur : "X élément(s) sélectionné(s) sur Y"
- État vide : icône + "Importez des achats et des ventes pour commencer"

---

## 7. Comptabilité (`/comptabilite`)
- **Accès** : Propriétaire uniquement
- **Titre** : Comptabilité
- **Sous-titre** : "Saisissez vos encaissements par mode de paiement et consultez votre bilan."

### Filtres dates
- Sélecteur Du / Au (filtre le bilan financier)

### 4 cartes de paiement (saisie manuelle)
| Carte | Icône | Couleur | Contenu |
|-------|-------|---------|---------|
| TPE | Carte bancaire | Bleu | Total MAD, Pharma/Para split, nb transactions |
| Espèces | Billet | Vert | Idem |
| Chèques | Reçu | Violet | Idem |
| Virement et autres | Flèches | Ambre | Idem |

- Chaque carte est cliquable → ouvre un dialogue de saisie
- Si non renseignée : "Cliquez pour saisir"

### Dialogue de saisie (modal)
- Sélecteur de mois
- Sélecteur de méthode (dropdown)
- Montant Pharmacie (MAD)
- Montant Parapharmacie (MAD)
- Nombre de transactions
- Boutons Annuler / Enregistrer

### Bilan financier (carte)
**Ligne 1 (3 colonnes) :**
| Donnée | Formule |
|--------|---------|
| Chiffre d'affaires | `PPV × qté vendue` |
| Total achats | Somme des achats |
| Résultat brut | `CA − Achats` (vert si positif, rouge si négatif) |

**Ligne 2 — TVA :**
- TVA encaissée, TVA payée, TVA à déclarer (estimation)

**Ligne 3 — Marges :**
- Marge %, Marge brute (MAD), Marge nette (MAD)

---

## 8. Achats (`/achat`)
- **Accès** : Propriétaire, Employé (permission : achat)
- **Titre** : Achats
- **Sous-titre** : "Historique des bons de livraison fournisseurs."

### Barre d'outils
- Recherche : "Produit, fournisseur, référence…" (autocomplétion)
- Filtre catégories (multi-select)
- Filtre TVA (multi-select)
- Sélecteur de période (calendrier)
- Bouton Export CSV
- Boutons : **Mixte** | **Pharmacie** | **Parapharmacie**
- Toggle colonnes visibles
- Bouton **Importer** (si permission import)

### Résumé fournisseurs (section dépliable)
- **3 cartes résumé** : Total achats MAD, Bons de livraison (nombre), Unités
- **Top 5 fournisseurs** (page courante) :
  - Rang, Nom du fournisseur, Nb BL, Nb unités, Total MAD, % du total
  - Barre de progression colorée
- Indicateur "+ N autres fournisseurs" si plus de 5

### Tableau de données
| Colonne | Description |
|---------|-------------|
| Date BL | Date du bon de livraison |
| Référence | Numéro de référence (badge) |
| Référence Finale | Avec suffixe catégorie si applicable |
| Fournisseur | Nom du grossiste/labo |
| Produit | Nom du produit + PID en sous-texte |
| Catégorie | Badge coloré |
| Type | Badge Pharmacie (bleu) ou Parapharmacie (violet) |
| TVA | Taux affiché |
| Qté | Quantité achetée |
| PPH (catalogue) | Prix catalogue fournisseur |
| PU (achat) | Prix unitaire réel d'achat |
| Péremption | Date d'expiration |
| Total | Montant total (gras) |

### Pied de tableau
- "TVA payée (page courante) : XXX MAD"
- Pagination : page, taille de page, total

---

## 9. Ventes (`/ventes`)
- **Accès** : Propriétaire, Employé (permission : ventes)
- **Titre** : Ventes
- **Sous-titre** : "Historique des transactions de vente."

### Barre d'outils
- Recherche : "Produit, client, N° transaction…" (autocomplétion)
- Filtre catégories, TVA, période
- Export CSV
- Boutons : Mixte | Pharmacie | Parapharmacie
- Toggle colonnes
- Bouton Importer

### Tableau de données
| Colonne | Description |
|---------|-------------|
| Date | Date de la transaction |
| N° Transaction | Numéro (badge) |
| N° Transaction Final | Avec suffixe |
| Client | Nom ou "Anonyme" |
| Produit | Nom + PID |
| Catégorie | Badge |
| Type | Pharmacie/Parapharmacie |
| TVA | Taux |
| Qté | Quantité vendue |
| Remise | Montant remise (ambre si > 0) |
| PPV | Prix de vente catalogue |
| Prix unitaire | Prix unitaire réel |
| Total | Montant total (gras) |

### Pied de tableau
- "TVA encaissée (page courante) : XXX MAD"
- **Badges filtres rapides** :
  - "Avec remise" (ambre) — nombre de lignes avec remise > 0
  - "Prix > PPV" (rouge) — nombre de lignes où prix unitaire > PPV

---

## 10. Alertes Stock (`/stock`)
- **Accès** : Propriétaire, Employé (permission : stock)
- **Titre** : Alertes Stock
- **Sous-titre** : "Analyse ABCD de vos produits sur les 12 derniers mois."

### Filtre dates (sticky)
- Sélecteur Du / Au

### 4 cartes KPI
| Carte | Couleur | Contenu |
|-------|---------|---------|
| Total références | Primaire | Nombre total de produits classifiés |
| Bien géré | Vert | % et nombre de produits avec stock entre min et max |
| Sous-stock | Ambre | % et nombre sous le stock minimum |
| Sur-stock | Rouge | % et nombre au-dessus du stock maximum |

### Graphique de distribution ABCD
- Barres horizontales colorées
- Classes : A, A-, B+, B, C, C-, C-N, D
- Nombre de produits par classe

### Classification ABCD (formules)
| Classe | Condition | Ventes 12 mois |
|--------|-----------|----------------|
| A | ratio ≥ 1.0 | 300+ unités |
| A- | 0.833 – 0.997 | 250–299 |
| B+ | 0.667 – 0.833 | 200–249 |
| B | 0.16 – 0.667 | 48–199 |
| C | 0.02 – 0.157 | 6–47 |
| C- | — | 1–5 unités en 12 mois |
| C-N | — | 1–5 unités uniquement sur les 4 derniers mois (nouveautés) |
| D | — | 0 unité en 12 mois |

**Ratio** = `ventes_12_mois ÷ 300`

**Stock MIN** = `floor(ratio × 14)` — sécurité 2 semaines
**Stock MAX** = `ceil(ratio × 15)`

Exceptions : C, C-, C-N → min=0, max=1 | D → min=0, max=0

### Filtres de classe (chips)
- Bouton "Tous (N)"
- Un bouton par classe avec compteur, coloré

### Recherche
- "Rechercher un produit..."

### Tableau de produits (triable)
| Colonne | Description |
|---------|-------------|
| Produit | Nom du médicament |
| Classe | Badge coloré (A/A-/B+/B/C/C-/C-N/D) |
| Ventes 12m | Quantité vendue sur 12 mois |
| Stock Min | Niveau minimum calculé |
| Stock Max | Niveau maximum calculé |
| Stock actuel | Niveau actuel (du dernier achat) |
| Statut | Badge : OK (vert), Sous-stock (ambre), Sur-stock (rouge), Inconnu (gris) |

---

## 11. Paramètres (`/parametres`)
- **Accès** : Tous les utilisateurs authentifiés
- **Titre** : Paramètres

### Section profil
- Titre : "Mon profil"
- Champs : Nom complet, Téléphone, Email
- Si propriétaire : Nom de pharmacie + Adresse (éditables)
- Si employé : Nom de pharmacie (lecture seule)
- Bouton "Enregistrer"

### Zone de danger (masquée pour admin)
**Historique des imports :**
- Liste des imports avec :
  - Badge type (Achats bleu / Ventes vert)
  - Date et heure
  - Nom du fichier Sobrus
  - Nombre de lignes importées + doublons ignorés
  - Bouton "Supprimer" avec confirmation inline

**Suppression avancée :**
- Boutons "Supprimer des achats" / "Supprimer des ventes"
- Dialogue avec : filtre catégories + filtre dates + avertissement + confirmation

---

## 12. Importer un fichier (`/dashboard/upload-file`)
- **Accès** : Propriétaire, Employé (permission : import)
- **Titre** : Importer un fichier
- **Sous-titre** : "Importez vos exports Sobrus au format CSV."

### Indicateur d'étapes (3 étapes avec connecteurs)

**Étape 1 — Type de document :**
- 2 cartes :
  - **Achats** (violet) : "Bons de livraison fournisseurs" + colonnes attendues
  - **Ventes** (teal) : "Transactions de vente clients" + colonnes attendues
- Format attendu : `Sobrus - Achats YYYY-MM-DD - YYYY-MM-DD.csv`

**Étape 2 — Fichier CSV :**
- Zone de glisser-déposer (ou clic pour parcourir)
- Validation : doit être .csv, format Sobrus reconnu
- Badge du type sélectionné

**Étape 3 — Aperçu & Import :**
- Aperçu des 8 premières lignes du CSV
- Indicateur de période (dates début/fin)
- Nombre total de lignes
- **Pendant l'import** :
  - Barre de progression animée : "Lot X/Y"
  - Pourcentage
  - Bouton "Annuler l'import"
- **Succès** : "X lignes importées" + "Y doublons ignorés"
- **Erreur** : message d'erreur + bouton réessayer

---

## 13. Pages administrateur

### 13.1 Pharmacies (`/admin/pharmacies`)
- **Accès** : Admin uniquement
- **Titre** : Pharmacies

**En-tête :**
- Bouton "Nouvelle pharmacie"

**Grille de cartes pharmacie :**
- Nom, date de création
- Adresse
- Propriétaire(s) : nom, email, téléphone
- Nombre de membres
- Boutons : Modifier (crayon), Supprimer (corbeille)
- Clic → ouvre le panneau détaillé

**Panneau pharmacie (3 onglets) :**

| Onglet | Contenu |
|--------|---------|
| **Membres** | Liste des utilisateurs avec : avatar, nom, email, sélecteur de rôle (Admin/Propriétaire/Employé), sélecteur de pharmacie, toggles de permissions pour les propriétaires |
| **Produits spéciaux** | Liste des produits non déclarés (lecture seule) : nom, catégorie, PPV, TVA |
| **Options** | 5 toggles de fonctionnalités (rapports, import, achats, ventes, stock) — plafond pour tous les membres |

**Section propriétaires en attente :**
- Tableau : nom, email, pharmacie demandée, date, boutons Approuver/Refuser

**Section tous les utilisateurs :**
- Tableau complet avec : nom, statut (badge), rôle (dropdown), pharmacie (dropdown), bouton révoquer

### 13.2 Catalogue (`/admin/catalog`)
- **Accès** : Admin uniquement
- **Titre** : Catalogue

**Barre d'outils :**
- Recherche
- Import CSV/XLSM (bouton)
- Nouveau médicament (bouton)
- Export CSV
- Toggle colonnes

**Tableau :**
| Colonne | Description |
|---------|-------------|
| Produit | Nom + PID (badge) + Laboratoire |
| Catégorie | Badge |
| Type | Pharmacie/Parapharmacie (avec * si auto-détecté) |
| TVA | Taux |
| PPH | Prix catalogue fournisseur |
| PPV | Prix de vente |
| Code-barres | Code mono |
| Actions | Modifier / Supprimer |

**Dialogue de formulaire :**
- Champs : PID, Produit, TVA, PPH, PPV, Catégorie, Zone, Code-barres 1 & 2, Laboratoire, Type

### 13.3 Demandes d'exclusion (`/admin/catalog-requests`)
- **Accès** : Admin uniquement
- **Titre** : Demandes d'exclusion

**Onglets de statut :**
- Tous | En attente (avec badge compteur) | Approuvés | Rejetés

**Liste des demandes :**
| Colonne | Description |
|---------|-------------|
| Produit | Nom + notes |
| Pharmacie / Demandeur | Nom de la pharmacie + demandeur |
| Type | Badge : Exclusion / Annulation |
| Statut | Badge : En attente / Approuvé / Rejeté |
| Date | Date de création |
| Actions | Approuver / Rejeter |

- Rejet → dialogue avec champ "raison du rejet"

---

## 14. Pages propriétaire

### 14.1 Mes employés (`/owner/employees`)
- **Accès** : Propriétaire uniquement
- **Titre** : Mes employés

**Section en attente :**
- Badge compteur
- Tableau : avatar, nom, email, date de demande, boutons Approuver/Refuser

**Section actifs :**
- Badge compteur
- Tableau : avatar, nom, email, permissions (toggles)
- **5 toggles de permissions par employé** :
  - Import, Achats, Ventes, Rapports, Stock
  - Toggle grisé si le propriétaire n'a pas cette permission (plafond pharmacie)
- Bouton "Révoquer l'accès"

### 14.2 Produits spéciaux (`/catalog-requests`)
- **Accès** : Propriétaire uniquement
- **Titre** : Produits spéciaux

**En-tête :**
- Bouton "Nouvelle demande"

**Liste des demandes :**
| Colonne | Description |
|---------|-------------|
| Produit | Nom + notes |
| Type | Badge Exclusion / Annulation |
| Statut | Badge En attente / Approuvé / Rejeté |
| Date | Création |
| Traité le | Date de traitement |

**Dialogue nouvelle demande :**
- Recherche de produit
- Liste avec checkboxes
- Champ notes (optionnel)
- Bouton "Soumettre la demande"

---

## 15. Navigation et mise en page

### Barre latérale (Sidebar)
- **Fond** : Bleu marine foncé (#071b2b)
- **Accent** : Cyan (#0CC0DF)
- **Logo** : Icône PharmaGest + "PharmaGest" + "Gestion Pharmacie"
- **Dépliable/repliable** : clic sur le logo ou bouton hamburger

**Éléments de navigation (filtrés par rôle) :**

| Élément | Icône | Rôles | Permission |
|---------|-------|-------|-----------|
| Tableau de bord | BarChart3 | Tous | — |
| Analyse | TrendingUp | Propriétaire, Employé | rapports |
| Comptabilité | Wallet | Propriétaire | — |
| Achats | ShoppingCart | Propriétaire, Employé | achat |
| Ventes | ShoppingBasket | Propriétaire, Employé | ventes |
| Alertes Stock | TriangleAlert | Propriétaire, Employé | stock |
| Mes employés | Users | Propriétaire | — |
| Produits spéciaux | PackageX | Propriétaire | — |
| Paramètres | Settings | Tous | — |
| Pharmacies | Building2 | Admin | — |
| Demandes d'exclusion | ClipboardCheck | Admin | — |
| Catalogue | BookOpen | Admin | — |

**Pied de page** : "© 2026 PharmaGest"

### En-tête (Header)
- **Titre de la page** (dynamique)
- **Badge de rôle** : Administrateur / Propriétaire / Employé (coloré)
- **Cloche de notifications** : badge compteur, popover avec liste
- **Toggle thème** : soleil/lune
- **Menu utilisateur** (dropdown) : avatar, nom, email, "Mon profil", "Se déconnecter"

---

## 16. Extension Chrome

### Popup
- Connexion au tableau de bord
- Indicateur de statut (connecté/déconnecté)
- Notifications d'import récentes
- Progression d'upload en cours

### Bannière d'upload (injectée sur Sobrus et le dashboard)
- **File d'attente** : plusieurs exports traités séquentiellement
- **Par export** :
  - Badge type (Achats/Ventes)
  - Barre de progression avec pourcentage
  - Ou "En attente..." si en queue
  - Ou résultat (lignes importées + doublons)
- **Bouton** "Annuler tout"
- **Auto-masquage** après 12 secondes une fois terminé
- **Nettoyage** : les jobs terminés sont supprimés du stockage au chargement de page

### Suivi par lot (batch)
- Chaque export crée un `ImportBatch` unique (même si découpé en chunks de 500 lignes)
- Le nom du fichier Sobrus est transmis (ex: "Sobrus - Achats 2025-03-29 - 2026-03-29")

---

## 17. Formules mathématiques — Référence complète

### Prix unitaire d'achat (PU)
```
PU = Σ(prix_unitaire_achat × quantité_achat) ÷ Σ(quantité_achat)
```
Moyenne pondérée par quantité, dans la plage de dates sélectionnée.
Si aucun achat dans la période → fallback sur PPH (prix catalogue).

**Exemple** : 1×124.23 + 1×129.20 + 2×129.20 = 511.83 ÷ 4 = **127.96 MAD**

### Chiffre d'affaires (CA)
```
CA = Σ(PPV × quantité_vendue)
```
Utilise `COALESCE(PPV, prix_unitaire_vente)` si PPV est null.

**Exemple** : PPV=162, qté=5 → CA = **810 MAD**

### Marge en pourcentage
```
Marge % = (1 − PU ÷ PPV) × 100
```
**Exemple** : PU=127.96, PPV=162 → (1 − 0.7899) × 100 = **21.0%**

### Marge brute (DH)
```
Marge brute = PPV − PU
```
**Exemple** : 162 − 127.96 = **34.04 MAD** par unité

### Marge nette (DH)
```
Marge nette = PPV_HT − PU_HT
PPV_HT = PPV ÷ (1 + taux_TVA)
PU_HT = PU ÷ (1 + taux_TVA)
```
**Exemple** : TVA=20% → 162/1.2 − 127.96/1.2 = 135.00 − 106.63 = **28.37 MAD**

### Marge moyenne
```
Marge_moy = Σ(quantité × marge%) ÷ Σ(quantité)
```
Moyenne pondérée par les quantités vendues.

### Ticket moyen
```
Ticket moyen = CA total ÷ nombre de transactions
```

### TVA encaissée
```
TVA_encaissée = Σ(PPV × quantité × taux_TVA ÷ (1 + taux_TVA))
```

### TVA payée
```
TVA_payée = Σ(PU × quantité × taux_TVA ÷ (1 + taux_TVA))
```

### TVA à déclarer
```
TVA_à_déclarer = TVA_encaissée − TVA_payée (estimation)
```

### Classification Stock ABCD
```
ratio = total_unités_vendues_12_mois ÷ 300
Stock MIN = floor(ratio × 14)
Stock MAX = ceil(ratio × 15)
```

### Santé financière
| Note | Condition |
|------|-----------|
| A+ | Marge moyenne > 30% |
| A | > 25% |
| B+ | > 20% |
| B | > 15% |
| C | > 10% |
| D | > 5% |
| F | ≤ 5% |

---

## 18. Système de permissions

### Matrice rôles × fonctionnalités

| Fonctionnalité | Admin | Propriétaire | Employé |
|----------------|-------|-------------|---------|
| Tableau de bord | ✅ (vue système) | ✅ (vue pharmacie) | ✅ (vue pharmacie) |
| Analyse | ❌ | ✅ | Selon permission |
| Comptabilité | ❌ | ✅ | ❌ |
| Achats | ❌ | ✅ | Selon permission |
| Ventes | ❌ | ✅ | Selon permission |
| Alertes Stock | ❌ | ✅ | Selon permission |
| Import CSV | ❌ | ✅ | Selon permission |
| Mes employés | ❌ | ✅ | ❌ |
| Produits spéciaux | ❌ | ✅ | ❌ |
| Paramètres (profil) | ✅ | ✅ | ✅ |
| Paramètres (zone danger) | ❌ | ✅ | ✅ |
| Pharmacies | ✅ | ❌ | ❌ |
| Catalogue | ✅ | ❌ | ❌ |
| Demandes d'exclusion | ✅ | ❌ | ❌ |

### Hiérarchie des permissions
```
Options pharmacie (plafond)
    └── Permissions propriétaire (ne peut pas dépasser les options pharmacie)
        └── Permissions employé (ne peut pas dépasser celles du propriétaire)
```

### 5 permissions configurables
| Permission | Contrôle l'accès à |
|-----------|-------------------|
| `rapports` | Tableau de bord, Analyse |
| `import` | Import CSV, bouton Importer dans Achats/Ventes |
| `achat` | Page Achats |
| `ventes` | Page Ventes |
| `stock` | Page Alertes Stock |

---

## 19. API Backend — Résumé des endpoints

| Module | Nombre | Exemples |
|--------|--------|----------|
| Auth | 8 | login, signup, me, forgot-password, verify-otp |
| Admin | 28 | pharmacies CRUD, users CRUD, catalog CRUD, suffixes |
| Owner | 6 | employees approve/reject/revoke/permissions |
| Uploads | 5 | achat CSV/JSON, vente CSV/JSON, catalog import |
| Data | 4 | clear achats/ventes, import batches list/delete |
| Transactions | 8 | list achats/ventes, categories, TVA rates, suggestions |
| Catalog Requests | 6 | submit, list, non-declare, annulation, approve, reject |
| Stats | 12+ | KPIs, analyse-marge, export-excel, margin-alerts, stock-abcd |
| Accounting | 3 | payments list/create/delete |
| Public | 1 | list pharmacies (sans auth) |
| **Total** | **~81** | |

---

*Document généré pour PharmaGest — © 2026*
