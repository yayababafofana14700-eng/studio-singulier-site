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
assets/ images WebP + la vidéo du hero
```

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
(`?v=…`). **À chaque modification de CSS ou de JS, incrémenter ce numéro
dans les 10 pages**, sinon les navigateurs continuent de servir l'ancienne
version.

## Formulaire de contact

Le formulaire passe par Web3Forms. La clé d'accès visible dans le code est
publique par conception : elle ne donne aucun droit de lecture.

La protection anti-spam (Cloudflare Turnstile) doit être activée depuis le
tableau de bord Web3Forms.
