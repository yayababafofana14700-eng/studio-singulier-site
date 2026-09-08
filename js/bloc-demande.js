/* Studio Singulier — bloc « Composez votre demande »
   Chargé sur devis.html, et sur elle seule depuis septembre 2026 : les six
   pages service portaient une copie de ce formulaire, retirée au profit
   d'une bande qui renvoie ici. Sans dépendance.

   POURQUOI CE FICHIER PLUTÔT QUE LE §15 DE main.js
   Deux raisons dures, pas une préférence.
   1. main.js envoie Object.fromEntries(new FormData(form)) (ligne 327).
      Cette construction ne garde QUE LA DERNIÈRE valeur d'un nom répété.
      Huit cases à cocher portant le même name : une seule prestation
      arriverait dans l'email. Ici la charge utile est assemblée à la main.
   2. main.js appelle form.reportValidity() (ligne 316). Un champ
      obligatoire qui vit dans un panneau [hidden] n'est pas focalisable :
      le navigateur abandonne sans rien dire, et l'utilisateur reste devant
      un bouton qui ne fait rien. Ici la validation ouvre d'abord le bon
      onglet, puis focalise le champ.

   main.js ne cherche que #contactForm et sort immédiatement s'il ne le
   trouve pas : les deux fichiers coexistent sans se marcher dessus.

   PATRON D'ONGLETS — choix arrêtés (WAI-ARIA APG, motif « Tabs »)
   · Activation MANUELLE (Entrée / Espace), pas au passage de flèche.
     Les panneaux contiennent des champs de saisie ; une activation
     automatique changerait le contenu sous les doigts de quelqu'un qui ne
     fait que parcourir la barre.
   · tabindex tournant : l'onglet actif à 0, les deux autres à -1. La barre
     compte pour un seul arrêt de tabulation, comme une barre d'outils.
   · Les panneaux NE portent PAS tabindex="0" : l'APG ne le prescrit que
     pour un panneau sans élément focalisable. Les nôtres en sont pleins.
   ========================================================================= */
(function(){
  'use strict';

  var form = document.getElementById('demandeForm');
  if(!form) return;

  var tablist = form.querySelector('[role="tablist"]');
  var tabs    = Array.prototype.slice.call(form.querySelectorAll('[role="tab"]'));
  var panels  = tabs.map(function(t){ return document.getElementById(t.getAttribute('aria-controls')); });
  if(!tablist || tabs.length !== 3 || panels.indexOf(null) !== -1) return;

  var status = document.getElementById('bdStatus');
  var btn    = document.getElementById('bdSubmit');

  /* =======================================================================
     1. BASCULE D'ONGLET
     ======================================================================= */
  function activer(i, donnerLeFocus){
    tabs.forEach(function(tab, n){
      var actif = (n === i);
      tab.setAttribute('aria-selected', actif ? 'true' : 'false');
      tab.tabIndex = actif ? 0 : -1;
      panels[n].hidden = !actif;
    });
    if(donnerLeFocus) tabs[i].focus();
  }

  tabs.forEach(function(tab, i){
    tab.addEventListener('click', function(){ activer(i, true); });
  });

  tablist.addEventListener('keydown', function(e){
    var i = tabs.indexOf(document.activeElement);
    if(i === -1) return;
    var cible = null;

    if(e.key === 'ArrowRight')     cible = (i + 1) % tabs.length;
    else if(e.key === 'ArrowLeft') cible = (i - 1 + tabs.length) % tabs.length;
    else if(e.key === 'Home')      cible = 0;
    else if(e.key === 'End')       cible = tabs.length - 1;

    if(cible !== null){
      e.preventDefault();
      /* Déplacement du focus SEUL : le panneau ne change pas encore. */
      tabs[cible].focus();
      return;
    }
    /* Activation manuelle. Espace doit être intercepté, sinon il fait
       défiler la page sous le composant. */
    if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
      e.preventDefault();
      activer(i, false);
    }
  });

  /* Les boutons « Continuer » et « Retour » du pied de panneau : même
     bascule, pour quiconque suit le formulaire de façon linéaire sans
     jamais toucher la barre d'onglets. */
  Array.prototype.slice.call(form.querySelectorAll('[data-bd-go]')).forEach(function(b){
    b.addEventListener('click', function(){
      var i = parseInt(b.getAttribute('data-bd-go'), 10);
      activer(i, false);
      majRecap();
      /* block:'center' plutôt que 'start' : le bandeau de 72px est fixe et
         masquerait le haut de la carte (WCAG 2.4.11). */
      tabs[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
      tabs[i].focus({ preventScroll: true });
    });
  });

  /* =======================================================================
     2. RÉCAPITULATIF DE LA SÉLECTION
     Les cases cochées vivent dans un panneau masqué au moment de l'envoi.
     Sans ce miroir, on cliquerait « Envoyer » sans voir ce qui part.
     ======================================================================= */
  var recap = document.getElementById('bdRecap');

  function prestationsCochees(){
    return Array.prototype.slice
      .call(form.querySelectorAll('input[name="prestations"]:checked'))
      .map(function(c){ return c.value; });
  }

  function majRecap(){
    if(!recap) return;
    var liste = prestationsCochees();
    if(liste.length){
      recap.textContent = liste.join(' · ');
      recap.classList.remove('is-empty');
    } else {
      recap.textContent = "Aucune prestation cochée. Décrivez votre besoin dans le message, on s'en charge.";
      recap.classList.add('is-empty');
    }
  }

  form.addEventListener('change', function(e){
    if(e.target && e.target.name === 'prestations') majRecap();
  });

  /* =======================================================================
     3. ENVOI
     ======================================================================= */
  var CONTACT_DE_SECOURS = 'studiosingulier2026@gmail.com';

  function dire(texte, genre){
    if(!status) return;
    status.textContent = texte;
    status.classList.remove('is-error', 'is-ok');
    if(genre) status.classList.add(genre);
  }

  /* Le panneau qui contient un nœud donné, ou null. */
  function panneauDe(noeud){
    for(var i = 0; i < panels.length; i++){
      if(panels[i].contains(noeud)) return i;
    }
    return null;
  }

  function premierChampFautif(){
    var champs = form.querySelectorAll('input, select, textarea');
    for(var i = 0; i < champs.length; i++){
      if(!champs[i].checkValidity()) return champs[i];
    }
    return null;
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();

    var fautif = premierChampFautif();
    if(fautif){
      var p = panneauDe(fautif);
      if(p !== null) activer(p, false);
      fautif.setAttribute('aria-invalid', 'true');
      dire('Il manque une information : ' + (fautif.getAttribute('data-bd-nom') || 'un champ obligatoire') + '.', 'is-error');
      /* L'ordre compte : ouvrir l'onglet, PUIS faire défiler, PUIS
         focaliser sans redéclencher un défilement concurrent. */
      fautif.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(function(){ fautif.focus({ preventScroll: true }); }, 60);
      return;
    }

    Array.prototype.slice.call(form.querySelectorAll('[aria-invalid]')).forEach(function(c){
      c.removeAttribute('aria-invalid');
    });

    /* Charge utile assemblée à la main : les cases à cocher partagent un
       nom, elles doivent être jointes et non écrasées. */
    var charge = {};
    Array.prototype.slice.call(form.elements).forEach(function(el){
      if(!el.name || el.disabled) return;
      if(el.type === 'checkbox'){
        if(el.name === 'prestations' || !el.checked) return;
        charge[el.name] = el.value;
        return;
      }
      if(el.type === 'submit' || el.type === 'button') return;
      charge[el.name] = el.value;
    });
    charge.prestations = prestationsCochees().join(' · ') || 'Non précisé';
    charge.page = document.title;

    btn.disabled = true;
    var libelle = btn.textContent;
    btn.textContent = 'Envoi en cours…';
    dire('Envoi de votre demande…');

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(charge)
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(d.success){
        form.reset();
        majRecap();
        dire('Demande envoyée. On revient vers vous sous 24 h.', 'is-ok');
      } else {
        dire("L'envoi a échoué. Écrivez directement à " + CONTACT_DE_SECOURS + ' ou sur WhatsApp.', 'is-error');
      }
    })
    .catch(function(){
      dire('Connexion impossible. Écrivez directement à ' + CONTACT_DE_SECOURS + ' ou sur WhatsApp.', 'is-error');
    })
    .finally(function(){
      btn.disabled = false;
      btn.textContent = libelle;
    });
  });

  /* =======================================================================
     4. ARRIVÉE DEPUIS UNE PRESTATION
     Un « Discutons-en » cliqué sous une prestation porte son service dans
     l'adresse : devis.html?service=cartes-nfc. La case correspondante est
     cochée, et surtout les autres DISPARAISSENT — le visiteur a déjà choisi
     en cliquant, lui redonner la liste entière reviendrait à lui demander
     deux fois la même chose.

     Pour changer de prestation, il repasse par l'accueil. C'est un détour
     assumé : il garantit que la demande reçue correspond à la fiche que la
     personne venait de lire.

     Sans paramètre — la page atteinte par « Devis » dans la barre de
     navigation — rien n'est verrouillé : là, le choix est le sujet même de
     la page.

     Remplace l'ancien data-bd-preselect, qui vivait sur les copies du
     formulaire portées par les six pages service. Ces copies ont été
     retirées : le formulaire n'existe plus qu'ici.
     ======================================================================= */
  var SERVICES = {
    'sites-web':            'Site vitrine',
    'applications-mobiles': 'Application mobile',
    'ecommerce-shopify':    'Boutique Shopify',
    'cartes-nfc':           'Cartes de visite NFC',
    'visibilite-locale':    'Fiche Google Business'
  };

  (function(){
    var venu = null;
    try{
      venu = new URLSearchParams(window.location.search).get('service');
    }catch(err){ return; }          /* navigateur sans URLSearchParams : liste entière */
    if(!venu) return;

    var valeur = SERVICES[venu];
    if(!valeur) return;             /* paramètre inconnu : on ne verrouille rien */

    var choisi = form.querySelector(
      'input[name="prestations"][value="' + valeur.replace(/"/g, '\\"') + '"]');
    if(!choisi) return;

    choisi.checked = true;

    /* On masque plutôt que de désactiver : un champ désactivé reste visible
       et lit « interdit », alors qu'il n'y a rien à interdire — il n'y a
       simplement plus qu'un choix. Et une case désactivée ne serait pas
       envoyée, ce que la charge utile assemblée à la main ne rattraperait
       pas. */
    Array.prototype.slice.call(form.querySelectorAll('.bd-opt')).forEach(function(opt){
      if(!opt.contains(choisi)) opt.hidden = true;
    });
    Array.prototype.slice.call(form.querySelectorAll('.bd-group')).forEach(function(grp){
      if(!grp.contains(choisi)) grp.hidden = true;
    });

    var etiquette = choisi.closest ? choisi.closest('.bd-opt') : null;
    if(etiquette) etiquette.classList.add('is-verrou');

    /* La case ne peut plus être décochée : la décocher enverrait une demande
       sans prestation, depuis une page qui en annonce une. */
    choisi.addEventListener('click', function(e){ e.preventDefault(); });
    choisi.addEventListener('change', function(){ choisi.checked = true; });

    var legende = etiquette && etiquette.closest('.bd-group')
                ? etiquette.closest('.bd-group').querySelector('.bd-legend') : null;
    if(legende) legende.textContent = 'Votre prestation';

    var note = document.createElement('p');
    note.className = 'bd-verrou-note';
    note.appendChild(document.createTextNode('Vous venez de la fiche de cette prestation. Pour en demander une autre, '));
    var lien = document.createElement('a');
    lien.href = 'index.html#services';
    lien.textContent = 'choisissez-la depuis l’accueil';
    note.appendChild(lien);
    note.appendChild(document.createTextNode('.'));
    if(etiquette && etiquette.parentNode) {
      etiquette.parentNode.appendChild(note);
    }
  })();

  majRecap();
})();
