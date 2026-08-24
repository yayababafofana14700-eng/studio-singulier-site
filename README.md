# Studio Singulier — site

Site vitrine de Studio Singulier, agence digitale à Casablanca.
Site statique : HTML, CSS et JavaScript, sans build ni dépendance à installer.

## Structure

```
index.html                 Accueil
sites-web.html             01 — Sites web & solutions digitales
reseaux-sociaux.html       02 — Réseaux sociaux & contenu
ecommerce-shopify.html     03 — E-commerce & Shopify
visibilite-locale.html     04 — Visibilité locale
automatisation.html        05 — Automatisation
agents-ia.html             Agents IA
methode.html               Méthode
a-propos.html              À propos
contact.html               Contact

css/    style.css (socle) · pages.css (sections) · responsive.css (@media) · page-*.css
js/     animations.js (GSAP, Lenis) · main.js (menu, dépliant, FAQ, formulaire, horloge)
js/vendor/  GSAP, ScrollTrigger et Lenis, servis en local et non depuis un CDN
assets/ images WebP + la vidéo du hero
scripts/version-assets.mjs   recalcule les empreintes de cache (voir plus bas)
POUSSER-SUR-GITHUB.bat       déploiement : contrôles, recalcul, push
```

## Déployer

Double-clic sur le raccourci **POUSSER SUR GITHUB** du Bureau, qui pointe
vers `POUSSER-SUR-GITHUB.bat` à la racine du projet.

Le script refuse de partir si des fichiers ne sont pas commités. Ce n'est
pas de la prudence excessive : il recalcule ensuite les empreintes d'assets,
et le faire sur un CSS non commité écrirait dans les pages la version d'un
fichier que le serveur ne recevra jamais.

## Déploiement

Hébergé sur Vercel, déployé automatiquement à chaque `push` sur `main`.
Aucune commande de build : Vercel sert les fichiers tels quels.

`vercel.json` porte les en-têtes de sécurité et la politique de cache.

## Changer le domaine

Les balises `canonical`, Open Graph et les données structurées JSON-LD
contiennent des **URL absolues** — obligatoire pour Google et pour les
aperçus de lien WhatsApp, Facebook et LinkedIn.

En cas de changement de domaine, remplacer toutes les occurrences de
l'ancien domaine dans les 10 fichiers HTML.

## Cache

Les feuilles de style et les scripts portent un paramètre de version
(`?v=…`) qui est **l'empreinte de leur contenu**, pas une date.

Après toute modification de CSS ou de JS :

```
node scripts/version-assets.mjs
```

Le script recalcule l'empreinte de chaque fichier et réécrit les dix pages.
Il est idempotent : le relancer sans avoir rien changé ne touche à rien.

Pour vérifier sans écrire — utile avant un commit ou un déploiement :

```
node scripts/version-assets.mjs --check
```

Il sort en 1 si une page est périmée, ou si le HTML référence un fichier
absent du disque.

Chaque asset a sa propre empreinte : modifier `style.css` ne fait pas
expirer le cache de `main.js`.

C'est ce qui rend sûr le `max-age=31536000, immutable` posé sur `/css/` et
`/js/` dans `vercel.json` — l'URL change dès que l'octet change. Sans ce
script, ces en-têtes serviraient un fichier périmé pendant un an.

## Formulaire de contact

Le formulaire passe par Web3Forms. La clé d'accès visible dans le code est
publique par conception : elle ne donne aucun droit de lecture.

La protection anti-spam (Cloudflare Turnstile) doit être activée depuis le
tableau de bord Web3Forms.
