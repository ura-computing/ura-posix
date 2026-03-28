+ links apcm-pharma:
    + https://app.visily.ai/projects/bc3a025c-fdf4-4621-a44c-39b9dfbadded/boards/2505257

+ facebook adds-lbrary:
    + https://console.apify.com/actors/JJghSZmShuco4j9gJ/input
    + find pages that shared lot of adds (in a region) with specific keywords

+ check if there is way to design dataabse to be more dynamic
+ seperate main db from dev db
+ fix the bugs in achat
+ add all required security stuff, to avoid bombing the server or spaming it, and asql injestions etc..., all type of attacks that hacker might. use to access our dataabse or hack our website
+ the security stuff should be checked also during deployment

+ Parapharmacie - N transaction - 2:
+ example FAC-226539 → FAC-226539-2

+ apcm category:
    + Pharmacy -1 (Medicaments, Parapharmacie)
    + Parapharmacy -2 (Complement Alimentaire)
    + Pharmacy speciaux -3 (Homeopathie (to be checked))
    + Parapharmacy speciaux -4 (to be checked)

+ block cros origin from only one instance

+ the extension is not giving me the ability to canceling uploading files while thy are uploading
+ pharamacy owner, should also prove, the address, and city of the pharmacy, because we might have pharmacies with same name even on same city, but with different addresses (and that should be taken in consideration in the backend), and even the employee whne trying to signup he should select wish city and wich pharmacy (in thee slector in front of pahramcy name, we should provide the pahamacy address, to avoid confusion)


+ fix repeated values
+ nzed TVA delcary (achats, ventes): bttom page add calcul the merge de tva
+ add export button in rapport

+ tableau (add section TVA)
+ add unique button to export all Pharmacy
+ add unique button to export all Parapharmacy
+ merge dyal les achats et le ventyes must be in prcentage and currecy value

+ exportation dyal pharmacy / paraphacmcy 3zelhum

[17:48, 3/18/2026] Apcm: rapport 

ticket moyen

vente moyenne par jour

meilleur journée de vente en DH
meilleur journée de vente par nombre d opérations 

moins bonne journée de vente EN DH
moins bonne journée de vente par opérations
[17:51, 3/18/2026] Apcm: rapport montrer le total TVA encaissé et la TVA payé
[17:54, 3/18/2026] Mohammed Hrima: TVA = TVA vendue - TVA achat
[18:07, 3/18/2026] Apcm: achat 
5 x Strepsil a 20,01 DH TTC
la TVA est de 20% soit 5x20,01x20%=20,01
total TVA payé au fournisseur 20,01 DH

vente 
8 x Strepsil a 37,60 DH TTC
TVA 20%
8x37,60x20%=60,16 
TOtal TVA encaissée 60,16DH

lors de la déclaration de TVA 
c’est TVA encaissée - TVA payée
soit
60,16-20,01=40,15 

total TVA  a déclarée 40,15DH
[18:07, 3/18/2026] Apcm: rapport 

ticket moyen

vente moyenne par jour

meilleur journée de vente en DH
meilleur journée de vente par nombre d opérations 

moins bonne journée de vente EN DH
moins bonne journée de vente par opérations
ajouter 
le calcule de la marge en % 
et marge en DH
[18:09, 3/18/2026] Apcm: marge en %

(1-(PPH/PPV))x100
[18:10, 3/18/2026] Apcm: marge en DH brute 
PPV-PPH

marge DH net 
PPV HT - PPH HT
[18:15, 3/18/2026] Mohammed Hrima: PPV = 37,60 DH
PPV HT = 31,33 DH

PPH = 20,01 DH
PPH HT = 16,675 DH

marge en %

(1-(20,01/37,60))*100=46,782 %

marge brute en DH
37,60-20,01=17,59 DH

marge net 
31,333-16,675=14,658 DH

achat 
5 x Strepsil a 20,01 DH TTC
la TVA est de 20% soit 5x20,01x20%=20,01
total TVA payé au fournisseur 20,01 DH

vente 
8 x Strepsil a 37,60 DH TTC
TVA 20%
8x37,60x20%=60,16 
TOtal TVA encaissée 60,16DH

lors de la déclaration de TVA 
c’est TVA encaissée - TVA payée
soit
60,16-20,01=40,15 

total TVA  a déclarée 40,15DH



+ export dyal rapport:
    + remove la mrge
    + show only parapharmacies
    + show only pharamacy
    + genrate rappor:
        + list des medicamments
        + rapport in deferent tab

+ pharamcy:
    + Medicament
    + Produit chemique
    + Detiteque
    + compliment alimantair30%
    + romopathe
+ 

1. Les Produits de Pharmacie (Médicaments)
Hadou huma lli endhom l-marge l-kbira (fihom l-adwiya lli khashom l-ordonnance):

Médicament (33.930%): Hada houwa l-classification dyal l-ghalabiya dyal l-adwiya f l-meghrib.

Médicament (30.000%): Ba'd l-anwa3 dyal l-adwiya endhom had l-marge.

Médicament (29.747%): Hada koun ghaleban dakhla fih chi taxe khassa wala chi nida' khass.

Homéopathie (33.930%): Wakha hiya madiyousha b l-a'chab, mais t-tousif l-qanouni dyalha f l-meghrib ra dakhla m'a l-adwiya (Pharmacie).

2. Les Produits de Parapharmacie
Hadou huma lli ymken l-wahd ylqahom f mahal parapharmacie kharij l-pharmacie:

Parapharmacie (33.330%): Hada houwa l-standard dyal les produits de beauté (shampooing, crèmes, etc.).

Parapharmacie (30.000%): Ba'd l-marques wala les produits dyal l-hygiène.

Complement Alimentaire (33.330% / 30.000%): Vitamines, Magnésium, etc.

Diététique (15.000%): Hadou dakhlin fihom les produits dyal r-régime wala l-makla dyal s-sghar (Lait bébé ghaleban).

L-farq l-kbir bach t'qalihom:

Ila chfti 33.93%, rahouwa Médicament (Pharmacie pure).

Ila chfti 33.33%, rahouwa Parapharmacie (Cosmétique/Compléments).


+ section to show either the medament is pharmacy or prapharmacy in vente/achat tables
+ admin can set medicament type (pharamcy or parapharmacy)



+ adapt the color system of the entire web site to follow the collor system of pharmacies in morocco
+ mqke qll titiltle in cards bolder


+ instead of demande catalogue in owenr (the logic needs to be updated for both oowner and admin)
+ owener should do request for produit non declarer, and it will be send to admin to aprove it, prduit is based on the ones in catlagues, and if it's not dclare it won't be considere in rapport

+ in Analyse de marge:
    + add a button creer un analyse, where use can creare a anaylys sumulation, by selecting parudut, fourincieur etc.. based on all filter alrady used in alayse, it should no be saved in database since it's only a simulation done so owner can find what goes best for him


+ whenever you i stopped the backened , and run it again it seems like the tokesns already validate why ?
+ add forget password, functionality and in log in pgae
+ chrome store account for the extension
+ make batch loading pop up bigger (extension)
+ for colons show everything by default
+ list ventes:
    + update colors cimilar to the ones in rapport page
+ fix build
+ password reset
+ ask about fancounalty of produit non declare
+ ask about analyze
+ user (employee and owner) can't change information
+ verfy number option
+ can't chnage languege