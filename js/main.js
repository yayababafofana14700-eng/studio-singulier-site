/* Studio Singulier — comportement
   Sorti du fichier unique le 13/08/2026 lors du passage en architecture
   multi-pages. En-tête, menu mobile, FAQ, widget IA, formulaire, horloge.
   Ne dépend pas de GSAP : tout fonctionne si les CDN tombent. */

(function(){
  'use strict';
  document.documentElement.classList.add('js');

  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP  = typeof gsap !== 'undefined';
  var hasST    = hasGSAP && typeof ScrollTrigger !== 'undefined';
  var canHover = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var animate  = hasGSAP && !prefersReduced;

  if(hasST) gsap.registerPlugin(ScrollTrigger);


  /* lenis vit dans animations.js. On le relit à chaque usage plutôt que de
     le capturer au chargement : si animations.js n'est pas encore exécuté,
     ou si le CDN est tombé, on obtient null et le code dégrade proprement. */
  function lenisActuel(){ return (window.SS && SS.lenis) || null; }
  /* =======================================================================
     3. EN-TÊTE + MENU MOBILE
     L'état "scrolled" vient d'une sentinelle observée, pas d'un listener
     scroll : aucun handler ne tourne à chaque frame.
     ======================================================================= */
  var header = document.getElementById('siteHeader');
  var sentinel = document.getElementById('topSentinel');
  if(sentinel && 'IntersectionObserver' in window){
    new IntersectionObserver(function(entries){
      header.classList.toggle('scrolled', !entries[0].isIntersecting);
    }, { rootMargin: '-24px 0px 0px 0px' }).observe(sentinel);
  }

  var burger = document.getElementById('burgerBtn');
  var menu   = document.getElementById('mobileMenu');
  var mClose = document.getElementById('closeMenu');
  var mainEl = document.getElementById('top');
  function setMenu(open){
    menu.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
    /* SC 2.4.11 Focus Not Obscured : le panneau (z-index 80) est un
       fixed/inset:0 opaque qui recouvre entièrement <header> (z-index 40),
       <main>, ET le lanceur IA + son panneau (z-index 60). Sans inert, Tab
       continue dans tous après les 8 éléments du menu (ou Maj+Tab avant),
       sur des cibles couvertes et invisibles. Retiré à la fermeture.
       Le lanceur avait été oublié : il est fixed hors de <main>, donc
       l'inertage de <main> ne l'atteint pas. */
    var couverts = [mainEl, header, document.getElementById('aiLauncher'), document.getElementById('aiPanel')];
    couverts.forEach(function(el){
      if(!el) return;
      open ? el.setAttribute('inert', '') : el.removeAttribute('inert');
    });
    if(lenisActuel()){ open ? lenisActuel().stop() : lenisActuel().start(); }
  }
  burger.addEventListener('click', function(){ setMenu(true); });
  mClose.addEventListener('click', function(){ setMenu(false); });
  menu.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ setMenu(false); }); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && menu.classList.contains('open')) setMenu(false); });

  // lien de nav actif selon la section visible
  (function(){
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
    var map = {};
    links.forEach(function(l){
      var t = document.querySelector(l.getAttribute('href'));
      if(t) map[t.id] = l;
    });
    var ids = Object.keys(map);
    if(!ids.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          links.forEach(function(l){ l.classList.remove('is-current'); });
          map[en.target.id].classList.add('is-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ids.forEach(function(id){ io.observe(document.getElementById(id)); });
  })();
  /* =======================================================================
     12. FAQ
     ======================================================================= */
  document.querySelectorAll('.faq-item').forEach(function(item){
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    q.addEventListener('click', function(){
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function(o){
        o.classList.remove('open');
        o.querySelector('.faq-a').style.maxHeight = null;
        o.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
        /* Repliée, la réponse reste visuellement présente (transition
           max-height oblige : un hidden immédiat la couperait net) mais ne
           doit plus être exposée à l'arbre d'accessibilité — sinon les 13
           réponses sont lues d'un bloc, avant même que l'utilisateur les
           ouvre. inert convient ici : il ne touche pas au rendu ni à la
           transition CSS, seulement à l'exposition/focusabilité. */
        o.querySelector('.faq-a').setAttribute('inert', '');
      });
      if(!isOpen){
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
        q.setAttribute('aria-expanded', 'true');
        a.removeAttribute('inert');
      }
      if(hasST) ScrollTrigger.refresh();
    });
  });
  /* =======================================================================
     14. WIDGET IA : questions/réponses par règles + capture de lead
     ======================================================================= */
  (function(){
    var launcher = document.getElementById('aiLauncher');
    var panel = document.getElementById('aiPanel');
    var body  = document.getElementById('aiBody');
    var form  = document.getElementById('aiForm');
    var input = document.getElementById('aiInput');
    if(!launcher || !form) return;

    var WEB3FORMS_KEY = 'c14a592c-eac2-405b-8ccb-a946f68838ed';
    var CLOSER = " Souhaitez-vous réserver un appel gratuit ?";

    /* Les six prestations du catalogue, et rien d autre. Les Agents IA ont
       ete retires du catalogue en septembre 2026 : l assistant ne doit plus
       les proposer ni les chiffrer. La cle `ia` reste, mais pour dire ce que
       fait cet assistant-ci — un visiteur qui tape « chatbot » parle
       probablement de la bulle qu il a sous les yeux. */
    var answers = {
      prix: "Le tarif dépend du projet : un site vitrine, une landing page, une boutique Shopify et une application mobile ne se chiffrent pas pareil. On vous donne un chiffrage clair après un premier échange, sans surprise ensuite." + CLOSER,
      shopify: "Oui, on crée des boutiques Shopify complètes : design, fiches produits, paiement, livraison et parcours d'achat." + CLOSER,
      site: "Oui, on crée des sites vitrines et des landing pages, rapides et pensés pour le téléphone d'abord." + CLOSER,
      app: "Oui, on développe des applications mobiles pour iOS et Android, publiées sur l'App Store et Google Play." + CLOSER,
      nfc: "Une carte NFC s'approche du téléphone et ouvre vos coordonnées, votre site ou votre fiche Google. Le contenu reste modifiable après l'impression." + CLOSER,
      social: "On tient votre ligne éditoriale, on crée les visuels et les textes, et on publie régulièrement." + CLOSER,
      ia: "Je suis l'assistant du site : je réponds aux questions courantes et je transmets votre demande. Pour tout le reste, un humain vous répond." + CLOSER,
      seo: "On structure vos pages et votre contenu pour être bien compris par les moteurs de recherche et cohérent avec votre fiche Google, sans promettre de classement garanti." + CLOSER,
      maintenance: "Après la mise en ligne, votre site peut évoluer avec vous : contenus, pages, fonctionnalités." + CLOSER,
      delais: "Ça dépend de la taille du projet. Une landing page va plus vite qu'une boutique Shopify ou qu'une application mobile. On vous donne une estimation dès le premier échange." + CLOSER,
      "default": "Bonne question. Je peux vous renseigner sur nos sites, nos applications mobiles, nos boutiques Shopify, les cartes NFC, la visibilité locale, la maintenance ou les délais. Sur quoi voulez-vous en savoir plus ?" + CLOSER
    };

    function matchAnswer(text){
      var t = text.toLowerCase();
      /* L ordre compte : les motifs les plus specifiques passent devant.
         « application » avant « site », sinon « application web » tombe
         dans la reponse des sites. Et « google » reste sur le referencement
         plutot que sur la fiche : c est la question la plus frequente. */
      if(/prix|tarif|coût|cout|combien/.test(t)) return answers.prix;
      if(/nfc|carte de visite|sans contact/.test(t)) return answers.nfc;
      if(/appli|application|mobile|android|ios|play store|app store/.test(t)) return answers.app;
      if(/shopify|boutique|e-?commerce/.test(t)) return answers.shopify;
      if(/ia\b|agent|intelligence artificielle|chatbot|automat/.test(t)) return answers.ia;
      if(/seo|référencement|referencement|google/.test(t)) return answers.seo;
      if(/maintenance|évolu|evolu|modifier/.test(t)) return answers.maintenance;
      if(/délai|delai|temps|combien de temps|rapide/.test(t)) return answers.delais;
      if(/site|vitrine|landing|web/.test(t)) return answers.site;
      return answers["default"];
    }

    function addMsg(text, who){
      var div = document.createElement('div');
      div.className = 'msg ' + who;
      div.textContent = text;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
      return div;
    }

    function showTyping(){
      var t = document.createElement('div');
      t.className = 'typing-indicator';
      t.id = 'typingNow';
      t.innerHTML = '<span></span><span></span><span></span>';
      body.appendChild(t);
      body.scrollTop = body.scrollHeight;
    }
    function hideTyping(){
      var t = document.getElementById('typingNow');
      if(t) t.remove();
    }

    // machine à états de capture de lead, déclenchée quand le visiteur veut un appel
    var flow = null; // null | 'name' | 'email' | 'phone'
    var lead = { name: '', email: '', phone: '' };

    function botSay(text, delay){
      showTyping();
      setTimeout(function(){ hideTyping(); addMsg(text, 'bot'); }, delay || 550);
    }

    function startBookingFlow(){
      flow = 'name';
      botSay("Avec plaisir. Comment vous appelez-vous ?");
    }

    function submitLead(){
      botSay("Merci " + lead.name + ", j'envoie votre demande à l'équipe, un instant…");
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: 'Nouveau lead — Assistant IA du site',
          from_name: 'Studio Singulier — Assistant IA',
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          message: "Demande de rappel via l'assistant IA flottant du site."
        })
      })
      .then(function(res){ return res.json(); })
      .then(function(data){
        setTimeout(function(){
          if(data.success) addMsg("C'est envoyé. On vous recontacte très vite sur " + lead.email + ".", 'bot');
          else addMsg("Un souci est survenu à l'envoi. Écrivez-nous directement sur WhatsApp pour ne pas perdre de temps.", 'bot');
        }, 900);
      })
      .catch(function(){
        setTimeout(function(){ addMsg("Connexion impossible. Écrivez-nous directement sur WhatsApp pour ne pas perdre de temps.", 'bot'); }, 900);
      });
    }

    function handleFlowStep(text){
      var val = text.trim();
      if(flow === 'name'){
        lead.name = val; flow = 'email';
        botSay("Merci " + lead.name + ". Quel est votre email ?");
        return true;
      }
      if(flow === 'email'){
        /* Sans ce contrôle, une saisie erronée part quand même dans le mail
           de lead et le rappel devient impossible. On redemande plutôt. */
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)){
          botSay("Cet email ne semble pas valide. Pouvez-vous le réécrire ?");
          return true;
        }
        lead.email = val; flow = 'phone';
        botSay("Et un numéro de téléphone pour vous joindre plus vite ?");
        return true;
      }
      if(flow === 'phone'){
        lead.phone = val; flow = null;
        submitLead();
        return true;
      }
      return false;
    }

    /* fromChip : une puce est une intention, pas une réponse. Sans ce
       drapeau, cliquer « Vos prix ? » pendant la prise de rendez-vous
       enregistre « Vos prix ? » comme nom du visiteur. */
    function respond(text, fromChip){
      addMsg(text, 'user');
      if(fromChip && flow){
        flow = null;
        lead = { name: '', email: '', phone: '' };
      }
      if(handleFlowStep(text)) return;
      if(/rendez-?vous|rdv|réserv|reserv|appel gratuit|book/.test(text.toLowerCase())){
        showTyping();
        setTimeout(function(){ hideTyping(); startBookingFlow(); }, 550);
        return;
      }
      showTyping();
      setTimeout(function(){ hideTyping(); addMsg(matchAnswer(text), 'bot'); }, 600);
    }

    form.addEventListener('submit', function(e){
      e.preventDefault();
      var val = input.value.trim();
      if(!val) return;
      respond(val);
      input.value = '';
    });

    document.querySelectorAll('.chat-chip').forEach(function(chip){
      chip.addEventListener('click', function(){ respond(chip.dataset.q || chip.textContent, true); });
    });

    function toggle(open){
      panel.classList.toggle('open', open);
      launcher.classList.toggle('open', open);
      launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
      if(open){
        setTimeout(function(){ input.focus(); }, 140);
      } else {
        // Sans ça, le panneau passe en visibility:hidden et le focus
        // retombe sur <body> : l'utilisateur perd sa place et se retrouve
        // projeté en haut de la page. Inconditionnel : que la fermeture
        // vienne d'Échap ou d'un reclic sur le lanceur (qui a déjà le
        // focus dans ce cas), le renvoyer ici est sans effet de bord.
        launcher.focus();
      }
    }
    launcher.addEventListener('click', function(){ toggle(!panel.classList.contains('open')); });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && panel.classList.contains('open')) toggle(false);
    });

    // les CTA "voir l'agent" ouvrent le vrai widget, pas une simulation
    document.querySelectorAll('[data-open-agent]').forEach(function(b){
      b.addEventListener('click', function(){
        toggle(true);
        panel.scrollIntoView({ block: 'nearest' });
      });
    });
  })();
  /* =======================================================================
     15. FORMULAIRE DE CONTACT (Web3Forms)
     ======================================================================= */
  (function(){
    var form = document.getElementById('contactForm');
    if(!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var btn = document.getElementById('formSubmitBtn');
      var status = document.getElementById('formStatus');

      function setStatus(text, kind){
        status.textContent = text;
        status.classList.remove('is-error', 'is-ok');
        if(kind) status.classList.add(kind);
      }

      if(!form.checkValidity()){
        setStatus("Merci de remplir votre nom, votre email et votre message.", 'is-error');
        form.reportValidity();
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Envoi en cours…';
      setStatus("Envoi de votre demande…");

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      })
      .then(function(res){ return res.json(); })
      .then(function(data){
        if(data.success){
          form.reset();
          setStatus("Message envoyé. On revient vers vous très vite.", 'is-ok');
        } else {
          setStatus("Un problème est survenu. Vous pouvez aussi écrire directement à studiosingulier2026@gmail.com.", 'is-error');
        }
      })
      .catch(function(){
        setStatus("Connexion impossible. Vous pouvez aussi écrire directement à studiosingulier2026@gmail.com.", 'is-error');
      })
      .finally(function(){
        btn.disabled = false;
        btn.textContent = 'Envoyer ma demande';
      });
    });
  })();
  /* =======================================================================
     16. MOITIÉ JOUR À L'ÉCRAN
     Deux calques échappent au découpage en sections parce qu'ils sont fixes :
     le grain, qui couvre tout le viewport, et l'ombre du lanceur IA. Aucun
     sélecteur CSS ne peut leur dire sur quelle moitié ils flottent — il faut
     l'observer.

     La bascule se fait sur la LIGNE MÉDIANE du viewport, pas sur la simple
     présence d'une section claire à l'écran : sinon le grain s'éclaircirait
     dès qu'un liseré de crème pointe en bas, alors que 95% de l'écran est
     encore en nuit. La médiane est le seul point qui répond à « qu'est-ce
     qu'on regarde, là, maintenant ».

     Sans IntersectionObserver, la classe n'est jamais posée : on garde le
     grain à .05 et l'ombre vermillon. C'est l'état d'avant, il est correct.
     ======================================================================= */
  (function(){
    var papiers = document.querySelectorAll('.on-paper');
    if(!papiers.length || !('IntersectionObserver' in window)) return;
    var root = document.documentElement;
    var vus = 0;
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        var etait = en.target.dataset.paperSeen === '1';
        if(en.isIntersecting === etait) return;
        en.target.dataset.paperSeen = en.isIntersecting ? '1' : '0';
        vus += en.isIntersecting ? 1 : -1;
      });
      if(vus < 0) vus = 0;
      root.classList.toggle('paper-view', vus > 0);
      /* Bande de 10% centrée sur la médiane, et non une ligne de 0px : un
         rootMargin de -50%/-50% réduit la racine à un rectangle de hauteur
         nulle, dont l'aire d'intersection est toujours 0. Chrome tolère ce
         cas, d'autres moteurs non. La bande donne la même sémantique — « ce
         qu'on regarde au centre de l'écran » — sans dépendre de cette
         tolérance. */
    }, { rootMargin: '-45% 0px -45% 0px' });
    papiers.forEach(function(s){ s.dataset.paperSeen = '0'; io.observe(s); });
  })();
  /* =======================================================================
     17. DIVERS
     ======================================================================= */
  var copy = document.getElementById('footCopy');
  if(copy) copy.textContent = '© ' + new Date().getFullYear() + ' Studio Singulier, Belvédère, Casablanca, Maroc';

  window.addEventListener('load', function(){ if(hasST) ScrollTrigger.refresh(); });

  /* Redimensionnement : Lenis et ScrollTrigger mettent tous deux en cache les
     dimensions du viewport. Sans ça, changer la largeur laisse les triggers
     sur des positions périmées, et les calques en backdrop-filter peuvent
     laisser un fantôme du rendu précédent à l'écran. */
  (function(){
    var root = document.documentElement, timer;
    function settle(){
      if(lenisActuel()) lenisActuel().resize();
      if(hasST) ScrollTrigger.refresh();
      var g = document.querySelector('.grain');
      if(g){ g.style.display = 'none'; void g.offsetHeight; g.style.display = ''; }
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){ root.classList.remove('is-resizing'); });
      });
    }
    window.addEventListener('resize', function(){
      root.classList.add('is-resizing');
      clearTimeout(timer);
      timer = setTimeout(settle, 180);
    });
    window.addEventListener('orientationchange', function(){
      root.classList.add('is-resizing');
      setTimeout(settle, 250);
    });
  })();
  /* =======================================================================
     18. HORLOGE DE CASABLANCA
     Le seul endroit de la page qui change selon QUAND on la regarde, pas
     seulement selon qu'on scrolle. Heure de l'agence, pas celle du
     visiteur : un prospect à Paris ou Dubaï doit voir l'heure locale de
     Casablanca, pas la sienne — d'où timeZone explicite, jamais
     new Date().getHours() qui lirait l'horloge du navigateur.
     Pas d'aria-live : l'heure n'est pas une information critique, la faire
     annoncer à chaque minute serait du bruit pour un lecteur d'écran.
     <time datetime> porte la sémantique machine-lisible à la place.
     ======================================================================= */
  (function(){
    var el = document.getElementById('casaClock');
    if(!el || typeof Intl === 'undefined' || !Intl.DateTimeFormat) return; // repli HTML statique conservé

    var fmt;
    try{
      fmt = new Intl.DateTimeFormat('fr-FR', {
        /* hourCycle 'h23' et non hour12:false : ce dernier laisse certains
           moteurs choisir le cycle h24, qui rend minuit « 24:00 » — valeur
           invalide dans l'attribut datetime d'un <time>. */
        timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      });
    } catch(err){ return; } // fuseau non supporté par le moteur : on garde le repli

    function peindre(){
      var hhmm = fmt.format(new Date());
      el.textContent = '';
      el.appendChild(document.createTextNode('Casablanca · '));
      var t = document.createElement('time');
      t.setAttribute('datetime', hhmm);
      t.textContent = hhmm;
      el.appendChild(t);
      el.appendChild(document.createTextNode(" · l'agent répond"));
    }
    peindre();

    // Premier tick aligné sur le changement de minute plutôt que sur un
    // setInterval(60000) démarré à un instant quelconque de la minute en
    // cours, qui laisserait l'affichage retarder jusqu'à 59s sur l'heure
    // réelle.
    var attente = 60000 - (Date.now() % 60000);
    setTimeout(function(){
      peindre();
      setInterval(peindre, 60000);
    }, attente);
  })();

  /* =======================================================================
     19. SERVICES : RAIL HORIZONTAL PILOTÉ PAR LE DÉFILEMENT VERTICAL
     La section s'épingle et le rail des six prestations glisse en x pendant
     que la page défile en y — molette, trackpad ou doigt.

     CE QUI A CHANGÉ, ET POURQUOI : l'ancien composant réservait son
     épinglage à `min-width: 900px`. Sur téléphone il ne se passait donc
     rien, alors que c'est justement là que la demande portait. Aucune
     largeur n'est exclue ici.

     Trois réglages viennent de la relecture UX et ne sont pas décoratifs :

       - le scrub est plus serré au doigt qu'à la molette. À 0,35 sous le
         doigt, le rail suit avec un retard qu'on sent : le contact est
         direct, le décalage se voit. À la molette le contact est indirect,
         un peu d'inertie adoucit au contraire le geste.

       - sous 600 px, la course de défilement est raccourcie. À l'échelle
         1:1, traverser six panneaux sur un téléphone coûte quatre à cinq
         hauteurs d'écran : l'utilisateur croit son défilement cassé. Le
         rail parcourt la même distance, en moins de scroll.

       - les panneaux hors champ passent en `inert`. Sans ça, une tabulation
         atteint le panneau 5 pendant que le panneau 1 est seul à l'écran :
         l'anneau de focus part hors de l'écran (WCAG 2.4.11), et un lecteur
         d'écran en navigation virtuelle traverse six panneaux sans qu'aucun
         glissement ne se déclenche pour lui.
     ======================================================================= */
  (function(){
    var section = document.getElementById('services');
    if(!section || !section.classList.contains('services-rail')) return;

    var pin    = document.getElementById('srPin');
    var track  = document.getElementById('srTrack');
    var panels = [].slice.call(section.querySelectorAll('.sr-panel'));
    var chips  = [].slice.call(section.querySelectorAll('.sr-chip'));
    if(!pin || !track || !panels.length) return;

    var reduit = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var actif = -1;
    var ancre = null;

    /* Met à jour la puce ET l'état inerte des panneaux. Les deux vont
       ensemble : ce qui n'est pas à l'écran ne doit être ni annoncé comme
       courant, ni atteignable au clavier. */
    /* La puce suit le panneau le plus proche du centre : un repère de
       position n'en désigne qu'un. */
    function activer(i){
      if(i === actif) return;
      actif = i;
      chips.forEach(function(chip, n){
        if(n === i) chip.setAttribute('aria-current', 'true');
        else        chip.removeAttribute('aria-current');
      });
    }

    /* L'inertie, elle, suit ce qui est RÉELLEMENT à l'écran — pas l'index
       de la puce.

       Premier jet : tout ce qui n'était pas le panneau courant passait en
       inert. Erreur nette, et visible tout de suite à l'usage : le rail en
       montre toujours deux (le débord du suivant est même le signe qu'il y
       a une suite), et `inert` ne coupe pas que le clavier — il coupe la
       souris aussi. Les liens du panneau d'à côté étaient donc morts sous
       le curseur alors qu'on les lisait parfaitement.

       On mesure donc le recouvrement avec le cadre. Au-delà d'un tiers de
       sa largeur, un panneau est là pour de bon : il reste cliquable et
       atteignable au clavier. En deçà, il est sorti, et l'anneau de focus
       n'a rien à y faire (WCAG 2.4.11). */
    function majEtat(){
      var cadre  = pin.getBoundingClientRect();
      var boites = panels.map(function(p){ return p.getBoundingClientRect(); });

      var courant = 0, plusProche = Infinity;
      var presence = boites.map(function(b){
        var recouvre = Math.min(b.right, cadre.right) - Math.max(b.left, cadre.left);
        return recouvre > b.width * 0.35;
      });

      /* La puce désigne le panneau en position de lecture : le plus à gauche
         de ceux qui sont là. On la déduit des positions, plus d un index
         arrondi — un arrondi désignait parfois un panneau déjà sorti. */
      boites.forEach(function(b, n){
        if(!presence[n]) return;
        var ecart = Math.abs(b.left - cadre.left);
        if(ecart < plusProche){ plusProche = ecart; courant = n; }
      });

      /* On n écrit que si l état change : inutile de toucher le DOM à
         chaque image pendant que le rail glisse. */
      presence.forEach(function(present, n){
        if(present === panels[n].hasAttribute('inert')){
          if(present) panels[n].removeAttribute('inert');
          else        panels[n].setAttribute('inert', '');
        }
      });

      activer(courant);
    }

    /* Repli : mouvement réduit, ou GSAP absent. Le CSS a déjà tout remis en
       colonne (voir services-rail.css, .services-rail:not(.sr-live)), donc
       les six panneaux sont lisibles et atteignables tels quels. On ne pose
       AUCUN inert dans ce cas : rien n'est caché, tout est dans le flux. */
    if(reduit || !window.gsap || !window.ScrollTrigger){
      chips.forEach(function(chip, i){
        chip.addEventListener('click', function(){
          panels[i].scrollIntoView({
            behavior: reduit ? 'auto' : 'smooth',
            block: 'center'
          });
        });
      });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    section.classList.add('sr-live');   /* le CSS peut cesser d'empiler */

    /* Le doigt et la molette ne demandent pas le même suivi. */
    var grossier = window.matchMedia('(pointer: coarse)').matches;

    /* Course : distance réelle du rail sur grand écran, raccourcie sur
       petit. 0,62 place les six panneaux sous ~2,5 hauteurs d'écran à
       375 px, contre 4 à 5 à l'échelle 1:1. */
    function course(){
      var d = track.scrollWidth - pin.clientWidth;
      if(d <= 0) return 0;
      return Math.round(d * (window.innerWidth <= 600 ? 0.62 : 1));
    }

    /* x et end sont des FONCTIONS : ScrollTrigger les rappelle à chaque
       refresh, donc une rotation d'écran ou un redimensionnement recalcule
       la course tout seul. `ignoreMobileResize` est déjà posé globalement
       dans animations.js — la barre d'adresse Android qui se rétracte ne
       déclenche donc pas ce recalcul en plein geste. */
    gsap.to(track, {
      x: function(){ return -(track.scrollWidth - pin.clientWidth); },
      /* ease:'none' est obligatoire : toute autre courbe désynchronise le
         geste et la position du rail, et l'écart se sent immédiatement. */
      ease: 'none',
      /* L état se recalcule à CHAQUE application du tween, jamais depuis
         l onUpdate du déclencheur : avec un scrub, la transformation traîne
         derrière le scroll (0,12 à 0,35 s). Les rectangles lus côté
         déclencheur étaient donc en avance sur ce que montrait l écran, et
         un panneau parfaitement visible pouvait rester inerte. */
      onUpdate: majEtat,
      scrollTrigger: {
        /* On épingle la SECTION, titre et puces compris — pas le seul rail.
           Épingler `pin` laissait les puces sortir par le haut juste avant
           le début du glissement : le repère de position s'en allait au
           moment précis où il devient utile. Le déclencheur suit la même
           cible, sinon l'épinglage démarrerait un écran trop tard. */
        trigger: section,
        pin: section,
        start: 'top top',
        end: function(){ return '+=' + course(); },
        scrub: grossier ? 0.12 : 0.35,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        /* Le débordement vertical est traité en CSS, par le plafond
           --sr-vmax posé sur le visuel : c'est lui, et non le texte, qui
           dictait la hauteur du panneau et donc celle de la boîte épinglée.
           Aucune bascule JS ici — retirer .sr-live remettrait les six
           panneaux en pile, ce qui rend la section BEAUCOUP plus haute et
           relancerait aussitôt le même test : la garde oscillerait. */
        onRefresh: function(self){ ancre = self; majEtat(); },
        onUpdate: function(self){ ancre = self; }
      }
    });

    majEtat();

    /* Recalcul sur changement de LARGEUR seulement.
       `ignoreMobileResize` protège du redimensionnement parasite que provoque
       la barre d'adresse Android en se rétractant — mais il s'est avéré, à la
       mesure, qu'il retenait aussi des changements de largeur réels : après un
       passage de 716 à 1440 px, le rail gardait sa course d'avant et les
       panneaux leur ancienne largeur. Une rotation d'écran tomberait dans le
       même trou. On compare donc la largeur nous-mêmes : elle seule décide. */
    var largeur = window.innerWidth;
    var hauteur = window.innerHeight;
    var minuteurRefresh = null;
    window.addEventListener('resize', function(){
      var dW = window.innerWidth !== largeur;
      /* La HAUTEUR compte désormais elle aussi : --sr-vmax est exprimé en
         svh, donc le plafond du visuel — et par ricochet la hauteur de toute
         la section — change avec elle. L'ignorer laissait ScrollTrigger
         épingler une boîte mesurée pour une autre fenêtre.
         `svh` étant la hauteur PETITE du viewport, la barre d'adresse Android
         qui se rétracte ne la modifie pas : le motif que `ignoreMobileResize`
         protégeait ne repasse pas par ici. On amortit tout de même de 150 ms,
         un redimensionnement à la souris émettant des dizaines d'événements. */
      var dH = Math.abs(window.innerHeight - hauteur) > 2;
      if(!dW && !dH) return;
      largeur = window.innerWidth;
      hauteur = window.innerHeight;
      clearTimeout(minuteurRefresh);
      minuteurRefresh = setTimeout(function(){ ScrollTrigger.refresh(); }, 150);
    });

    /* Clic sur une puce : on saute à la position de défilement qui amène ce
       panneau à l'écran. C'est le seul accès direct au sixième service sans
       traverser les cinq autres — utile à la souris, indispensable au
       clavier. */
    chips.forEach(function(chip, i){
      chip.addEventListener('click', function(){
        if(!ancre){
          panels[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        var y = ancre.start + (ancre.end - ancre.start) * (i / (panels.length - 1));
        window.scrollTo({ top: y, behavior: 'smooth' });
      });
    });
  })();


  /* =======================================================================
     20-21. DÉPLIANT SERVICES ET SON REPLI MOBILE — RETIRÉS
     Le menu déroulant des prestations a disparu de la navigation en
     septembre 2026 : les six services sont présentés sur l accueil, dans le
     rail de la section 19. La nav se limite à Accueil et Devis, et ces deux
     blocs — ouverture au survol, fermeture au clic dehors, repli accordéon
     du menu mobile — n avaient plus aucune cible dans le DOM.
     ======================================================================= */


  /* =========================================================================
     22. TRANSITION ENTRE LES PAGES

     Le voile monte au clic sur un lien interne, la page suivante s'affiche
     normalement. Sortie seulement, jamais d'entrée : un voile posé au
     chargement deviendrait l'élément peint en premier et repousserait le LCP
     de la durée du fondu. Le site tient en dix pages statiques, et l'essentiel
     de la continuité perçue vient du départ, pas de l'arrivée.

     Le voile est créé ici et non dans le HTML : sans JavaScript il n'existe
     pas, et aucun écran plein ne peut rester en travers d'un lien.
     ========================================================================= */
  (function(){
    if(window.matchMedia &&
       window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var voile = document.createElement('div');
    voile.className = 'page-veil';
    voile.setAttribute('aria-hidden', 'true');
    document.body.appendChild(voile);

    var DUREE = 260;          /* doit rester égal à la transition CSS */
    var enRoute = false;

    /* Un lien n'est repris que s'il mène vraiment ailleurs sur ce site. Tout
       le reste garde son comportement natif : ancres, courriel, téléphone,
       téléchargements, nouvel onglet, domaines tiers. */
    function estInterne(a){
      if(!a || !a.getAttribute) return false;
      if(a.target) return false;
      if(a.hasAttribute('download')) return false;

      var href = a.getAttribute('href');
      if(!href) return false;
      if(href.charAt(0) === '#') return false;
      if(/^(mailto:|tel:|javascript:)/i.test(href)) return false;
      if(a.origin !== window.location.origin) return false;

      /* Ancre vers la page courante : le navigateur fait défiler, il ne
         navigue pas. Lever le voile figerait l'écran pour rien. */
      if(a.pathname === window.location.pathname && a.hash) return false;

      return true;
    }

    document.addEventListener('click', function(e){
      if(e.defaultPrevented) return;
      if(e.button !== 0) return;                 /* clic droit, molette */
      /* Ces modificateurs ouvrent un onglet ou téléchargent : la page courante
         ne bouge pas, la voiler serait un contresens. */
      if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if(!estInterne(a)) return;

      e.preventDefault();
      if(enRoute) return;                        /* double clic : une seule fois */
      enRoute = true;

      voile.classList.add('is-on');
      setTimeout(function(){ window.location.href = a.href; }, DUREE);
    });

    /* Retour arrière : le navigateur restaure la page depuis son cache dans
       l'état exact où on l'a quittée, voile levé compris. Sans ce nettoyage,
       l'utilisateur retombe sur un écran plein et croit le site cassé. C'est
       le piège classique de ce motif. */
    window.addEventListener('pageshow', function(){
      enRoute = false;
      voile.classList.remove('is-on');
    });
  })();

})();
