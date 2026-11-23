/* L'Oracle — mise en scène. Le calcul est dans oracle.js. */
(function () {
  'use strict';

  const O = window.Oracle;
  const params = new URLSearchParams(location.search);
  const DEBUG = params.has('debug');
  const FAST = params.has('fast');

  const $ = (id) => document.getElementById(id);
  const title = $('title'), sub = $('sub'), symbolsBox = $('symbols'), controls = $('controls');
  const ring = $('ring'), oracleText = $('oracleText'), debugBox = $('debug');
  const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 40) : ms));

  // Icônes au trait (24×24).
  const ICONS = {
    lune: '<path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a6.6 6.6 0 0 0 9.5 9.5z"/>',
    soleil: '<circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v2.5M12 20v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M1.5 12H4M20 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>',
    etoile: '<path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5l-5.9 3.2 1.2-6.6-4.8-4.6 6.6-.9z"/>',
    bougie: '<rect x="8.5" y="10.5" width="7" height="11" rx="1"/><path d="M12 10.5V8.5"/><path d="M12 2.5c1.6 2 2.3 3.2 2.3 4.2a2.3 2.3 0 0 1-4.6 0c0-1 .7-2.2 2.3-4.2z"/>',
    chat: '<path d="M4 11V3.5l4.5 4h7L20 3.5V11a8 8 0 0 1-16 0z"/><circle cx="9" cy="12" r=".9"/><circle cx="15" cy="12" r=".9"/><path d="M11 15.5h2l-1 1.2z"/>',
    arbre: '<circle cx="12" cy="9" r="6.5"/><path d="M12 15.5V22M12 19l-3-2.5M12 18l3-2.5M8.5 22h7"/>',
    vague: '<path d="M2 18c2.5 0 2.5-2.5 5-2.5s2.5 2.5 5 2.5 2.5-2.5 5-2.5 2.5 2.5 5 2.5"/><path d="M2 13.5c2.5 0 2.5-2.5 5-2.5s2.5 2.5 5 2.5 2.5-2.5 5-2.5 2.5 2.5 5 2.5"/><path d="M5 8.5c2-3.5 7-4.5 10-1.5"/>',
    miroir: '<ellipse cx="12" cy="9" rx="5.5" ry="6.5"/><path d="M12 15.5V22M9.5 22h5M9.6 6.2c-.9.9-1.2 2-1.2 3"/>',
    sablier: '<path d="M6 2.5h12M6 21.5h12M7.5 2.5c0 5 4.5 6.5 4.5 9.5s-4.5 4.5-4.5 9.5M16.5 2.5c0 5-4.5 6.5-4.5 9.5s4.5 4.5 4.5 9.5M10 19h4"/>',
    serpent: '<path d="M17.5 5.5c-2-2-6.5-1.6-6.5 1.7s7 3.2 7 7-3.6 5.8-7.5 5.8S4.5 18 4.5 16"/><circle cx="17.2" cy="5.2" r="1.6"/><path d="M18.8 5.4l2.2-.6M18.8 5.4l1.6 1.5"/>',
    couronne: '<path d="M3.5 18L2.5 7.5l5 4 4.5-7 4.5 7 5-4-1 10.5z"/><path d="M4.5 21h15"/>',
    papillon: '<path d="M12 11.5C9.5 4.5 3 3.5 3 7.5s4.5 5 9 4zM12 11.5c2.5-7 9-8 9-4s-4.5 5-9 4zM12 12c-3 .8-7 2.8-5.8 5.8S11 18 12 12zM12 12c3 .8 7 2.8 5.8 5.8S13 18 12 12z"/><path d="M12 7.5v11M12 7.5l-1.8-3M12 7.5l1.8-3"/>',
  };

  const VISION_TEXT = {
    lumiere: 'Je vois… de la lumière.',
    vivant: 'Je ressens… quelque chose de vivant.',
    objet: 'Je vois… un objet. Quelque chose de fabriqué.',
    ciel: 'Je vois… le ciel.',
    eau: 'Je sens… de l\'eau.',
    nuit: 'Je vois… la nuit.',
    chaud: 'Je ressens… de la chaleur.',
    animal: 'Je sens… un animal.',
    verre: 'Je vois… du verre.',
    ailes: 'Je vois… des ailes.',
  };

  const READING = {
    lune: 'L\'intuition. Tu sens les choses avant les autres… écoute-toi davantage.',
    chat: 'L\'indépendance. Tu aimes les gens, mais tu tiens à ton espace.',
    arbre: 'Les racines. Quelqu\'un de ta famille compte plus que tu ne le dis.',
    vague: 'Le changement. Quelque chose bouge en ce moment, et tu le sens venir.',
    soleil: 'L\'énergie. Tu en donnes beaucoup aux autres. Garde-en un peu pour toi.',
    bougie: 'La patience. Tu attends une réponse. Elle arrive.',
    etoile: 'Un rêve. Tu en as un dont tu n\'as parlé à presque personne.',
    miroir: 'L\'exigence. Tu es plus dur avec toi-même qu\'avec les autres.',
    sablier: 'Le temps. Tu as l\'impression d\'en manquer… tu es pourtant en avance.',
    serpent: 'La métamorphose. Tu as plus changé ces dernières années qu\'on ne le croit.',
    couronne: 'La fierté. Tu as réussi quelque chose dont tu ne parles pas assez.',
    papillon: 'Le renouveau. Une nouvelle étape commence pour toi.',
  };

  // ------------------------------------------------------------------ affichage
  const { layout } = O.bestLayout(Math.floor(Math.random() * 1e9), 24);
  const els = []; // els[pos]

  function place(el, pos) {
    const a = (-90 + pos * 30) * Math.PI / 180;
    el.style.left = (50 + 40 * Math.cos(a)) + '%';
    el.style.top = (50 + 40 * Math.sin(a)) + '%';
  }

  layout.forEach((symIdx, pos) => {
    const s = O.SYMBOLS[symIdx];
    const b = document.createElement('button');
    b.className = 'sym'; b.dataset.pos = pos; b.setAttribute('aria-label', s.name);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[s.id]}</svg><span>${s.name}</span>`;
    place(b, pos);
    symbolsBox.appendChild(b); els.push(b);
  });

  async function caption(t, s) {
    title.classList.add('fade'); sub.classList.add('fade');
    await sleep(280);
    title.textContent = t || '';
    sub.innerHTML = s || '';
    title.classList.remove('fade'); sub.classList.remove('fade');
  }

  function buttons(list) {
    controls.innerHTML = '';
    return new Promise((resolve) => {
      list.forEach((o, i) => {
        const b = document.createElement('button');
        b.className = o.link ? 'link' : 'btn' + (o.primary ? ' primary' : '');
        b.textContent = o.label; b.style.animationDelay = (i * 70) + 'ms';
        b.onclick = () => { controls.innerHTML = ''; resolve(o.value); };
        controls.appendChild(b);
      });
    });
  }

  function tapSymbol() {
    symbolsBox.classList.add('tappable');
    return new Promise((resolve) => {
      const onTap = (ev) => {
        const b = ev.target.closest('.sym');
        if (!b) return;
        symbolsBox.removeEventListener('click', onTap);
        symbolsBox.classList.remove('tappable');
        resolve(Number(b.dataset.pos));
      };
      symbolsBox.addEventListener('click', onTap);
    });
  }

  function stat(key) {
    try {
      const s = JSON.parse(localStorage.getItem('oracle-stats') || '{}');
      s[key] = (s[key] || 0) + 1;
      localStorage.setItem('oracle-stats', JSON.stringify(s));
    } catch (e) { /* stockage indisponible */ }
  }

  function showDebug(landing, answers) {
    if (!DEBUG) return;
    debugBox.hidden = false;
    let stats = '';
    try { stats = localStorage.getItem('oracle-stats') || ''; } catch (e) { /* */ }
    const post = landing == null ? [] : O.posterior(layout, landing, answers);
    debugBox.textContent = 'cercle : ' + layout.map((i) => O.SYMBOLS[i].name).join(' › ') + '\n\n' +
      post.slice(0, 5).map((x) => `${(100 * x.p).toFixed(1).padStart(5)} %  ${O.SYMBOLS[x.sym].name}`).join('\n') +
      (stats ? '\n\nstats ' + stats : '');
  }

  // ------------------------------------------------------------------ déroulé
  async function run() {
    stat('parties');
    showDebug(null, []);
    await caption('Choisis un symbole.', 'Dans ta tête. Ne le touche pas, ne le dis à personne.');
    await buttons([{ label: 'C\'est fait', value: 1, primary: true }]);

    await caption('Brouille les pistes.',
      'Épelle ton symbole en avançant <b>d\'une case par lettre</b>, dans le sens des aiguilles d\'une montre. <b>Touche la case où tu t\'arrêtes.</b><br><br>Exemple : L-I-O-N, c\'est 4 cases plus loin.');
    const landing = await tapSymbol();
    const landedSym = O.SYMBOLS[layout[landing]];
    els[landing].classList.add('landed');
    await caption(landedSym.name + '.', 'Ce n\'est pas ton symbole… mais c\'est par lui que je vais te trouver.');
    await sleep(1900);

    const answers = [];
    for (let k = 0; k < 3; k++) {
      const v = O.bestVision(layout, landing, answers);
      showDebug(landing, answers);
      if (!v) break;
      await caption(VISION_TEXT[v.attr], k === 0 ? 'Concentre-toi sur ton symbole.' : '');
      const yes = await buttons([{ label: 'Oui', value: true }, { label: 'Non', value: false }]);
      answers.push({ attr: v.attr, yes });
    }
    showDebug(landing, answers);
    const guess = O.posterior(layout, landing, answers)[0].sym;
    const guessPos = layout.indexOf(guess);

    // Révélation : tout disparaît sauf son symbole.
    await caption('Ton symbole…', '');
    els[landing].classList.remove('landed');
    ring.classList.add('hide');
    const order = els.map((_, i) => i).filter((i) => i !== guessPos).sort(() => Math.random() - 0.5);
    for (const i of order) { els[i].classList.add('gone'); await sleep(140); }
    await sleep(500);
    els[guessPos].classList.add('chosen');
    await sleep(900);
    const g = O.SYMBOLS[guess];
    await caption('…c\'est ' + g.art + '.', '');
    oracleText.textContent = READING[g.id];
    oracleText.classList.add('on');
    await sleep(1200);

    const r = await buttons([
      { label: 'Rejouer', value: 'again', primary: true },
      { label: 'Partager', value: 'share' },
      { label: 'Ce n\'était pas ça ?', value: 'miss', link: true },
    ]);
    if (r === 'miss') return miss(guess);
    stat('reussi');
    if (r === 'share') await share();
    location.reload();
  }

  async function share() {
    const data = { title: 'L\'Oracle', text: 'J\'ai choisi un symbole dans ma tête… et il l\'a trouvé. Essaie.', url: location.href.split('?')[0] };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); await caption('Lien copié.', 'Envoie-le à quelqu\'un.'); await sleep(1500); }
    } catch (e) { /* partage annulé */ }
  }

  async function miss(guess) {
    stat('rate');
    oracleText.classList.remove('on');
    ring.classList.remove('hide');
    els.forEach((e, pos) => { e.classList.remove('gone', 'chosen'); place(e, pos); });
    await caption('Lequel était-ce ?', 'Touche ton symbole.');
    const pos = await tapSymbol();
    if (layout[pos] === guess) { stat('reussi'); await caption('C\'est bien celui que j\'ai vu.', ''); }
    else await caption('Merci.', 'Même l\'oracle se trompe, parfois.');
    await buttons([{ label: 'Rejouer', value: 1, primary: true }]);
    location.reload();
  }

  run();
})();
