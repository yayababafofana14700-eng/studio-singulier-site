#!/usr/bin/env node
/*
  Assemble un carrousel LinkedIn et le rend en PDF.

      node scripts/carrousel.mjs prospection
      node scripts/carrousel.mjs signature

  Le fichier source vit dans archive/carrousel-<nom>.html. Il porte deux
  marqueurs que ce script remplace :

      __FONT__                      le base64 de la police, en woff2
      {{DOTS:202:46,153}}           202 balises <i>, celles d'indice 46 et
                                    153 portant class="on"

  Pourquoi un marqueur plutot que 202 balises ecrites a la main : le chiffre
  du titre et le nombre de points doivent etre le meme chiffre. Ecrits deux
  fois, ils divergent a la premiere correction.

  Chaque remplacement compte ses occurrences. Un motif introuvable arrete le
  script au lieu de produire un PDF qui a l'air juste : un fichier retouche a
  la main entre-temps doit faire echouer la commande, pas passer.

  Le rendu passe par Chrome ou Edge en mode impression, qui respectent la
  regle @page du gabarit. Format 540 x 675 px, soit le 4:5 des documents
  LinkedIn.
*/

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POLICE = path.join(RACINE, 'assets', 'fonts', 'jetbrains-mono-latin.woff2');

const NAVIGATEURS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function stop(message) {
  console.error('\n  ' + message + '\n');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Les points : un marqueur, un compte garanti                         */

function poserPoints(html) {
  const motif = /\{\{DOTS:(\d+):([\d,]*)\}\}/g;
  const trouves = html.match(motif);
  if (!trouves) stop('Aucun marqueur {{DOTS:...}} dans le gabarit. Rien a assembler.');

  let poses = 0;
  const sortie = html.replace(motif, (_, total, liste) => {
    const n = Number(total);
    const allumes = new Set(liste ? liste.split(',').map(Number) : []);
    for (const i of allumes) {
      if (i < 0 || i >= n) stop(`Indice ${i} hors des ${n} points demandes.`);
    }
    let points = '';
    for (let i = 0; i < n; i += 1) {
      points += allumes.has(i) ? '<i class="on"></i>' : '<i></i>';
    }
    /* Le compte est verifie sur la chaine produite, pas sur la boucle. */
    const compte = (points.match(/<i/g) || []).length;
    if (compte !== n) stop(`${compte} points produits au lieu de ${n}.`);
    poses += 1;
    console.log(`  points : ${n} dont ${allumes.size} en couleur`);
    return points;
  });

  if (poses !== trouves.length) stop('Un marqueur de points n\'a pas ete remplace.');
  return sortie;
}

/* ------------------------------------------------------------------ */
/* La police                                                           */

function poserPolice(html) {
  if (!html.includes('__FONT__')) stop('Le marqueur __FONT__ est absent du gabarit.');
  if (!fs.existsSync(POLICE)) stop('Police introuvable : ' + POLICE);
  const base64 = fs.readFileSync(POLICE).toString('base64');
  const sortie = html.split('__FONT__').join(base64);
  if (sortie.includes('__FONT__')) stop('La police n\'a pas ete injectee.');
  console.log(`  police : ${(base64.length / 1024).toFixed(0)} Ko en base64`);
  return sortie;
}

/* ------------------------------------------------------------------ */
/* Le rendu                                                            */

function rendre(htmlAbsolu, pdfAbsolu) {
  const navigateur = NAVIGATEURS.find((p) => fs.existsSync(p));
  if (!navigateur) stop('Ni Chrome ni Edge trouve. Le PDF ne peut pas etre rendu.');

  const url = 'file:///' + htmlAbsolu.replace(/\\/g, '/');
  execFileSync(navigateur, [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--print-to-pdf=' + pdfAbsolu,
    url,
  ], { stdio: 'pipe', timeout: 120000 });

  if (!fs.existsSync(pdfAbsolu)) stop('Le navigateur n\'a produit aucun PDF.');
  const octets = fs.statSync(pdfAbsolu).size;
  if (octets < 20000) stop(`PDF suspect : ${octets} octets seulement.`);
  console.log(`  rendu  : ${path.basename(navigateur)}, ${(octets / 1024).toFixed(0)} Ko`);
}

/* ------------------------------------------------------------------ */

const nom = process.argv[2];
if (!nom) {
  const dispos = fs.readdirSync(path.join(RACINE, 'archive'))
    .filter((f) => /^carrousel-.*\.html$/.test(f) && !f.includes('.build.'))
    .map((f) => f.replace(/^carrousel-|\.html$/g, ''));
  console.log('\nUsage : node scripts/carrousel.mjs <nom>');
  console.log('Carrousels prepares : ' + (dispos.join(', ') || 'aucun') + '\n');
  process.exit(dispos.length ? 0 : 1);
}

const source = path.join(RACINE, 'archive', `carrousel-${nom}.html`);
if (!fs.existsSync(source)) stop('Source introuvable : ' + source);

const assemble = path.join(RACINE, 'archive', `carrousel-${nom}.build.html`);
const pdf = path.join(RACINE, 'archive', `carrousel-${nom}.pdf`);

console.log(`\nCarrousel « ${nom} »`);

let html = fs.readFileSync(source, 'utf8');
const diapos = (html.match(/<section class="s"/g) || []).length;
if (diapos < 2) stop(`${diapos} diapo trouvee. Le gabarit est incomplet.`);
console.log(`  diapos : ${diapos}`);

html = poserPoints(html);
html = poserPolice(html);
fs.writeFileSync(assemble, html, 'utf8');
rendre(assemble, pdf);

console.log(`\n  ${path.relative(RACINE, pdf)}`);
console.log('  A deposer tel quel dans LinkedIn, en publication de type document.\n');
