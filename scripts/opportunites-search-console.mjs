#!/usr/bin/env node
/**
 * opportunites-search-console.mjs — lit la Search Console et dit quel outil
 * construire ensuite.
 *
 * Pourquoi
 * --------
 * La recherche de mots-clés faite à la main coûte des heures et répond à côté :
 * elle part de ce qu'on imagine que les gens cherchent. La Search Console, elle,
 * sait sur quelles requêtes le site apparaît DÉJÀ, à quelle position, et
 * combien de fois sans être cliqué. C'est une mesure, pas une intuition.
 *
 * Deux signaux valent un outil neuf :
 *
 *   1. Une requête où le site est entre la 8e et la 30e position avec des
 *      impressions réelles. Google a jugé la page assez pertinente pour la
 *      montrer, mais pas assez pour la classer. Une page dédiée à cette
 *      requête précise monte souvent de dix rangs d'un coup.
 *
 *   2. Une requête précise qui atterrit sur le hub (outils.html) ou sur
 *      l'accueil. Cela veut dire que la page exacte n'existe pas : Google a
 *      servi le plus proche qu'il avait sous la main.
 *
 * Usage
 * -----
 *   node scripts/opportunites-search-console.mjs --sites
 *       liste les propriétés visibles par le compte de service, avec la forme
 *       exacte de l'identifiant à utiliser ensuite. À lancer en premier.
 *
 *   node scripts/opportunites-search-console.mjs
 *       rapport sur les 28 derniers jours.
 *
 *   node scripts/opportunites-search-console.mjs --jours 90 --seuil 5
 *       --jours   fenêtre d'analyse (défaut 28)
 *       --seuil   impressions minimales pour retenir une requête (défaut 10)
 *       --site    identifiant de propriété (sinon SITE_PAR_DEFAUT ci-dessous)
 *       --json    sort les données brutes au lieu du rapport
 *       --tout    n'isole pas les pages d'outils, analyse tout le site
 *
 * Mise en place, une seule fois
 * -----------------------------
 *   1. console.cloud.google.com → nouveau projet → activer « Google Search
 *      Console API ».
 *   2. IAM et administration → Comptes de service → en créer un → Clés →
 *      Ajouter une clé → JSON. Le fichier se télécharge.
 *   3. Déplacer ce fichier HORS du dépôt, par exemple dans
 *      %USERPROFILE%\.secrets\ . Le script refuse de démarrer si la clé se
 *      trouve dans le projet : poussée une fois sur GitHub, elle resterait
 *      dans l'historique même après suppression.
 *   4. search.google.com/search-console → la propriété → Paramètres →
 *      Utilisateurs et autorisations → Ajouter un utilisateur → coller
 *      l'adresse client_email du compte de service, autorisation « Restreint »
 *      (la lecture suffit, n'accordez pas plus).
 *   5. Déclarer le chemin de la clé :
 *        PowerShell, pour la session :  $env:GSC_CLE = "C:\chemin\cle.json"
 *        de façon durable :             setx GSC_CLE "C:\chemin\cle.json"
 *
 * Sur l'estimation des clics à gagner
 * -----------------------------------
 * La colonne « clics estimés » n'est PAS une donnée Google. Elle applique une
 * courbe de taux de clic par position, publique et approximative, à vos
 * impressions réelles. Elle sert à classer les opportunités entre elles, pas à
 * promettre un chiffre. Les impressions et les positions, elles, sont mesurées.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SITE_PAR_DEFAUT = 'https://www.apexwebstudio.studio/';
const PORTEE = 'https://www.googleapis.com/auth/webmasters.readonly';
const API = 'https://searchconsole.googleapis.com/webmasters/v3';

/* La Search Console publie ses données avec deux à trois jours de retard.
   Demander jusqu'à aujourd'hui renvoie des journées vides qui tirent les
   moyennes vers le bas sans qu'on s'en aperçoive. */
const RETARD_JOURS = 3;

/* Taux de clic moyen par position. Ordre de grandeur issu des études
   publiques du secteur ; sert uniquement à hiérarchiser. */
const TAUX_PAR_POSITION = [
  0, 0.28, 0.15, 0.10, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018
];
const POSITION_VISEE = 3;

function tauxClic(position) {
  const p = Math.round(position);
  if (p >= 1 && p < TAUX_PAR_POSITION.length) return TAUX_PAR_POSITION[p];
  if (p <= 20) return 0.01;
  return 0.005;
}

// --- arguments -------------------------------------------------------------

function lireArguments(argv) {
  const o = {
    jours: 28, seuil: 10, site: SITE_PAR_DEFAUT,
    json: false, sites: false, tout: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--sites') o.sites = true;
    else if (a === '--tout') o.tout = true;
    else if (a === '--jours') o.jours = Number(argv[++i]);
    else if (a === '--seuil') o.seuil = Number(argv[++i]);
    else if (a === '--site') o.site = argv[++i];
    else throw new Error(`argument inconnu : ${a}`);
  }
  if (!Number.isFinite(o.jours) || o.jours < 1 || o.jours > 480) {
    throw new Error('--jours doit être un nombre entre 1 et 480');
  }
  if (!Number.isFinite(o.seuil) || o.seuil < 0) {
    throw new Error('--seuil doit être un nombre positif');
  }
  return o;
}

// --- authentification ------------------------------------------------------

function cheminCle() {
  const brut = process.env.GSC_CLE;
  if (!brut) {
    throw new Error(
      'GSC_CLE n\'est pas définie.\n' +
      '  Elle doit contenir le chemin du fichier JSON du compte de service.\n' +
      '  Exemple :  $env:GSC_CLE = "C:\\Users\\VOUS\\.secrets\\gsc.json"\n' +
      '  La procédure complète est en tête de ce fichier.'
    );
  }
  const abs = path.resolve(brut);

  /* Garde-fou : une clé posée dans le dépôt finirait poussée sur GitHub, où
     une suppression ultérieure ne l'efface pas de l'historique. */
  const dansLeDepot = !path.relative(RACINE, abs).startsWith('..');
  if (dansLeDepot) {
    throw new Error(
      `La clé se trouve dans le dépôt :\n  ${abs}\n` +
      '  Déplacez-la ailleurs, par exemple dans %USERPROFILE%\\.secrets\\ .\n' +
      '  Un secret poussé une fois reste dans l\'historique Git pour toujours.'
    );
  }
  if (!fs.existsSync(abs)) throw new Error(`clé introuvable : ${abs}`);
  return abs;
}

function lireCle() {
  const abs = cheminCle();
  let cle;
  try {
    cle = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    throw new Error(`clé illisible (${abs}) : ${e.message}`);
  }
  if (!cle.client_email || !cle.private_key) {
    throw new Error(
      `${abs} n'est pas une clé de compte de service.\n` +
      '  Il manque client_email ou private_key. Téléchargez le JSON depuis\n' +
      '  Comptes de service → Clés → Ajouter une clé → JSON.'
    );
  }
  return cle;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Échange un JWT signé contre un jeton d'accès. Pas de dépendance npm : la
 *  signature RS256 est faite par le module crypto de Node. */
async function jetonAcces(cle) {
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corps = base64url(JSON.stringify({
    iss: cle.client_email,
    scope: PORTEE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: maintenant,
    exp: maintenant + 3600
  }));

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${entete}.${corps}`)
    .sign(cle.private_key);

  const jwt = `${entete}.${corps}.${base64url(signature)}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const donnees = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = donnees.error_description || donnees.error || r.statusText;
    throw new Error(
      `échec de l'authentification Google : ${d}\n` +
      '  Causes habituelles : l\'API Search Console n\'est pas activée sur le\n' +
      '  projet Cloud, ou l\'horloge de la machine est décalée de plus de 5 min.'
    );
  }
  return donnees.access_token;
}

async function appeler(jeton, chemin, options = {}) {
  const r = await fetch(`${API}${chemin}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${jeton}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const donnees = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = (donnees.error && donnees.error.message) || r.statusText;
    if (r.status === 403) {
      throw new Error(
        `accès refusé (403) : ${m}\n` +
        '  Le compte de service n\'est pas autorisé sur cette propriété.\n' +
        '  Search Console → Paramètres → Utilisateurs et autorisations →\n' +
        '  Ajouter un utilisateur → l\'adresse client_email de la clé.'
      );
    }
    throw new Error(`API Search Console (${r.status}) : ${m}`);
  }
  return donnees;
}

// --- dates -----------------------------------------------------------------

function jour(decalage) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - decalage);
  return d.toISOString().slice(0, 10);
}

// --- analyse ---------------------------------------------------------------

function analyser(lignes, options) {
  const toutes = lignes.map(l => ({
    requete: l.keys[0],
    page: l.keys[1],
    clics: l.clicks,
    impressions: l.impressions,
    ctr: l.ctr,
    position: l.position
  }));

  const retenues = options.tout
    ? toutes
    : toutes.filter(l => /\/outil/.test(l.page) || /outils\.html/.test(l.page));

  const base = retenues.length ? retenues : toutes;

  const assezVues = base.filter(l => l.impressions >= options.seuil);

  /* 1. Page 2 et 3 : vu par Google, pas encore classé. */
  const aPousser = assezVues
    .filter(l => l.position >= 8 && l.position <= 30)
    .map(l => ({
      ...l,
      gain: Math.round(
        l.impressions * (tauxClic(POSITION_VISEE) - tauxClic(l.position))
      )
    }))
    .filter(l => l.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 20);

  /* 2. Requêtes servies par une page générique : la page dédiée manque. */
  const generiques = /\/$|\/index\.html$|\/outils\.html$/;
  const sansPage = assezVues
    .filter(l => generiques.test(l.page))
    .filter(l => l.requete.trim().split(/\s+/).length >= 2)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);

  /* 3. Ce qui marche : à ne pas toucher. */
  const acquis = base
    .filter(l => l.position <= 5 && l.clics > 0)
    .sort((a, b) => b.clics - a.clics)
    .slice(0, 10);

  return {
    total: toutes.length,
    surOutils: retenues.length,
    repliSurToutLeSite: retenues.length === 0 && toutes.length > 0,
    aPousser, sansPage, acquis,
    clicsTotal: base.reduce((s, l) => s + l.clics, 0),
    impressionsTotal: base.reduce((s, l) => s + l.impressions, 0)
  };
}

// --- rapport ---------------------------------------------------------------

function tronquer(s, n) {
  return s.length <= n ? s.padEnd(n) : s.slice(0, n - 1) + '…';
}

function cheminCourt(url) {
  try { return new URL(url).pathname; } catch { return url; }
}

function rapport(a, options, debut, fin) {
  const L = [];
  L.push(`# Opportunités Search Console`);
  L.push('');
  L.push(`Propriété : ${options.site}`);
  L.push(`Période : du ${debut} au ${fin} (${options.jours} jours)`);
  L.push(`Seuil retenu : ${options.seuil} impressions minimum`);
  L.push('');

  if (a.total === 0) {
    L.push('## Aucune donnée');
    L.push('');
    L.push('Search Console ne renvoie aucune ligne. Trois causes possibles,');
    L.push('dans l\'ordre de fréquence :');
    L.push('');
    L.push('1. Les pages viennent d\'être publiées. Comptez de quelques jours');
    L.push('   à deux semaines avant les premières impressions, et trois jours');
    L.push('   de retard permanent sur les données.');
    L.push('2. Le sitemap n\'a pas été soumis, ou les pages ne sont pas encore');
    L.push('   indexées. Vérifiez-le dans Indexation → Pages.');
    L.push('3. La propriété interrogée n\'est pas la bonne. Lancez');
    L.push('   `node scripts/opportunites-search-console.mjs --sites` pour voir');
    L.push('   la forme exacte de l\'identifiant.');
    return L.join('\n');
  }

  L.push(`Lignes analysées : ${a.total}` +
    (options.tout ? '' : ` dont ${a.surOutils} sur les pages d'outils`));
  L.push(`Total sur le périmètre : ${a.clicsTotal} clics, ${a.impressionsTotal} impressions`);
  if (a.repliSurToutLeSite) {
    L.push('');
    L.push('> Aucune impression sur les pages d\'outils : l\'analyse porte sur');
    L.push('> tout le site.');
  }
  L.push('');

  L.push('## 1. À pousser — vous êtes déjà vu, pas encore cliqué');
  L.push('');
  if (!a.aPousser.length) {
    L.push('Rien entre la 8e et la 30e position au-dessus du seuil.');
  } else {
    L.push('Position entre 8 et 30 : Google vous montre mais vous classe mal.');
    L.push('Une page dédiée à la requête exacte est le levier le plus court.');
    L.push('');
    L.push('| Requête | Pos. | Impr. | Clics | Clics estimés si 3e | Page servie |');
    L.push('|---|---:|---:|---:|---:|---|');
    for (const l of a.aPousser) {
      L.push(`| ${l.requete} | ${l.position.toFixed(1)} | ${l.impressions} | ` +
        `${l.clics} | +${l.gain} | ${cheminCourt(l.page)} |`);
    }
    L.push('');
    L.push('_« Clics estimés » applique une courbe de taux de clic publique à');
    L.push('vos impressions réelles. Sert à classer, pas à promettre._');
  }
  L.push('');

  L.push('## 2. Outil manquant — une page générique répond à votre place');
  L.push('');
  if (!a.sansPage.length) {
    L.push('Aucune requête précise ne tombe sur le hub ou sur l\'accueil.');
  } else {
    L.push('Ces requêtes atterrissent sur une page générique : la page exacte');
    L.push('n\'existe pas. Chacune est un candidat pour le prochain outil.');
    L.push('');
    L.push('| Requête | Impr. | Pos. | Page servie |');
    L.push('|---|---:|---:|---|');
    for (const l of a.sansPage) {
      L.push(`| ${l.requete} | ${l.impressions} | ${l.position.toFixed(1)} | ` +
        `${cheminCourt(l.page)} |`);
    }
  }
  L.push('');

  L.push('## 3. Acquis — à ne pas casser');
  L.push('');
  if (!a.acquis.length) {
    L.push('Aucune requête dans les cinq premières positions pour l\'instant.');
  } else {
    L.push('| Requête | Pos. | Clics | Page |');
    L.push('|---|---:|---:|---|');
    for (const l of a.acquis) {
      L.push(`| ${l.requete} | ${l.position.toFixed(1)} | ${l.clics} | ` +
        `${cheminCourt(l.page)} |`);
    }
  }
  L.push('');
  return L.join('\n');
}

function afficher(a) {
  const ligne = (r, p, i, g) =>
    `  ${tronquer(r, 42)} ${String(p).padStart(5)} ${String(i).padStart(6)} ${String(g).padStart(6)}`;

  if (a.total === 0) {
    console.log('\n  Aucune donnee pour cette periode.');
    console.log('  Le rapport ecrit explique les trois causes possibles.\n');
    return;
  }
  console.log(`\n  ${a.total} lignes · ${a.clicsTotal} clics · ${a.impressionsTotal} impressions\n`);

  console.log('  A POUSSER (position 8 a 30)');
  console.log(`  ${'requete'.padEnd(42)} ${'pos'.padStart(5)} ${'impr'.padStart(6)} ${'gain'.padStart(6)}`);
  if (!a.aPousser.length) console.log('  (rien au-dessus du seuil)');
  for (const l of a.aPousser.slice(0, 10)) {
    console.log(ligne(l.requete, l.position.toFixed(1), l.impressions, '+' + l.gain));
  }

  console.log('\n  OUTIL MANQUANT (requete precise sur page generique)');
  if (!a.sansPage.length) console.log('  (aucune)');
  for (const l of a.sansPage.slice(0, 10)) {
    console.log(`  ${tronquer(l.requete, 42)} ${String(l.impressions).padStart(6)} impr · ${cheminCourt(l.page)}`);
  }
  console.log('');
}

// --- programme -------------------------------------------------------------

async function principal() {
  let options;
  try {
    options = lireArguments(process.argv.slice(2));
  } catch (e) {
    console.error(`\n  ${e.message}\n  Voir l'en-tête du fichier pour l'usage.\n`);
    process.exit(2);
  }

  const cle = lireCle();
  const jeton = await jetonAcces(cle);

  if (options.sites) {
    const d = await appeler(jeton, '/sites');
    const liste = d.siteEntry || [];
    if (!liste.length) {
      console.log(
        `\n  Le compte ${cle.client_email} ne voit aucune propriete.\n` +
        '  Ajoutez-le dans Search Console → Parametres → Utilisateurs et\n' +
        '  autorisations, en « Restreint ».\n'
      );
      return;
    }
    console.log(`\n  Proprietes visibles par ${cle.client_email} :\n`);
    for (const s of liste) {
      console.log(`  ${s.permissionLevel.padEnd(22)} --site "${s.siteUrl}"`);
    }
    console.log('');
    return;
  }

  const fin = jour(RETARD_JOURS);
  const debut = jour(RETARD_JOURS + options.jours);

  const d = await appeler(jeton,
    `/sites/${encodeURIComponent(options.site)}/searchAnalytics/query`, {
      method: 'POST',
      body: JSON.stringify({
        startDate: debut,
        endDate: fin,
        dimensions: ['query', 'page'],
        type: 'web',
        rowLimit: 1000,
        dataState: 'final'
      })
    });

  const a = analyser(d.rows || [], options);

  if (options.json) {
    console.log(JSON.stringify({ periode: { debut, fin }, ...a }, null, 2));
    return;
  }

  const texte = rapport(a, options, debut, fin);
  const dossier = path.join(RACINE, 'rapports');
  fs.mkdirSync(dossier, { recursive: true });
  const fichier = path.join(dossier, `search-console-${fin}.md`);
  fs.writeFileSync(fichier, texte, 'utf8');

  afficher(a);
  console.log(`  Rapport complet : ${path.relative(RACINE, fichier)}\n`);
}

/* Le module ne se lance que s'il est appelé directement. Exporté, il peut être
   importé et vérifié sur des données de test sans toucher au réseau ni exiger
   une clé — c'est ce qui permet de contrôler l'analyse avant de s'en servir
   pour décider quoi construire. */
const lanceDirectement =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (lanceDirectement) {
  principal().catch(e => {
    console.error(`\n  ${e.message}\n`);
    process.exit(1);
  });
}

export { analyser, rapport, tauxClic, lireArguments };
