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

    var answers = {
      prix: "Le tarif dépend du projet : site seul, boutique Shopify, ou site plus agent IA. On vous donne un chiffrage clair après un premier échange, sans surprise ensuite." + CLOSER,
      shopify: "Oui, on crée des boutiques Shopify complètes : design, fiches produits, paiement. On peut y connecter un agent IA de support." + CLOSER,
      site: "Oui, on crée des sites vitrines modernes, rapides et pensés mobile. On peut aussi les transformer en outils intelligents avec un agent IA." + CLOSER,
      ia: "Un agent IA répond à vos clients automatiquement, qualifie les demandes et peut être connecté à WhatsApp, Messenger ou votre site." + CLOSER,
      seo: "On structure vos pages et votre contenu pour être bien compris par les moteurs de recherche et cohérent avec votre fiche Google, sans promettre de classement garanti." + CLOSER,
      maintenance: "Après la mise en ligne, votre site et votre agent IA peuvent évoluer avec vous : contenus, fonctionnalités, ajustements des réponses." + CLOSER,
      delais: "Ça dépend de la taille du projet. Un site simple va plus vite qu'une boutique Shopify avec agent IA connecté. On vous donne une estimation dès le premier échange." + CLOSER,
      "default": "Bonne question. Je peux vous renseigner sur nos sites, nos boutiques Shopify, nos agents IA, le référencement, la maintenance ou les délais. Sur quoi voulez-vous en savoir plus ?" + CLOSER
    };

    function matchAnswer(text){
      var t = text.toLowerCase();
      if(/prix|tarif|coût|cout|combien/.test(t)) return answers.prix;
      if(/shopify|boutique|e-?commerce/.test(t)) return answers.shopify;
      if(/ia\b|agent|intelligence artificielle|chatbot|automat/.test(t)) return answers.ia;
      if(/seo|référencement|referencement|google/.test(t)) return answers.seo;
      if(/maintenance|évolu|evolu|modifier/.test(t)) return answers.maintenance;
      if(/délai|delai|temps|combien de temps|rapide/.test(t)) return answers.delais;
      if(/site|vitrine|web/.test(t)) return answers.site;
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
          setStatus("Un problème est survenu. Vous pouvez aussi écrire directement à yayababafofana14700@gmail.com.", 'is-error');
        }
      })
      .catch(function(){
        setStatus("Connexion impossible. Vous pouvez aussi écrire directement à yayababafofana14700@gmail.com.", 'is-error');
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
     19. PRESTATIONS : 4 PANNEAUX, FOND QUI CHANGE
     Quatre colonnes qui ne bougent jamais. Seuls changent l'image de fond
     et le panneau mis en avant. La boucle tourne seule ; le survol reprend
     la main, puis elle repart.
     ======================================================================= */
  (function(){
    var section = document.getElementById('services');
    if(!section || !section.classList.contains('services-panels')) return;

    var items  = [].slice.call(section.querySelectorAll('.sp-item'));
    var layers = [].slice.call(section.querySelectorAll('.sp-bg-layer'));
    if(!items.length) return;

    /* Les images viennent des data-img du HTML : changer un visuel ne
       demande aucune retouche de ce fichier. On précharge pour que le
       premier fondu ne montre pas un trou. */
    items.forEach(function(it, i){
      var src = it.getAttribute('data-img');
      if(!src || !layers[i]) return;
      var img = new Image();
      img.onload = function(){ layers[i].style.backgroundImage = 'url("' + src + '")'; };
      img.src = src;
    });

    var courant = 0;
    var minuteur = null;
    var reprise = null;
    var DUREE = 4200;    /* assez lent pour lire les deux lignes de description */
    var REPRISE = 3200;  /* délai avant que la boucle reprenne après un survol */

    var reduit = window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function activer(i){
      if(i === courant) return;
      courant = i;
      items.forEach(function(it, n){ it.classList.toggle('is-on', n === i); });
      layers.forEach(function(l, n){ l.classList.toggle('is-on', n === i); });
    }

    function suivant(){ activer((courant + 1) % items.length); }

    function demarrer(){
      if(reduit || minuteur) return;
      minuteur = setInterval(suivant, DUREE);
    }
    function arreter(){
      clearInterval(minuteur); minuteur = null;
      clearTimeout(reprise);  reprise = null;
    }
    /* Après une interaction, on laisse à l'utilisateur le temps de lire
       avant de lui reprendre la main. */
    function reprendrePlusTard(){
      clearTimeout(reprise);
      reprise = setTimeout(demarrer, REPRISE);
    }

    items.forEach(function(it, i){
      var lien = it.querySelector('.sp-link');

      it.addEventListener('mouseenter', function(){ arreter(); activer(i); });
      it.addEventListener('mouseleave', reprendrePlusTard);

      /* Le clavier suit la même logique que la souris : tabuler jusqu'à un
         panneau l'active, exactement comme le survoler. */
      if(lien){
        lien.addEventListener('focus', function(){ arreter(); activer(i); });
        lien.addEventListener('blur', reprendrePlusTard);
      }
    });

    /* Onglet en arrière-plan : inutile de faire tourner des fondus que
       personne ne regarde. */
    document.addEventListener('visibilitychange', function(){
      document.hidden ? arreter() : demarrer();
    });

    /* On démarre tout de suite, et l'observateur ne sert qu'à METTRE EN
       PAUSE hors écran. L'inverse — ne démarrer qu'à l'entrée dans le
       viewport — laisse le composant définitivement figé partout où
       l'observateur ne se déclenche pas : onglet en arrière-plan, page qui
       ne compose pas, navigateur exotique. Un composant qui ne bouge jamais
       est un bug ; un composant qui tourne un peu hors écran ne l'est pas. */
    demarrer();

    if('IntersectionObserver' in window){
      new IntersectionObserver(function(entrees){
        entrees[0].isIntersecting ? demarrer() : arreter();
      }, { threshold: .25 }).observe(section);
    }
  })();


  /* =======================================================================
     20. DÉPLIANT SERVICES
     Ouverture au survol (comme la référence) ET au clic, pour que clavier
     et tactile aient le même accès. Fermeture : nouveau clic, clic dehors,
     Échap, choix d'une prestation, ou sortie de la souris.
     ======================================================================= */
  (function(){
    var bouton = document.getElementById('navServices');
    var panneau = document.getElementById('megaServices');
    if(!bouton || !panneau) return;

    /* Le voile est créé ici et non dans le HTML : il n'a aucun sens sans JS,
       et l'écrire dans les 6 pages n'aurait servi qu'à les alourdir. */
    var voile = document.createElement('div');
    voile.className = 'mega-voile';
    document.body.appendChild(voile);

    var ouvert = false;
    var minuteurFermeture = null;
    /* Le survol se déclenche à l'intention, pas au passage : sans ce délai,
       traverser « Services » pour aller vers « Agents IA » ouvrirait le
       panneau au passage. */
    var DELAI_OUVERTURE = 90;
    var DELAI_FERMETURE = 260;
    var minuteurOuverture = null;

    function ouvrir(){
      clearTimeout(minuteurFermeture);
      if(ouvert) return;
      ouvert = true;
      panneau.hidden = false;
      /* Il faut un état de départ calculé avant de poser la classe, sinon le
         navigateur fusionne les deux et la transition ne démarre pas.
         On force ce calcul par une lecture de offsetHeight plutôt que par un
         requestAnimationFrame : rAF ne s'exécute pas dans un onglet en
         arrière-plan, et le panneau resterait alors ouvert mais invisible.
         Une lecture de géométrie, elle, est synchrone et toujours honorée. */
      void panneau.offsetHeight;
      panneau.classList.add('is-open');
      voile.classList.add('is-open');
      bouton.setAttribute('aria-expanded', 'true');
    }

    function fermer(){
      clearTimeout(minuteurOuverture);
      if(!ouvert) return;
      ouvert = false;
      panneau.classList.remove('is-open');
      voile.classList.remove('is-open');
      bouton.setAttribute('aria-expanded', 'false');
      /* On attend la fin du fondu avant de remettre `hidden`, sinon le
         panneau disparaît d'un coup au lieu de se refermer. */
      setTimeout(function(){ if(!ouvert) panneau.hidden = true; }, 460);
    }

    function basculer(){ ouvert ? fermer() : ouvrir(); }

    /* --- souris --- */
    function survolEntre(){
      clearTimeout(minuteurFermeture);
      minuteurOuverture = setTimeout(ouvrir, DELAI_OUVERTURE);
    }
    function survolSort(){
      clearTimeout(minuteurOuverture);
      minuteurFermeture = setTimeout(fermer, DELAI_FERMETURE);
    }
    bouton.addEventListener('mouseenter', survolEntre);
    bouton.addEventListener('mouseleave', survolSort);
    panneau.addEventListener('mouseenter', function(){ clearTimeout(minuteurFermeture); });
    panneau.addEventListener('mouseleave', survolSort);

    /* --- clic, clavier --- */
    bouton.addEventListener('click', function(e){ e.preventDefault(); basculer(); });
    voile.addEventListener('click', fermer);

    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && ouvert){ fermer(); bouton.focus(); }
    });

    /* Choisir une prestation ferme le panneau. Sur une ancre de la page
       courante, aucune navigation n'a lieu : sans ça le panneau resterait
       ouvert par-dessus la section qu'on vient de demander. */
    panneau.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', fermer);
    });

    /* Sortir du panneau au clavier le referme, sinon le focus continue
       derrière un panneau resté ouvert. */
    document.addEventListener('focusin', function(e){
      if(!ouvert) return;
      if(!panneau.contains(e.target) && e.target !== bouton) fermer();
    });

    /* Le panneau est en position fixe sous une barre de 72px : au
       redimensionnement vers le mobile, la barre disparaît au profit du
       menu plein écran. On ferme pour ne pas laisser un panneau orphelin. */
    var mqMobile = window.matchMedia('(max-width: 940px)');
    (mqMobile.addEventListener ? mqMobile.addEventListener.bind(mqMobile, 'change')
                               : mqMobile.addListener.bind(mqMobile))(function(){ fermer(); });
  })();


  /* =======================================================================
     21. REPLI SERVICES DU MENU MOBILE
     Sous 940px la barre du haut disparaît, et le dépliant Services avec elle.
     Le survol n'existe pas au doigt : ce repli est le seul accès aux cinq
     pages de prestation sur téléphone.
     ======================================================================= */
  (function(){
    var btn  = document.getElementById('mmServices');
    var sous = document.getElementById('mmSousServices');
    if(!btn || !sous) return;

    var deplie = false;
    var minuteur = null;

    function replier(){
      clearTimeout(minuteur);
      if(!deplie) return;
      deplie = false;
      sous.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      /* On attend la fin du repli avant de remettre `hidden`. Sans ce délai
         la liste disparaîtrait d'un coup ; sans `hidden` du tout, ses cinq
         liens resteraient atteignables au clavier derrière un `max-height:0`
         (SC 2.4.3), car `overflow:hidden` masque sans retirer du parcours. */
      minuteur = setTimeout(function(){ if(!deplie) sous.hidden = true; }, 440);
    }

    function deplier(){
      clearTimeout(minuteur);
      if(deplie) return;
      deplie = true;
      sous.hidden = false;
      /* Même raison qu'au dépliant du haut : il faut un état de départ
         calculé avant de poser la classe, sinon le navigateur fusionne les
         deux et la transition ne démarre pas. Une lecture de géométrie est
         synchrone, contrairement à requestAnimationFrame. */
      void sous.offsetHeight;
      sous.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');

      /* Sur un écran court, déplier pousse la fin de la liste hors champ : on
         voyait s'ouvrir deux prestations sur cinq, sans rien qui indique que
         les trois autres existent plus bas. On amène donc le bas du repli
         dans le champ une fois l'animation finie — avant, la hauteur mesurée
         serait encore celle du repli fermé. */
      minuteur = setTimeout(function(){
        if(!deplie) return;
        var zone = sous.parentElement;
        /* On mesure sur `scrollHeight`, la hauteur déployée, et non sur le
           rectangle courant : celui-ci vaut ce que l'animation a parcouru.
           Si la transition est escamotée — mouvement réduit, onglet en
           arrière-plan — le rectangle vaudrait encore zéro et le débordement
           serait calculé négatif, donc ignoré. */
        var basDeploye = sous.getBoundingClientRect().top + sous.scrollHeight;
        var debord = basDeploye - zone.getBoundingClientRect().bottom;
        if(debord > 0){
          zone.scrollBy({
            top: debord + 8,
            behavior: (window.SS && SS.prefersReduced) ? 'auto' : 'smooth'
          });
        }
      }, 460);
    }

    btn.addEventListener('click', function(){ deplie ? replier() : deplier(); });

    /* Le menu plein écran se referme de trois façons : le bouton Fermer, le
       choix d'un lien, et Échap. Dans les trois cas on replie, pour que la
       prochaine ouverture reparte d'un menu au repos. */
    var fermeture = document.getElementById('closeMenu');
    if(fermeture) fermeture.addEventListener('click', replier);

    var menu = document.getElementById('mobileMenu');
    if(menu){
      menu.querySelectorAll('a').forEach(function(a){
        a.addEventListener('click', replier);
      });
    }
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape') replier();
    });
  })();

})();
