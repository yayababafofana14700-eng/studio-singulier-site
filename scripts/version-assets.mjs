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

// Table : chemin tel qu'il apparaît dans le HTML  ->  empreinte
const versions = new Map();
for (const abs of [...fichiers(join(RACINE, 'css'), ['.css']), ...fichiers(join(RACINE, 'js'), ['.js'])]) {
  versions.set(relative(RACINE, abs).split(sep).join('/'), empreinte(abs));
}

// Ne réécrit que les URL dont le fichier existe réellement : une faute de
// frappe dans un chemin doit rester visible, pas être versionnée en silence.
const MOTIF = /(href|src)="((?:css|js)\/[^"?]+\.(?:css|js))(\?v=[^"]*)?"/g;

const pages = readdirSync(RACINE).filter((f) => f.endsWith('.html'));
let pagesModifiees = 0;
const introuvables = new Set();

for (const page of pages) {
  const chemin = join(RACINE, page);
  const avant = readFileSync(chemin, 'utf8');

  const apres = avant.replace(MOTIF, (complet, attr, fichier) => {
    const v = versions.get(fichier);
    if (!v) { introuvables.add(fichier); return complet; }
    return `${attr}="${fichier}?v=${v}"`;
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

console.log(
  pagesModifiees === 0
    ? `${pages.length} pages a jour, ${versions.size} assets.`
    : `${pagesModifiees}/${pages.length} pages ${CHECK ? 'perimees' : 'mises a jour'}, ${versions.size} assets.`
);

// --check échoue si une page est périmée ou si une référence est cassée.
if ((CHECK && pagesModifiees > 0) || introuvables.size > 0) process.exit(1);
