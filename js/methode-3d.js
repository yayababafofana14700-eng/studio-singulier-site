/* ===========================================================================
   FORME QUI S'ORDONNE — page Méthode

   Une forme en fil de fer, déformée par du bruit au début, qui se stabilise à
   mesure qu'on descend les cinq étapes. Le titre de la page dit « Cinq étapes,
   aucune surprise à la fin » : l'objet le montre au lieu de le décorer.

   Le coût, dit franchement
   -----------------------
   Three.js se sert en deux fichiers — `three.module.min.js` importe
   `three.core.min.js` — soit 151 Ko en brotli, contre 104 Ko pour toute la
   page. La bibliothèque pèse donc une fois et demie le reste du document.

   C'est pourquoi rien n'est chargé d'avance : elle n'est demandée que lorsque
   le bloc approche de l'écran, et seulement sur un appareil qui saura
   l'afficher. Un visiteur en mouvement réduit, sans WebGL, sur un téléphone
   modeste ou qui ne descend jamais jusque-là ne télécharge rien du tout.

   Repli
   -----
   Sans WebGL ou sans JavaScript, le bloc reste vide et la page se lit
   normalement. Rien de ce qui suit n'est nécessaire à la compréhension du
   contenu : c'est un ornement, il doit se comporter comme tel.
   =========================================================================== */
(function () {
  'use strict';

  var hote = document.getElementById('methode-3d');
  if (!hote) return;

  /* ---- Portes d'entrée, de la moins chère à la plus chère ---------------- */

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* Un écran étroit ne laisse pas la place à un objet lisible, et c'est
     souvent l'appareil le plus contraint en batterie et en données. */
  if (window.innerWidth < 900) return;

  /* Indices de faiblesse matérielle. Absents sur certains navigateurs, d'où
     les valeurs par défaut permissives : on n'exclut que ce qui se déclare
     faible, jamais ce qui ne se déclare pas. */
  if ((navigator.deviceMemory || 8) < 4) return;
  if ((navigator.hardwareConcurrency || 8) < 4) return;

  /* WebGL réellement disponible, pas seulement annoncé. */
  var contexteOk = (function () {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  })();
  if (!contexteOk) return;

  /* ---- Chargement différé ------------------------------------------------ */

  var demarre = false;

  var guetteur = new IntersectionObserver(function (entrees) {
    if (!entrees[0].isIntersecting || demarre) return;
    demarre = true;
    guetteur.disconnect();
    import('./vendor/three.module.min.js').then(construire).catch(function () {
      /* Réseau coupé, fichier absent : le bloc reste vide, la page vit. */
    });
  }, { rootMargin: '200px' });

  guetteur.observe(hote);

  /* ---- La scène --------------------------------------------------------- */

  function construire(THREE) {
    var largeur = hote.clientWidth;
    var hauteur = hote.clientHeight;

    var scene = new THREE.Scene();

    var camera = new THREE.PerspectiveCamera(42, largeur / hauteur, 0.1, 100);
    camera.position.z = 3.4;

    var rendu = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    rendu.setSize(largeur, hauteur);
    /* Plafonner la densité de pixels : au-delà de 1,5 le gain est invisible
       sur une forme en fil de fer, le coût GPU ne l'est pas. */
    rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    hote.appendChild(rendu.domElement);

    var geometrie = new THREE.IcosahedronGeometry(1, 5);

    /* Le déplacement se fait dans le nuanceur de sommets : le maillage n'est
       jamais reconstruit côté processeur, seul un nombre change par image.

       Le bruit est une composition de sinus plutôt qu'un simplex complet.
       Moins juste mathématiquement, mais dix lignes au lieu de quatre-vingts,
       et sur une forme abstraite la différence ne se voit pas. */
    var materiau = new THREE.ShaderMaterial({
      transparent: true,
      wireframe: true,
      uniforms: {
        uTemps:    { value: 0 },
        uDesordre: { value: 1 },      /* 1 = agité, 0 = stabilisé */
        uTeinte:   { value: new THREE.Color(0xF04A26) },  /* --signal */
        uCalme:    { value: new THREE.Color(0xEDE8DC) }   /* --fg */
      },
      vertexShader: [
        'uniform float uTemps;',
        'uniform float uDesordre;',
        'varying float vAmplitude;',
        'void main(){',
        '  vec3 p = position;',
        '  float n = sin(p.x * 3.0 + uTemps)',
        '          * cos(p.y * 3.0 - uTemps * 0.8)',
        '          * sin(p.z * 3.0 + uTemps * 0.6);',
        '  float amp = n * uDesordre * 0.42;',
        '  p += normal * amp;',
        '  vAmplitude = abs(amp);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
        '}'
      ].join('\n'),
      /* Les arêtes les plus déformées virent au signal, les stabilisées
         reviennent au crème : la couleur dit l'état, pas seulement la forme. */
      fragmentShader: [
        'uniform vec3 uTeinte;',
        'uniform vec3 uCalme;',
        'varying float vAmplitude;',
        'void main(){',
        '  vec3 c = mix(uCalme, uTeinte, smoothstep(0.0, 0.22, vAmplitude));',
        '  gl_FragColor = vec4(c, 0.34);',
        '}'
      ].join('\n')
    });

    var forme = new THREE.Mesh(geometrie, materiau);
    scene.add(forme);

    /* ---- La progression du scroll pilote le désordre --------------------- */

    var section = hote.closest('section') || hote.parentElement;

    function progression() {
      var r = section.getBoundingClientRect();
      var course = r.height + window.innerHeight;
      var fait = window.innerHeight - r.top;
      return Math.max(0, Math.min(1, fait / course));
    }

    /* ---- Boucle ---------------------------------------------------------- */

    var visible = true;
    var horloge = new THREE.Clock();
    var animation = null;

    function image() {
      animation = requestAnimationFrame(image);
      if (!visible) return;

      materiau.uniforms.uTemps.value = horloge.getElapsedTime() * 0.55;
      /* 1 au début de la section, 0 à la fin : la forme se range en avançant
         dans les étapes. */
      materiau.uniforms.uDesordre.value = 1 - progression();

      forme.rotation.y += 0.0016;
      forme.rotation.x += 0.0007;

      rendu.render(scene, camera);
    }
    image();

    /* Hors écran, on ne rend rien. Une boucle qui tourne pour personne coûte
       de la batterie et rien d'autre. */
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; })
      .observe(hote);

    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
    });

    /* ---- Redimensionnement ----------------------------------------------- */

    var attente = null;
    window.addEventListener('resize', function () {
      clearTimeout(attente);
      attente = setTimeout(function () {
        var l = hote.clientWidth, h = hote.clientHeight;
        if (!l || !h) return;
        camera.aspect = l / h;
        camera.updateProjectionMatrix();
        rendu.setSize(l, h);
      }, 180);
    });

    /* ---- Libération ------------------------------------------------------ */

    window.addEventListener('pagehide', function () {
      cancelAnimationFrame(animation);
      geometrie.dispose();
      materiau.dispose();
      rendu.dispose();
    });
  }
})();
