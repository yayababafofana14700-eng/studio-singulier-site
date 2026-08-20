/* Studio Singulier — animations
   Sorti du fichier unique le 13/08/2026 lors du passage en architecture
   multi-pages. Chargé par les 6 pages ; chaque effet teste la présence de sa cible,
   donc une page sans rail ou sans compteur ne déclenche rien. */

(function(){
  'use strict';
  document.documentElement.classList.add('js');

  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP  = typeof gsap !== 'undefined';
  var hasST    = hasGSAP && typeof ScrollTrigger !== 'undefined';
  var canHover = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var animate  = hasGSAP && !prefersReduced;

  if(hasST){
    gsap.registerPlugin(ScrollTrigger);
    /* Sur Android et iOS, la barre d'URL se rétracte au défilement : la
       hauteur du viewport change de plusieurs dizaines de pixels, sans qu'il
       se soit rien passé. ScrollTrigger recalculerait alors ses points de
       départ et d'arrivée au milieu du geste, et la section épinglée
       sauterait sous le doigt. ignoreMobileResize lui fait ignorer ces
       variations de hauteur seule ; la rotation, elle, change la largeur et
       reste prise en compte. */
    ScrollTrigger.config({ ignoreMobileResize: true });
  }


  /* Espace de noms partagé avec main.js. Lu à l'appel, jamais au chargement :
     l'ordre des deux fichiers n'a donc aucune importance. */
  window.SS = window.SS || {};
  SS.animate = animate; SS.hasGSAP = hasGSAP; SS.hasST = hasST;
  SS.canHover = canHover; SS.prefersReduced = prefersReduced;
  SS.lenis = null;
  /* =======================================================================
     1. DÉCOUPAGE PAR MOTS
     Chaque mot reçoit son propre masque en overflow:hidden. On descend
     récursivement dans le DOM pour préserver les <span>/<em> déjà présents
     dans les titres, au lieu d'écraser innerHTML.
     ======================================================================= */
  function splitWords(el){
    (function walk(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(kid){
        if(kid.nodeType === 3){
          if(!kid.textContent.trim()) return;
          var frag = document.createDocumentFragment();
          kid.textContent.split(/(\s+)/).forEach(function(part){
            if(!part) return;
            if(!part.trim()){ frag.appendChild(document.createTextNode(part)); return; }
            var outer = document.createElement('span'); outer.className = 'w';
            var inner = document.createElement('span'); inner.className = 'wi';
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          node.replaceChild(frag, kid);
        } else if(kid.nodeType === 1){
          walk(kid);
        }
      });
    })(el);
    return el.querySelectorAll('.wi');
  }

  /* On ne masque les mots QUE si on est certain de pouvoir les révéler : la
     révélation dépend de ScrollTrigger pour toutes les sections hors hero.
     Sans lui, les titres resteraient décalés de 105% hors de leur masque. */
  var splitTargets = [];
  if(animate && hasST){
    document.querySelectorAll('[data-split]').forEach(function(el){
      var words = splitWords(el);
      el.classList.add('split-ready');
      splitTargets.push({ el: el, words: words });
    });
  }
  /* =======================================================================
     2. SMOOTH SCROLL
     ======================================================================= */
  var lenis = null;
  if(typeof Lenis !== 'undefined' && !prefersReduced){
    lenis = new Lenis({
      duration: 1.1,
      easing: function(t){ return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true
    });
    document.documentElement.classList.add('lenis');

    if(hasST){
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(time){ lenis.raf(time); requestAnimationFrame(raf); })();
    }
  }

  // ancres internes, avec ou sans Lenis
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var id = a.getAttribute('href');
      if(id.length < 2) return;
      var target = document.querySelector(id);
      if(!target) return;
      e.preventDefault();
      if(lenis) lenis.scrollTo(target, { offset: -72 });
      else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  /* =======================================================================
     4. RÉVÉLATIONS AU SCROLL
     clearProps est indispensable : sans lui GSAP laisse un transform inline
     sur chaque section, soit une dizaine de calques de composition pleine
     largeur que le GPU doit re-rasteriser à chaque redimensionnement.
     ======================================================================= */
  if(animate && hasST){
    gsap.utils.toArray('.reveal').forEach(function(el){
      gsap.fromTo(el,
        { opacity: 0, y: 30 },
        {
          opacity: 1, y: 0, duration: .9, ease: 'power3.out',
          clearProps: 'transform,willChange',
          scrollTrigger: { trigger: el, start: 'top 86%' }
        }
      );
    });

    // titres : révélation par masque de mot
    splitTargets.forEach(function(t){
      if(t.el.id === 'heroTitle') return; // pris en charge par la timeline d'entrée
      gsap.to(t.words, {
        y: 0, duration: .95, ease: 'power4.out', stagger: .026,
        clearProps: 'willChange',
        scrollTrigger: { trigger: t.el, start: 'top 88%' }
      });
    });
  }
  /* =======================================================================
     5. ENTRÉE DU HERO
     ======================================================================= */
  (function(){
    var copy = document.querySelectorAll('.hero-copy > *');
    /* Depuis le passage en multi-pages, seule l'accueil porte un hero.
       Sans cette sortie, GSAP avertit sur #heroEyebrow / #heroTitle /
       #heroLead / #heroCtas introuvables sur les 5 pages internes. */
    if(!copy.length) return;

    /* Piège à désamorcer : `.hero-copy > *` est à `opacity:0` en CSS, et seule
       cette timeline les révèle — en ciblant des id câblés en dur. Une page
       interne qui réutiliserait `.hero-copy` sans ces id exacts afficherait
       donc un bloc parfaitement invisible. On révèle et on sort. */
    if(!document.getElementById('heroTitle')){
      copy.forEach(function(el){ el.style.opacity = 1; });
      return;
    }

    if(!animate){
      copy.forEach(function(el){ el.style.opacity = 1; });
      return;
    }
    var heroWords = null;
    splitTargets.forEach(function(t){ if(t.el.id === 'heroTitle') heroWords = t.words; });

    var tl = gsap.timeline({ delay: .18 });
    tl.to('#heroEyebrow', { opacity: 1, duration: .7, ease: 'power2.out' })
      .set('#heroTitle', { opacity: 1 }, '-=.4');
    if(heroWords){
      tl.to(heroWords, { y: 0, duration: 1.05, ease: 'power4.out', stagger: .034 }, '-=.35');
    }
    tl.to('#heroLead', { opacity: 1, duration: .8, ease: 'power2.out' }, '-=.6')
      .to('#heroCtas', { opacity: 1, duration: .8, ease: 'power2.out' }, '-=.55');

    /* La vidéo entre AVEC le texte, pas après : elle chevauche l'accroche et
       les boutons. Sans ce recouvrement, elle aurait l'air rapportée.
       L'état de départ est posé en JS et non en CSS, volontairement : si le
       CDN GSAP tombe, aucune règle n'a masqué la vidéo, elle reste visible.
       Un déplacement de 18px seulement — la consigne interdit les zooms et
       les effets appuyés. */
    var vid = document.getElementById('heroVideo');
    if(vid){
      gsap.set(vid, { opacity: 0, y: 18 });
      tl.to(vid, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }, '-=1.15');
    }
  })();
  /* =======================================================================
     6. BANDEAU DÉFILANT
     Une seule marquee sur toute la page. Le contenu est dupliqué pour que
     la boucle soit continue, puis translaté sur la moitié de sa largeur.
     ======================================================================= */
  (function(){
    var track = document.getElementById('tickerTrack');
    if(!track || !animate) return;
    track.innerHTML += track.innerHTML;
    var half = track.scrollWidth / 2;
    gsap.to(track, {
      x: -half,
      duration: 34,
      ease: 'none',
      repeat: -1,
      modifiers: { x: function(x){ return (parseFloat(x) % half) + 'px'; } }
    });
  })();
  /* =======================================================================
     7. COMPTEURS
     Le chiffre est le message de la section : on l'anime pour qu'il attire
     l'œil au moment où il entre, une seule fois.
     ======================================================================= */
  if(animate && hasST){
    document.querySelectorAll('.metric .v[data-count]').forEach(function(el){
      var end = parseFloat(el.dataset.count);
      var pre = el.dataset.prefix || '';
      var suf = el.dataset.suffix || '';
      var obj = { n: 0 };
      gsap.to(obj, {
        n: end,
        duration: 1.7,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onUpdate: function(){ el.textContent = pre + Math.round(obj.n) + suf; }
      });
    });
  }
  /* =======================================================================
     8. PANORAMIQUE HORIZONTAL PILOTÉ PAR LE SCROLL VERTICAL
     Un seul composant pour les deux sections : cas d'usage et prestations.

     Principe : la section est épinglée le temps exact que la piste met à
     défiler. La durée d'épinglage vaut la distance horizontale, au pixel
     près, donc un pixel de molette égale un pixel de translation. C'est ce
     rapport 1:1 qui évite la sensation de page bloquée : le coût du geste
     correspond à ce qu'on voit avancer.

     Le geste reste vertical sur les deux plateformes : molette au bureau,
     glissement du doigt au mobile. Dans les deux cas c'est le défilement de
     la page qui pilote la translation, jamais un glissement horizontal.

     Repli assumé : sans GSAP, en mouvement réduit, ou si la section ne tient
     pas dans la hauteur d'écran, aucun épinglage n'est créé. La piste
     redevient une liste défilable au doigt, avec ses points d'accroche. Le
     repli est l'état par défaut du CSS, pas un correctif appliqué après coup.
     C'est la HAUTEUR qui décide, plus la largeur : un téléphone tenu droit a
     la place, le même couché ne l'a pas.
     ======================================================================= */
  (function(){
    var sections = Array.prototype.slice.call(document.querySelectorAll('[data-hpan]'));
    if(!sections.length) return;
    var panneaux = [];

    sections.forEach(function(sec){
      var vp    = sec.querySelector('[data-hpan-viewport]');
      var track = sec.querySelector('[data-hpan-track]');
      var bar   = sec.querySelector('[data-hpan-bar]');
      var idx   = sec.querySelector('[data-hpan-index]');
      var prev  = sec.querySelector('[data-hpan-prev]');
      var next  = sec.querySelector('[data-hpan-next]');
      if(!vp || !track) return;
      var cartes = Array.prototype.slice.call(track.children);
      if(!cartes.length) return;

      var st = null, tween = null;

      function pas(){
        return cartes.length > 1
          ? cartes[1].offsetLeft - cartes[0].offsetLeft
          : cartes[0].offsetWidth;
      }
      function distance(){
        return Math.max(0, track.scrollWidth - vp.clientWidth);
      }

      /* barre + compteur : une seule fonction pour les deux modes */
      function peindre(p){
        p = Math.min(1, Math.max(0, p));
        if(idx){
          var n = Math.min(cartes.length, Math.floor(p * (cartes.length - 1) + 0.5) + 1);
          if(idx.textContent !== String(n)) idx.textContent = n;
        }
        if(bar){
          var visible = Math.min(1, vp.clientWidth / track.scrollWidth);
          bar.style.width = Math.max(visible * 100, 10) + '%';
          bar.style.transform = 'translate3d(' + (p * (100 / Math.max(visible, .1) - 100)) + '%,0,0)';
        }
      }
      function peindreDepuisScroll(){
        var d = distance();
        peindre(d > 0 ? vp.scrollLeft / d : 0);
      }
      vp.addEventListener('scroll', peindreDepuisScroll, { passive: true });
      peindreDepuisScroll();

      /* ---------- mode panoramique ---------- */
      /* Mesure préalable : la section, une fois resserrée, tient-elle dans
         l'écran ? Si elle déborde, l'épingler couperait les cartes et
         pousserait l'indicateur sous le pli, au moment précis où il sert. */
      function tientDansEcran(){
        var avait = sec.classList.contains('is-pinned');
        if(!avait) sec.classList.add('is-pinned');
        var h = sec.getBoundingClientRect().height;
        if(!avait) sec.classList.remove('is-pinned');
        return h <= window.innerHeight + 2;
      }

      /* Cartes hors du cadre visible, en mode épinglé : elles restent
         focusables au clavier (Tab) alors que le conteneur est
         overflow:hidden. Or un focus() sur un descendant d'un ancêtre
         overflow:hidden déclenche quand même, dans certains moteurs, un
         défilement natif de cet ancêtre pour « révéler » l'élément — ce
         qui pousse vp.scrollLeft à une valeur arbitraire pendant que la
         position réelle des cartes reste pilotée par le transform GSAP.
         Les deux systèmes se désynchronisent, et la piste saute au coup de
         molette suivant.
         Choix : inert plutôt que resynchroniser le transform sur focusin.
         Une resynchronisation (déjà tentée plus bas pour l'entrée dans le
         panoramique) ne fait que réagir après coup : elle ne peut pas
         garantir de gagner la course contre le défilement natif, qui peut
         s'exécuter après le point où le script reprend la main. inert
         retire les cartes hors champ de l'ordre de tabulation *avant*
         qu'un focus ne puisse s'y poser : la classe de bug disparaît au
         lieu d'être rattrapée. Le clavier navigue alors carte par carte
         via les flèches ◄► (déjà câblées plus bas), qui avancent la page
         et donc le panoramique — la carte cible devient non-inert dès
         qu'elle entre dans le cadre. */
      function marquerVisibles(p){
        var decalage = p * distance();
        var largeur = vp.clientWidth;
        cartes.forEach(function(carte){
          var gauche = carte.offsetLeft - decalage;
          var droite = gauche + carte.offsetWidth;
          var visible = droite > 0 && gauche < largeur;
          if(visible) carte.removeAttribute('inert');
          else carte.setAttribute('inert', '');
        });
      }

      function construire(){
        if(distance() < 40) return;          // rien à faire défiler
        sec.classList.add('is-pinned');
        vp.scrollLeft = 0;
        gsap.set(track, { x: 0 });
        marquerVisibles(0);
        tween = gsap.to(track, {
          x: function(){ return -distance(); },
          ease: 'none',
          force3D: true,                      // translate3d : composité par le GPU
          scrollTrigger: {
            trigger: sec,
            start: 'top top',
            end: function(){ return '+=' + distance(); },
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,                 // évite le saut sur molette rapide
            /* La molette avance par crans : le lissage absorbe ces marches.
               Le doigt, lui, produit un geste continu qui porte déjà son
               inertie — 0,6 s de retard s'y lirait comme un décrochage entre
               le doigt et les cartes. On lisse alors juste assez pour manger
               le tremblement du geste. */
            scrub: canHover ? .6 : .12,
            invalidateOnRefresh: true,
            onUpdate: function(self){ peindre(self.progress); marquerVisibles(self.progress); }
          }
        });
        st = tween.scrollTrigger;
      }
      function detruire(){
        if(tween){ tween.scrollTrigger && tween.scrollTrigger.kill(); tween.kill(); tween = null; }
        st = null;
        gsap.set(track, { clearProps: 'transform' });
        sec.classList.remove('is-pinned');
        // Repli tactile natif (mobile, <900px, mouvement réduit) : toutes
        // les cartes redeviennent atteignables, le défilement horizontal
        // normal du conteneur (overflow-x:auto) gère seul la mise en vue.
        cartes.forEach(function(carte){ carte.removeAttribute('inert'); });
        peindreDepuisScroll();
      }

      /* Le panoramique ne s'active qu'au-dessus de 900px et hors mouvement
         réduit. gsap.matchMedia démonte proprement au redimensionnement. */
      panneaux.push({ sec: sec, construire: construire, detruire: detruire,
                      tient: tientDansEcran, distance: distance });

      /* ---------- flèches ----------
         Épinglé, on ne pousse pas la piste : on avance la page. Le rapport
         est 1:1, donc faire défiler d'un pas vertical décale la piste
         d'exactement une carte, et la barre suit sans se désynchroniser. */
      function avancer(sens){
        if(st){
          var y = window.scrollY + sens * pas();
          y = Math.max(st.start, Math.min(st.end, y));
          if(lenis) lenis.scrollTo(y, { duration: .7 });
          else window.scrollTo({ top: y, behavior: 'smooth' });
        } else {
          vp.scrollBy({ left: sens * pas(), behavior: 'smooth' });
        }
      }
      if(prev) prev.addEventListener('click', function(){ avancer(-1); });
      if(next) next.addEventListener('click', function(){ avancer(1); });

      /* clavier : la piste reste pilotable sans souris dans les deux modes */
      vp.addEventListener('keydown', function(e){
        if(e.key === 'ArrowRight'){ e.preventDefault(); avancer(1); }
        else if(e.key === 'ArrowLeft'){ e.preventDefault(); avancer(-1); }
      });

      /* Tabulation vers une carte hors écran : le navigateur essaierait de
         faire défiler un conteneur en overflow:hidden, ce qui décalerait la
         piste de sa transformation. On annule ce défilement et on amène la
         carte par la page. */
      track.addEventListener('focusin', function(e){
        if(!st) return;
        var carte = e.target.closest('.rail-item');
        if(!carte) return;
        vp.scrollLeft = 0;
        var cible = st.start + (carte.offsetLeft / Math.max(distance(), 1)) * (st.end - st.start);
        cible = Math.max(st.start, Math.min(st.end, cible));
        if(Math.abs(window.scrollY - cible) < 8) return;
        if(lenis) lenis.scrollTo(cible, { duration: .5 });
        else window.scrollTo({ top: cible });
      });
    });

    /* Activation groupée. Le brief est explicite : le visiteur ne doit jamais
       sentir qu'il change de système de navigation. Si une seule des deux
       sections ne peut pas être épinglée, aucune ne l'est, et les deux
       gardent le défilement tactile natif. Mieux vaut deux sections
       cohérentes qu'une épinglée et l'autre non. */
    if(animate && hasST && typeof gsap.matchMedia === 'function'){
      var actif = false, enCours = false;

      /* La décision dépend de la HAUTEUR réellement occupée, donc des polices
         et des images. Évaluée une seule fois au démarrage, elle tomberait
         avant leur chargement : la section mesurerait trop haut et
         l'épinglage serait refusé pour de bon. On réévalue donc à chaque
         moment où la hauteur peut avoir changé. */
      function evaluer(){
        if(!actif || enCours) return;
        enCours = true;
        panneaux.forEach(function(p){ p.detruire(); });
        var eligibles = panneaux.filter(function(p){ return p.distance() >= 40; });
        var toutes = eligibles.length > 0 && eligibles.every(function(p){ return p.tient(); });
        if(toutes) eligibles.forEach(function(p){ p.construire(); });
        ScrollTrigger.refresh();
        enCours = false;
      }

      /* Plus de borne de largeur : le panoramique est le comportement voulu
         sur téléphone aussi. Le seul garde-fou est tientDansEcran(), évalué
         plus haut — il porte sur la hauteur, qui est la vraie contrainte. */
      gsap.matchMedia().add(
        '(prefers-reduced-motion: no-preference)',
        function(){
          actif = true;
          evaluer();
          return function(){ actif = false; panneaux.forEach(function(p){ p.detruire(); }); };
        }
      );

      window.addEventListener('load', evaluer);
      if(document.fonts && document.fonts.ready) document.fonts.ready.then(evaluer);

      /* matchMedia ne réagit qu'à la largeur. Or notre garde-fou porte sur la
         hauteur : rotation, fenêtre redimensionnée.
         Une variation de hauteur SEULE est traitée à part. Au bureau elle
         signale un vrai redimensionnement et doit être suivie. Au doigt, elle
         vient presque toujours de la barre d'URL qui se rétracte pendant le
         défilement : reconstruire l'épinglage à cet instant le ferait sauter
         en pleine lecture. On l'ignore donc, et seul un changement de largeur
         — la rotation — déclenche la réévaluation. */
      var derniereH = window.innerHeight, derniereW = window.innerWidth, minuteur;
      window.addEventListener('resize', function(){
        clearTimeout(minuteur);
        minuteur = setTimeout(function(){
          var dh = Math.abs(window.innerHeight - derniereH);
          var dw = Math.abs(window.innerWidth  - derniereW);
          if(dw < 2 && !canHover) return;     // barre d'URL : rien n'a changé
          if(dh > 40 || dw > 2){
            derniereH = window.innerHeight;
            derniereW = window.innerWidth;
            evaluer();
          }
        }, 240);
      });
    }
  })();
  /* =======================================================================
     9. INDEX COLLANT DES PRINCIPES
     ======================================================================= */
  (function(){
    var items = document.querySelectorAll('#principleIndex li');
    var blocks = document.querySelectorAll('#principlesList .principle');
    if(!items.length || !blocks.length || !('IntersectionObserver' in window)) return;
    items[0].classList.add('on');
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(!en.isIntersecting) return;
        var i = Array.prototype.indexOf.call(blocks, en.target);
        items.forEach(function(li){ li.classList.remove('on'); });
        if(items[i]) items[i].classList.add('on');
      });
    }, { rootMargin: '-40% 0px -50% 0px' });
    blocks.forEach(function(b){ io.observe(b); });
  })();
  /* =======================================================================
     10. FRISE DE MÉTHODE
     La barre se remplit en scrub sur le scroll : elle raconte la progression
     du projet, c'est la seule raison pour laquelle elle bouge.
     ======================================================================= */
  if(animate && hasST){
    var tline = document.getElementById('timeline');
    var fill  = document.getElementById('timelineFill');
    if(tline && fill){
      var steps = tline.querySelectorAll('.step');
      var vertical = window.matchMedia('(max-width: 560px)').matches;
      gsap.fromTo(fill,
        vertical ? { height: 0 } : { width: 0 },
        {
          width: vertical ? 1 : '100%',
          height: vertical ? '100%' : 1,
          ease: 'none',
          scrollTrigger: {
            trigger: tline,
            start: 'top 74%',
            end: 'bottom 62%',
            scrub: .5,
            onUpdate: function(self){
              var lit = Math.round(self.progress * steps.length);
              steps.forEach(function(s, i){ s.classList.toggle('lit', i < lit); });
            }
          }
        }
      );
    }
  }
  /* =======================================================================
     11. TEXTE À PROPOS : révélation mot à mot en scrub
     ======================================================================= */
  (function(){
    var el = document.getElementById('aboutText');
    if(!el || !animate || !hasST) return;

    (function walk(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(kid){
        if(kid.nodeType === 3){
          if(!kid.textContent.trim()) return;
          var frag = document.createDocumentFragment();
          kid.textContent.split(/(\s+)/).forEach(function(part){
            if(!part) return;
            if(!part.trim()){ frag.appendChild(document.createTextNode(part)); return; }
            var s = document.createElement('span');
            s.className = 'rw';
            s.textContent = part;
            frag.appendChild(s);
          });
          node.replaceChild(frag, kid);
        } else if(kid.nodeType === 1){ walk(kid); }
      });
    })(el);

    gsap.to(el.querySelectorAll('.rw'), {
      opacity: 1, ease: 'none', stagger: .5,
      scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 60%', scrub: .4 }
    });
  })();
  /* =======================================================================
     13. EFFET MAGNÉTIQUE
     Uniquement sur les CTA en ligne, jamais sur un bouton pleine largeur :
     décaler un bloc de 100% ferait dériver la zone cliquable hors de son
     rendu visuel.
     ======================================================================= */
  if(animate && canHover){
    document.querySelectorAll('.btn:not(.btn-block)').forEach(function(btn){
      btn.addEventListener('mousemove', function(e){
        var r = btn.getBoundingClientRect();
        gsap.to(btn, {
          x: (e.clientX - r.left - r.width / 2) * .15,
          y: (e.clientY - r.top - r.height / 2) * .2,
          duration: .45, ease: 'power3.out'
        });
      });
      btn.addEventListener('mouseleave', function(){
        gsap.to(btn, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1, .45)' });
      });
    });
  }

  SS.lenis = lenis;

})();
