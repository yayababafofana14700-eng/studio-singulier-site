#!/usr/bin/env node
/*
  Publie — ou retire — un outil tenu hors ligne dans le depot.

      node scripts/publier-outil.mjs                       etat des outils
      node scripts/publier-outil.mjs signature             publie
      node scripts/publier-outil.mjs signature --retirer   remet hors ligne
      node scripts/publier-outil.mjs gta6

  Une page preparee reste invisible tant que quatre choses sont vraies : la
  balise robots noindex est presente, aucune carte ne pointe vers elle sur la
  page Outils, elle est absente du sitemap et absente de llms.txt. Ce script
  bascule les quatre d'un coup, et sait revenir en arriere.

  Pourquoi un script plutot que des modifications posees a l'avance : une
  modification deja ecrite dans les fichiers part en ligne au premier push,
  meme declenche pour autre chose. Le depot reste hors ligne jusqu'a la
  commande.

  Chaque operation compte ses occurrences avant d'ecrire. Un motif introuvable
  arrete tout au lieu de reecrire un fichier inchange en silence : un fichier
  retouche a la main entre-temps doit faire echouer le script, pas passer.
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.apexwebstudio.studio/';

/* ------------------------------------------------------------------ */
/* Les outils prepares                                                 */

const OUTILS = {
  prospection: {
    page: 'outil-fiches-prospection.html',
    etiquette: 'Commercial',
    titre: 'G&eacute;n&eacute;rateur de fiches de prospection',
    accroche: 'Un vrai tableur dans le navigateur, vingt-deux mod&egrave;les dont douze par m&eacute;tier, et une recherche d\'&eacute;tablissements par ville ou par rayon. Export Excel et PDF.',
    nomLlms: 'Generateur de fiches de prospection commerciale',
    llms: 'met en place un fichier de prospection dans le navigateur, sans inscription et sans serveur : ' +
      'les donnees restent dans le navigateur du visiteur. Vingt-deux modeles, dont douze partent du metier ' +
      'demarche — salon de coiffure, restaurant, cabinet medical, bureau d\'etudes, batiment, commerce, ' +
      'hotellerie, formation, pharmacie, agence immobiliere, garage, transport — et dix de la methode de ' +
      'prospection. Tableur complet : colonnes typees, tri, filtres, annuler et retablir, feuilles derivees ' +
      'qui gardent le lien vers leur origine et se relancent quand la feuille mere change, fusion entre ' +
      'deux feuilles, recapitulatif par colonne. Import de classeurs .xlsx et de CSV, export Excel mis en ' +
      'forme, CSV et PDF paysage pagine. Une recherche d\'etablissements interroge OpenStreetMap par metier ' +
      'et par zone : une ville, une region, un pays, ou un rayon autour de la position du visiteur. ' +
      'Elle rend le nom, la position et souvent l\'adresse ; le telephone et le site sont rarement ' +
      'renseignes dans cette base au Maroc, et chaque ligne recoit un lien de recherche pour relever le ' +
      'contact manquant. Aucune coordonnee n\'est inventee.'
  },

  signature: {
    page: 'outil-signature-email.html',
    etiquette: 'Bureautique',
    titre: 'G&eacute;n&eacute;rateur de signature email',
    accroche: 'Une signature propre qui ne casse pas dans Outlook. Sans image, sans inscription, sans filigrane.',
    nomLlms: 'Generateur de signature email, compatible Outlook',
    llms: 'genere une signature email en HTML compatible Gmail, Outlook et Apple Mail. ' +
      'Construite en tableaux imbriques avec des styles en ligne, parce que Outlook pour Windows ' +
      'rend le HTML avec le moteur de Microsoft Word et ignore flexbox, la grille CSS, les marges ' +
      'exterieures et les coins arrondis. N\'utilise aucune image : les libelles sont en texte et ' +
      'le visuel est un monogramme dessine en HTML, donc rien ne disparait quand la messagerie du ' +
      'destinataire bloque les images. Trois modeles, copie mise en forme, export .html.'
  },
  gta6: {
    page: 'outil-gta6-maroc.html',
    etiquette: 'Jeux vid&eacute;o',
    titre: 'GTA 6 au Maroc : le v&eacute;rificateur',
    accroche: 'Le prix r&eacute;el en dirhams selon la voie d\'achat, le temps de t&eacute;l&eacute;chargement des 212 Go avec votre d&eacute;bit, et la place qu\'il reste sur votre console.',
    nomLlms: 'GTA 6 au Maroc, verificateur de prix et de telechargement',
    llms: 'calcule le prix reel en dirhams selon la voie d\'achat, parce qu\'il n\'existe ni ' +
      'PlayStation Store ni Microsoft Store marocain et que le tarif depend de la region du compte. ' +
      'Compare la cle revendeur marocaine, la recharge PSN achetee en dirhams et la carte bancaire ' +
      'sur compte etranger. Calcule aussi le temps de telechargement des 212 Go selon le debit et ' +
      'la place restante sur la console. Releve du 22 novembre 2026 : la recharge PSN revient a ' +
      '13,62 dirhams par euro contre 10,96 au taux bancaire, soit 24 % de plus.',
    releve: '2026-11-22',
    peremptionJours: 7
  }
};

/* ------------------------------------------------------------------ */
/* Outillage                                                           */

const lire = f => fs.readFileSync(path.join(RACINE, f), 'utf8');
const ecrire = (f, t) => fs.writeFileSync(path.join(RACINE, f), t, 'utf8');
const compte = (t, motif) => (t.match(motif) || []).length;
const echapperRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Les fichiers du depot sont en CRLF. Un motif ecrit en \n n'y correspond a
   rien, et un bloc insere en \n y laisserait des fins de ligne mixtes que Git
   signalerait a chaque commit. On lit la fin de ligne du fichier et on y
   conforme ce qu'on ecrit, au lieu de la supposer. */
const finDeLigne = t => (t.includes('\r\n') ? '\r\n' : '\n');
const auFormat = (modele, t) => modele.replace(/\n/g, finDeLigne(t));

function exige(reel, attendu, quoi, fichier) {
  if (reel !== attendu) {
    throw new Error(
      `${fichier} : ${quoi} — ${attendu} occurrence(s) attendue(s), ${reel} trouvee(s).\n` +
      '  Le fichier a change depuis la preparation du script. Verifiez-le avant de relancer.'
    );
  }
}

function aujourdhui() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const MOTS = ['zero', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
const PHRASE_DECOMPTE = /Les (\w+) outils s'executent entierement/;

/* Le decompte se calcule au lieu d'etre code en dur : publier un deuxieme
   outil apres un premier ferait mentir « Les cinq outils » sinon. */
function accorderDecompte(t) {
  const apresTitre = t.split('## Outils gratuits')[1] || '';
  const avantServices = apresTitre.split('## Services')[0] || '';
  const n = compte(avantServices, /^- \[/gm);
  const mot = MOTS[n];
  if (!mot) { throw new Error(`llms.txt : ${n} outils, aucun mot prevu pour ce nombre.`); }
  return t.replace(PHRASE_DECOMPTE, `Les ${mot} outils s'executent entierement`);
}

/* ------------------------------------------------------------------ */
/* Les quatre operations, construites pour un outil donne              */

function operations(cle) {
  const o = OUTILS[cle];
  const adresse = SITE + o.page;
  const pageRegex = echapperRegex(o.page);

  const BLOC_ROBOTS =
    '\n<!-- ===== MISE EN LIGNE : supprimer la seule ligne robots ci-dessous le jour de la publication ===== -->\n' +
    '<meta name="robots" content="noindex, nofollow">\n';

  const ANCRE_CANONICAL = new RegExp(
    `<link rel="canonical" href="${echapperRegex(adresse)}">\\r?\\n`, 'g');

  const robots = {
    nom: 'balise robots noindex',
    fichier: o.page,
    estPose: t => !t.includes('name="robots" content="noindex'),
    poser(t) {
      exige(compte(t, /name="robots" content="noindex, nofollow"/g), 1, 'balise noindex', o.page);
      const sortie = t.replace(auFormat(BLOC_ROBOTS, t), '');
      exige(compte(sortie, /name="robots"/g), 0, 'balise robots apres retrait', o.page);
      return sortie;
    },
    retirer(t) {
      exige(compte(t, ANCRE_CANONICAL), 1, 'lien canonical', o.page);
      return t.replace(ANCRE_CANONICAL, m => m + auFormat(BLOC_ROBOTS, t));
    }
  };

  const CARTE =
`
      <a class="outil-carte" href="${o.page}">
        <span class="o-etiquette">${o.etiquette}</span>
        <h3>${o.titre}</h3>
        <p>${o.accroche}</p>
        <span class="outil-carte-pied">Ouvrir l'outil <span class="arrow" aria-hidden="true">&rarr;</span></span>
      </a>
`;

  /* La carte se pose en dernier dans la grille, juste avant sa fermeture,
     reperee par le bloc publicitaire qui la suit et n'existe qu'une fois. */
  const FIN_GRILLE = /\r?\n    <\/div>\r?\n\r?\n    <div class="o-pub" aria-hidden="true"><\/div>/g;
  const LIEN_CARTE = new RegExp(`href="${pageRegex}"`, 'g');

  const carte = {
    nom: 'carte sur la page Outils',
    fichier: 'outils.html',
    estPose: t => t.includes(`href="${o.page}"`),
    poser(t) {
      exige(compte(t, LIEN_CARTE), 0, 'carte deja posee', 'outils.html');
      exige(compte(t, FIN_GRILLE), 1, 'fin de la grille des outils', 'outils.html');
      return t.replace(FIN_GRILLE, m => auFormat(CARTE, t) + m);
    },
    retirer(t) {
      exige(compte(t, LIEN_CARTE), 1, 'carte a retirer', 'outils.html');
      const sortie = t.replace(auFormat(CARTE, t), '');
      exige(compte(sortie, LIEN_CARTE), 0, 'carte apres retrait', 'outils.html');
      return sortie;
    }
  };

  const sitemap = {
    nom: 'entree du sitemap',
    fichier: 'sitemap.xml',
    estPose: t => t.includes(adresse),
    poser(t) {
      exige(compte(t, new RegExp(pageRegex, 'g')), 0, 'entree deja presente', 'sitemap.xml');
      exige(compte(t, /<\/urlset>/g), 1, 'fermeture urlset', 'sitemap.xml');
      const bloc = auFormat(
        `  <url>\n    <loc>${adresse}</loc>\n    <lastmod>${aujourdhui()}</lastmod>\n  </url>\n`, t);
      return t.replace('</urlset>', bloc + '</urlset>');
    },
    retirer(t) {
      const bloc = new RegExp(
        `  <url>\\r?\\n    <loc>${echapperRegex(adresse)}</loc>\\r?\\n    <lastmod>[\\d-]+</lastmod>\\r?\\n  </url>\\r?\\n`, 'g');
      exige(compte(t, bloc), 1, 'bloc url a retirer', 'sitemap.xml');
      return t.replace(bloc, '');
    }
  };

  /* llms.txt est volontairement sans accents : les moteurs qui l'avalent le
     lisent en texte brut, et une page mal encodee ailleurs l'a deja tronque. */
  const PUCE = `\n- [${o.nomLlms}](${adresse}) : ${o.llms}`;
  const ANCRE_LLMS = /\r?\n\r?\n## Services/g;

  const llms = {
    nom: 'fiche dans llms.txt',
    fichier: 'llms.txt',
    estPose: t => t.includes(o.page),
    poser(t) {
      exige(compte(t, new RegExp(pageRegex, 'g')), 0, 'fiche deja presente', 'llms.txt');
      exige(compte(t, ANCRE_LLMS), 1, 'section Services', 'llms.txt');
      exige(compte(t, new RegExp(PHRASE_DECOMPTE.source, 'g')), 1, 'decompte des outils', 'llms.txt');
      return accorderDecompte(t.replace(ANCRE_LLMS, m => auFormat(PUCE, t) + m));
    },
    retirer(t) {
      exige(compte(t, new RegExp(pageRegex, 'g')), 1, 'fiche a retirer', 'llms.txt');
      const sortie = t.replace(auFormat(PUCE, t), '');
      exige(compte(sortie, new RegExp(pageRegex, 'g')), 0, 'fiche apres retrait', 'llms.txt');
      return accorderDecompte(sortie);
    }
  };

  return [robots, carte, sitemap, llms];
}

/* ------------------------------------------------------------------ */

function etat(cle) {
  return operations(cle).map(op => ({ op, pose: op.estPose(lire(op.fichier)) }));
}

function resume(cle) {
  const e = etat(cle);
  if (e.every(x => x.pose)) { return 'en ligne'; }
  if (e.every(x => !x.pose)) { return 'hors ligne'; }
  return 'etat mixte';
}

function avertirFraicheur(cle) {
  const o = OUTILS[cle];
  if (!o.releve) { return; }
  const jours = Math.floor((Date.now() - Date.parse(o.releve)) / 86400000);
  if (jours > (o.peremptionJours || 7)) {
    console.log('');
    console.log(`  ! Les chiffres de la page datent du ${o.releve}, soit ${jours} jours.`);
    console.log('    Revoyez-les avant de pousser : une page de prix perimee se fait');
    console.log('    citer de travers par les moteurs.');
  }
}

function principal() {
  const args = process.argv.slice(2);
  const cle = args.find(a => !a.startsWith('--'));
  const retirer = args.includes('--retirer');

  if (!cle) {
    console.log('Outils prepares :\n');
    Object.keys(OUTILS).forEach(k => {
      console.log(`  ${k.padEnd(12)} ${resume(k).padEnd(12)} ${OUTILS[k].page}`);
    });
    console.log('\nUsage : node scripts/publier-outil.mjs <outil> [--retirer]');
    return;
  }
  if (!OUTILS[cle]) {
    throw new Error(`Outil inconnu : « ${cle} ». Connus : ${Object.keys(OUTILS).join(', ')}.`);
  }

  const avant = etat(cle);
  const action = retirer ? 'retirer' : 'poser';

  if (avant.every(e => (retirer ? !e.pose : e.pose))) {
    console.log(retirer ? 'Deja hors ligne, rien a faire.' : 'Deja publie, rien a faire.');
    return;
  }

  /* On calcule les quatre resultats avant d'ecrire quoi que ce soit : si la
     troisieme operation echoue, les deux premieres ne doivent pas etre sur le
     disque. Une publication a moitie faite est pire qu'une publication ratee. */
  const resultats = [];
  for (const { op, pose } of avant) {
    if (retirer ? !pose : pose) { continue; }
    resultats.push({ op, texte: op[action](lire(op.fichier)) });
  }

  resultats.forEach(({ op, texte }) => {
    ecrire(op.fichier, texte);
    console.log(`  ${retirer ? 'retire' : 'pose'} : ${op.nom}  (${op.fichier})`);
  });

  console.log('');
  if (retirer) {
    console.log('Outil remis hors ligne. Poussez pour que ce soit effectif.');
    return;
  }
  console.log('Outil publie dans les fichiers. Il reste a pousser :');
  console.log(`    git add ${OUTILS[cle].page} outils.html sitemap.xml llms.txt`);
  console.log(`    git commit -m "feat: ${OUTILS[cle].page.replace(/\.html$/, '')}"`);
  console.log('    git push');
  console.log('');
  console.log('Puis, dans Search Console, inspectez l\'URL et demandez l\'indexation :');
  console.log(`    ${SITE}${OUTILS[cle].page}`);
  avertirFraicheur(cle);
}

/* Importable sans effet de bord, pour pouvoir tester les operations une a une. */
const lanceDirectement =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (lanceDirectement) {
  try {
    principal();
  } catch (e) {
    console.error(`\nArret : ${e.message}\n`);
    process.exit(1);
  }
}

export { OUTILS, operations, etat, resume };
