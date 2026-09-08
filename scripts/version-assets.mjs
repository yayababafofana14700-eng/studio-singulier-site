#!/usr/bin/env node
/**
 * version-assets.mjs — remplace le `?v=` des feuilles et des scripts par une
 * empreinte de leur contenu.
 *
 * Pourquoi
 * --------
 * Le `?v=` était saisi à la main et devait être incrémenté dans les dix pages
 * à chaque modification de CSS ou de JS. Un oubli ne produit aucune erreur :
 * le navigateur sert simplement l'ancienne version, et le défaut ne se voit
 * que chez le visiteur.
 *
 * Ici l'empreinte vient du fichier lui-même. Elle ne peut pas être oubliée,
 * et elle ne change que si le contenu change — modifier style.css ne fait
 * plus expirer le cache de main.js.
 *
 * C'est ce qui rend légitime le `immutable` posé sur /css/ et /js/ dans
 * vercel.json : l'URL change dès que l'octet change.
 *
 * Usage
 * -----
 *   node scripts/version-assets.mjs          applique
 *   node scripts/version-assets.mjs --check  n'écrit rien, sort en 1 si
 *                                            une page est périmée
 *
 * Le mode --check sert de garde avant un commit ou un déploiement.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

/** Empreinte courte et stable d'un fichier. 8 caractères hexadécimaux :
 *  4 milliards de valeurs, largement assez pour distinguer les versions
 *  successives d'un même fichier. */
function empreinte(chemin) {
  return createHash('sha256').update(readFileSync(chemin)).digest('hex').slice(0, 8);
}

/** Liste récursive des fichiers d'un dossier portant l'une des extensions. */
function fichiers(dossier, extensions) {
  const trouve = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) trouve.push(...fichiers(chemin, extensions));
    else if (extensions.some((e) => entree.endsWith(e))) trouve.push(chemin);
  }
  return trouve;
}

/** Minifie une source et renvoie son code.
 *
 *  47 % du CSS de ce site est du commentaire. Ils expliquent chaque cote et
 *  chaque arbitrage, et doivent rester dans les sources — mais rien n'oblige
 *  a les envoyer au visiteur. Les fichiers servis sont donc des copies
 *  minifiees, generees ici et JAMAIS editees a la main.
 *
 *  esbuild, et non un minifieur maison : ce CSS emploie calc(), clamp() et
 *  max(), ou les espaces autour des operateurs sont OBLIGATOIRES. Un retrait
 *  naif des blancs casserait silencieusement la mise en page.
 */
function minifier(abs) {
  const estCss = abs.endsWith('.css');
  const source = readFileSync(abs, 'utf8');
  const { code } = transformSync(source, {
    loader: estCss ? 'css' : 'js',
    minify: true,
    legalComments: 'none',
  });
  return { source, code, cible: abs.replace(/\.(css|js)$/, '.min.$1') };
}

// Table : chemin de la SOURCE tel qu'il apparaît dans le HTML
//         ->  { fichier réellement servi, empreinte de son contenu }
const versions = new Map();
let octetsAvant = 0;
let octetsApres = 0;

const sources = [...fichiers(join(RACINE, 'css'), ['.css']), ...fichiers(join(RACINE, 'js'), ['.js'])]
  .filter((f) => !/\.min\.(css|js)$/.test(f));

// Les bibliotheques tierces arrivent deja minifiees (js/vendor/*.min.js).
// On ne les repasse pas dans esbuild : rien a gagner, et le risque de casser
// un code qu'on n'a pas ecrit. Elles sont servies telles quelles, mais
// versionnees comme le reste — sans quoi le cache d'un an de vercel.json les
// figerait pour de bon.
const generes = new Set(sources.map((f) => f.replace(/\.(css|js)$/, '.min.$1')));
for (const abs of [...fichiers(join(RACINE, 'css'), ['.css']), ...fichiers(join(RACINE, 'js'), ['.js'])]) {
  if (!/\.min\.(css|js)$/.test(abs) || generes.has(abs)) continue;
  const cle = relative(RACINE, abs).split(sep).join('/');
  versions.set(cle, { servi: cle, v: empreinte(abs) });
}

for (const abs of sources) {
  const { source, code, cible } = minifier(abs);
  octetsAvant += source.length;
  octetsApres += code.length;
  if (!CHECK) writeFileSync(cible, code, 'utf8');
  versions.set(relative(RACINE, abs).split(sep).join('/'), {
    servi: relative(RACINE, cible).split(sep).join('/'),
    v: createHash('sha256').update(code).digest('hex').slice(0, 8),
  });
}

// Ne réécrit que les URL dont le fichier existe réellement : une faute de
// frappe dans un chemin doit rester visible, pas être versionnée en silence.
const MOTIF = /(href|src)="((?:css|js)\/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"/g;

const pages = readdirSync(RACINE).filter((f) => f.endsWith('.html'));
let pagesModifiees = 0;
const introuvables = new Set();

for (const page of pages) {
  const chemin = join(RACINE, page);
  const avant = readFileSync(chemin, 'utf8');

  const apres = avant.replace(MOTIF, (complet, attr, fichier) => {
    // `fichier` peut etre une source (css/style.css), sa version minifiee
    // (css/style.min.css) ou une bibliotheque deja minifiee. On essaie tel
    // quel, puis en retirant le .min pour retrouver la source.
    const e = versions.get(fichier) || versions.get(fichier.replace(/\.min\.(css|js)$/, '.$1'));
    if (!e) { introuvables.add(fichier); return complet; }
    return `${attr}="${e.servi}?v=${e.v}"`;
  });

  if (apres !== avant) {
    pagesModifiees++;
    if (!CHECK) writeFileSync(chemin, apres, 'utf8');
    console.log(`  ${CHECK ? 'perimee' : 'mise a jour'} : ${page}`);
  }
}

for (const f of introuvables) {
  console.error(`  ATTENTION : ${f} est reference dans le HTML mais absent du disque`);
}

const ko = (o) => (o / 1024).toFixed(0);
console.log(
  `  minification : ${ko(octetsAvant)} Ko -> ${ko(octetsApres)} Ko ` +
  `(-${Math.round(100 - (octetsApres / octetsAvant) * 100)} %)`
);

console.log(
  pagesModifiees === 0
    ? `${pages.length} pages a jour, ${versions.size} assets.`
    : `${pagesModifiees}/${pages.length} pages ${CHECK ? 'perimees' : 'mises a jour'}, ${versions.size} assets.`
);

// --check échoue si une page est périmée ou si une référence est cassée.
if ((CHECK && pagesModifiees > 0) || introuvables.size > 0) process.exit(1);
