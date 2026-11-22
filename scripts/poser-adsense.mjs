#!/usr/bin/env node
/**
 * poser-adsense.mjs — insère ou retire la balise AdSense dans toutes les pages.
 *
 * Pourquoi un script
 * ------------------
 * Google exige le code sur l'ensemble des pages du site pour instruire la
 * demande, pas seulement sur celles qui porteront des annonces. Le site compte
 * une douzaine de pages : les modifier à la main, c'est une page oubliée et un
 * examen refusé sans que la cause soit visible.
 *
 * Le script est idempotent : relancé, il ne pose pas la balise deux fois. Un
 * doublon ne provoque pas d'erreur visible mais fausse les mesures d'AdSense.
 *
 * Usage
 * -----
 *   node scripts/poser-adsense.mjs --id ca-pub-0000000000000000
 *   node scripts/poser-adsense.mjs --id ca-pub-0000000000000000 --verifier
 *   node scripts/poser-adsense.mjs --retirer
 *
 *       --id        identifiant éditeur, visible dans AdSense > Compte
 *       --verifier  n'écrit rien, dit seulement où en est chaque page
 *       --retirer   enlève la balise partout
 *
 * Après la pose
 * -------------
 *   git add -A && git commit && git push
 *
 * Ce que le script ne fait pas
 * ----------------------------
 * Il pose la balise des annonces automatiques, celle qui sert à la fois à la
 * vérification du site et à la diffusion. Il ne crée pas de blocs d'annonces
 * nommés : ceux-là se créent dans l'interface AdSense et s'insèrent ensuite
 * dans les conteneurs .o-pub déjà présents sur les pages d'outils, qui
 * réservent 106 px de hauteur pour éviter que la page saute au chargement.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* Reconnaît la balise déjà posée, quel que soit l'identifiant : c'est ce qui
   rend le script idempotent et permet --retirer sans connaître l'id. */
const BALISE_POSEE = /[ \t]*<script[^>]*adsbygoogle\.js[^>]*><\/script>\r?\n?/g;

/* Le commentaire repère s'ouvre ET se ferme par des signes égal, pas par des
   tirets. Un motif attendant `-+ -->` ne correspondait à rien : la balise se
   posait alors avant </head> en laissant le commentaire en place, ce qui
   donnait une page juste en apparence avec une consigne obsolète dedans. */
const MARQUEUR = /[ \t]*<!--\s*=+\s*ADSENSE\s*=+[\s\S]*?-->\r?\n?/;

/* Le commentaire repère contient un exemple de balise, en texte. Le détecter
   comme une vraie pose ferait croire la page déjà équipée, et --retirer
   effacerait une ligne de documentation. On neutralise donc les commentaires
   avant toute recherche, en gardant la longueur pour que les positions
   trouvées restent valables sur le texte d'origine. */
function horsCommentaires(t) {
  return t.replace(/<!--[\s\S]*?-->/g, c => ' '.repeat(c.length));
}

function emplacements(t) {
  const masque = horsCommentaires(t);
  const trouves = [];
  let m;
  BALISE_POSEE.lastIndex = 0;
  while ((m = BALISE_POSEE.exec(masque)) !== null) {
    trouves.push([m.index, m.index + m[0].length]);
  }
  return trouves;
}

function balise(id) {
  return '<script async src="https://pagead2.googlesyndication.com/pagead/js/' +
    `adsbygoogle.js?client=${id}" crossorigin="anonymous"></script>`;
}

function lireArguments(argv) {
  const o = { id: null, verifier: false, retirer: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--verifier') o.verifier = true;
    else if (a === '--retirer') o.retirer = true;
    else if (a === '--id') o.id = argv[++i];
    else throw new Error(`argument inconnu : ${a}`);
  }
  if (!o.retirer && !o.verifier && !o.id) {
    throw new Error(
      'il manque --id.\n' +
      '  L\'identifiant éditeur est dans AdSense > Compte > Informations.\n' +
      '  Forme attendue : ca-pub- suivi de 16 chiffres.'
    );
  }
  if (o.id && !/^ca-pub-\d{16}$/.test(o.id)) {
    throw new Error(
      `identifiant invalide : ${o.id}\n` +
      '  Forme attendue : ca-pub- suivi de exactement 16 chiffres.\n' +
      '  Un identifiant erroné ne produit aucune erreur visible : la balise\n' +
      '  se charge et aucune annonce ne s\'affiche jamais.'
    );
  }
  return o;
}

function pages() {
  return fs.readdirSync(RACINE).filter(f => f.endsWith('.html')).sort();
}

function principal() {
  let o;
  try {
    o = lireArguments(process.argv.slice(2));
  } catch (e) {
    console.error(`\n  ${e.message}\n`);
    process.exit(2);
  }

  const liste = pages();
  if (!liste.length) {
    console.error('\n  Aucune page HTML a la racine. Lancez le script depuis le depot.\n');
    process.exit(1);
  }

  let poses = 0, deja = 0, retires = 0, sansTete = 0;

  for (const nom of liste) {
    const chemin = path.join(RACINE, nom);
    const brut = fs.readFileSync(chemin, 'utf8');
    const crlf = brut.includes('\r\n');
    let t = brut.replace(/\r\n/g, '\n');

    const trouves = emplacements(t);
    const presente = trouves.length > 0;

    if (o.verifier) {
      console.log(`  ${presente ? 'posee  ' : 'absente'}  ${nom}`);
      if (presente) deja++;
      continue;
    }

    if (o.retirer) {
      if (!presente) continue;
      for (const [debut, fin] of trouves.reverse()) {
        t = t.slice(0, debut) + t.slice(fin);
      }
      retires++;
    } else {
      if (presente) { deja++; continue; }

      const ligne = balise(o.id);

      /* Sur les pages d'outils, la balise prend la place du commentaire
         repere ; ailleurs, elle se glisse juste avant </head>. */
      if (MARQUEUR.test(t)) {
        t = t.replace(MARQUEUR, ligne + '\n');
      } else if (t.includes('</head>')) {
        t = t.replace('</head>', ligne + '\n</head>');
      } else {
        console.log(`  ignoree (pas de </head>)  ${nom}`);
        sansTete++;
        continue;
      }
      poses++;
    }

    fs.writeFileSync(chemin, crlf ? t.replace(/\n/g, '\r\n') : t, 'utf8');
    console.log(`  ${o.retirer ? 'retiree' : 'posee  '}  ${nom}`);
  }

  console.log('');
  if (o.verifier) {
    console.log(`  ${deja}/${liste.length} pages portent la balise.`);
    if (deja < liste.length) {
      console.log('  Google demande le code sur TOUTES les pages du site pour');
      console.log('  instruire la demande.');
    }
  } else if (o.retirer) {
    console.log(`  ${retires} page(s) nettoyee(s).`);
  } else {
    console.log(`  ${poses} page(s) equipee(s)` +
      (deja ? `, ${deja} l'etaient deja` : '') +
      (sansTete ? `, ${sansTete} ignoree(s)` : '') + '.');
    console.log('  Poussez le site, puis demandez la verification dans AdSense.');
  }
  console.log('');
}

principal();
