+ links apcm-pharma:
    + https://app.visily.ai/projects/bc3a025c-fdf4-4621-a44c-39b9dfbadded/boards/2505257

+ facebook adds-lbrary:
    + https://console.apify.com/actors/JJghSZmShuco4j9gJ/input
    + find pages that shared lot of adds (in a region) with specific keywords

- take the whole stocksection and put it under  "Alertes Marges" in dashboard

this is  a huge kinda reforctoring so take your time
and ask questions if you are confused with anything

check "resources/screenshots/screen8.png"
in "/analyse"
the ui should look the exacat same as the image
the carts should b seprated as shown in the image

+ dans tous les filter de date
    + toujour selctione les mois en cour (dans tous les filter de date)
    + mois actuel
    + mois antérieur
    + trimestre antérieur
    + année antérieur


+ "Chiffre d'affaire" cart:
    + compaire smae data from the previous year:
        + au/du comparer par l'annee precedante 

+ for date input, write it manually

+ "Alertes Marges" carts: "/rapports"
    + voir un pop up (tableau de details):
        + contiens tous les produit concerné
        + filter les infromation de  chaque column


+ "/stock":
    + les cartes hsould be cliquebale
    + filter "stock" de "Statut"
    + prends les 12 derniers mois
    + Produits classe:
        + organizer par "stock actuel" have problem:
            + http://localhost:8000/stats/stock-abcd?date_from=2025-12-04
            + it take on consideration only date, it should also use the filter on the first
            row of the table


+ dark/mode styling

+ filtre example:
    + *anthe: tous les mos qui contiennent cetter partie de mot "anthe"

+ "/ventes":
    + exporter 2eme tableau

+ fixer "unités disponibles" dans "/analyse"

+ "/analyse" 
    - ajout filtre des operateurs (a voir apprés)
    + filter par date: check "filter-par-date.png"
    + ajouter visblite graphique
    + when exporting file (take in consideration the filter):
        + there is also another problem because it shows the name of the providers
    + tableau:
        + add filter

+ when searching for produit "try mathcing name" like with 90% accurency
    + test withh "HELIOCARE 360°SPORT TRANSPAENT STICK SPF50+ 25G"
    + dans tous les search inputs
        + prends en conciderence code bar: example "8470002024434"  



+ refactor the code:
    + it shoud use stock when searching for stuff


STOCK:
Analyse stockpour ABCD

12 derniers mois
Mais la regle:
Du 01-01 au 30-06 de l année en cours, montrer l analyse de l année anterieu complete

Quand la date est entre 01-07 au 31-12 de l année en cours montrer l analyse du 01-07 année antérieur au 30-06 de l année en cours 

Exnous le sommes le 02-05-26l analyse du stock doit montrer du 01-01-25 au 31-12-25quand on sera le 01-07-2026, 
l analyse du stock  montrera du 01-07-25 au 30-06-26


+ DOLIPRANE CO 1000MG B10 COMP: (A)
    + 2359 | 4 | 6
    + 2359 | 2359/300*14=110 (chiffre entier inferieur) | 2359/300*15=118 (chiffre entier superieur)

+ export in alert (xls/pdf)



+ produit speciaux (don't ask for admin permission)
+ pour admin or owner (they can create accounts):
    + send a request to email of the new employer then employer recieve a link to enter his password
    + reactivation de  mot de passe

+ pour employer: il doit pas avoir la possiblité de creer un compte
    + 

+ owner:
    + when creating account:
        + la ville (required):
            + example:
                + Pharmacie Les Joyaux
                    + Bouskoura -> BOU0001 (pharmacy code) (identifiant de pharmacy)

+ Produits spéciaux:
    + add "selection tous" after searching
    + add searching unsing fourniceur name
    +

+ "/comptabilite":
    + ajouter filtre: avec/sans produit speciaux

+ owner:
    + produit speciaux (dans "/parametres") sous forme de pourcentage %

+ "/rapports" minimize 1st section

+ "/comptabilite":
    + les exports selon les filtres:
        + pharmacie, parapharmacie
        + si mxte, dqns l excel faire apparaitre les 2 sections phamacie et parapharmacie


+ systeme de recherche par mots ou groupe de mots:
    + exemple je cherche un produit de la marque La Roche Posay de la gamme Anthelios:
        + *anthel
        + *roche*anthe



