/* Le Mentaliste — choisis une carte. */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const DEBUG = params.has('debug');
  const FAST = params.has('fast');

  const $ = (id) => document.getElementById(id);
  const title = $('title'), sub = $('sub'), stage = $('stage'), controls = $('controls'), debugBox = $('debug');
  const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 40) : ms));
  const frame = () => new Promise((r) => {
    let done = false; const go = () => { if (!done) { done = true; r(); } };
    requestAnimationFrame(() => requestAnimationFrame(go)); setTimeout(go, 60);
  });
  const rnd = (a, b) => a + Math.random() * (b - a);
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ------------------------------------------------------------------ les cartes
  const RED = '#b1222b', BLACK = '#1d1b22';
  const RANK_NAME = { R: 'Roi', D: 'Dame', V: 'Valet' };
  const SUIT_NAME = { pique: 'pique', coeur: 'cœur', carreau: 'carreau', trefle: 'trèfle' };
  const REDS = ['coeur', 'carreau'], BLACKS = ['pique', 'trefle'];
  const isRed = (s) => REDS.includes(s);
  const cardName = (c) => `${RANK_NAME[c.rank]} de ${SUIT_NAME[c.suit]}`;

  const SUIT_SHAPES = {
    coeur: '<path d="M5 9.3C1.6 6.6 0 4.6 0 2.8 0 1.2 1.2 0 2.7 0c1 0 1.8.5 2.3 1.4C5.5.5 6.3 0 7.3 0 8.8 0 10 1.2 10 2.8c0 1.8-1.6 3.8-5 6.5z"/>',
    carreau: '<path d="M5 0l4 5-4 5-4-5z"/>',
    pique: '<path d="M5 0C3.4 2.2 0 3.9 0 6.4 0 7.8 1.1 8.9 2.5 8.9c.9 0 1.7-.4 2.1-1.1-.1 1-.5 1.7-1.3 2.2h3.4c-.8-.5-1.2-1.2-1.3-2.2.4.7 1.2 1.1 2.1 1.1 1.4 0 2.5-1.1 2.5-2.5C10 3.9 6.6 2.2 5 0z"/>',
    trefle: '<circle cx="5" cy="2.6" r="2.4"/><circle cx="2.5" cy="6.1" r="2.4"/><circle cx="7.5" cy="6.1" r="2.4"/><path d="M4.3 6h1.4c0 1.8.4 3 1.4 4H2.9c1-1 1.4-2.2 1.4-4z"/>',
  };

  // Demi-figure (moitié haute) ; la moitié basse est la même, retournée.
  const FIGURES = {
    R: (c) => `<path d="M39 33 37 22l7 6 6-9 6 9 7-6-2 11z" fill="${c}" fill-opacity=".18"/>
      <ellipse cx="50" cy="41.5" rx="7" ry="7.5"/>
      <path d="M43.5 44.5Q50 58 56.5 44.5M28 66q2-12 14-14.5M58 51.5q12 2.5 14 14.5M42 51.5l8 8 8-8M47 40.3h.6M52.4 40.3h.6"/>`,
    D: (c) => `<path d="M41 33Q50 21 59 33z" fill="${c}" fill-opacity=".18"/>
      <circle cx="50" cy="25.5" r="1.6" fill="${c}"/>
      <ellipse cx="50" cy="40.5" rx="6.5" ry="7.5"/>
      <path d="M43.5 37Q41 50 35 56M56.5 37Q59 50 65 56M44 50.5Q50 56 56 50.5M28 66q3-11 13-13M59 53q10 2 13 13M37.5 63.2V67M47.3 39.5h.6M52.1 39.5h.6"/>
      <circle cx="37.5" cy="61" r="2.2" fill="${c}" fill-opacity=".25"/>`,
    V: (c) => `<path d="M37 31h26l-4-6q-9-5-18 0z" fill="${c}" fill-opacity=".18"/>
      <path d="M59 25q8-10 15-7-7 3-13 9"/>
      <ellipse cx="50" cy="39.5" rx="6.5" ry="7.5"/>
      <path d="M43.5 36q-1.5 8 .5 11M56.5 36q1.5 8-.5 11M42 50l8 5 8-5M28 66q3-11 14-16M58 50q11 5 14 16M47.3 38.6h.6M52.1 38.6h.6"/>`,
  };

  function cardSVG(c) {
    const col = isRed(c.suit) ? RED : BLACK;
    const suit = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${SUIT_SHAPES[c.suit]}</g>`;
    const corner = `<text x="9" y="17.5" text-anchor="middle" font-size="15" font-weight="700" font-family="Georgia, 'Times New Roman', serif">${c.rank}</text>${suit(4.6, 21, 0.88)}`;
    const half = `<g fill="none" stroke="${col}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${FIGURES[c.rank](col)}</g>${suit(20, 19, 1.1)}`;
    return `<svg viewBox="0 0 100 140" aria-hidden="true">
      <rect x=".5" y=".5" width="99" height="139" rx="8" fill="#f5efe2"/>
      <rect x="15.5" y="15.5" width="69" height="109" rx="3" fill="${col}" fill-opacity=".04" stroke="${col}" stroke-opacity=".35"/>
      <g fill="${col}">${corner}<g transform="rotate(180 50 70)">${corner}</g></g>
      <g fill="${col}">${half}<g transform="rotate(180 50 70)">${half}</g></g>
      <path d="M16 76 84 64" stroke="${col}" stroke-opacity=".3"/>
    </svg>`;
  }

  // Les six cartes posées sur la table, et le paquet d'où elles viennent.
  function newDeal() {
    const first = [], second = [];
    const reds = shuffle([true, true, false]);
    if (Math.random() < 0.5) reds.forEach((v, i) => { reds[i] = !v; });
    ['R', 'D', 'V'].forEach((rank, i) => {
      (reds[i] ? REDS : BLACKS).forEach((suit) => first.push({ rank, suit }));
      (reds[i] ? BLACKS : REDS).forEach((suit) => second.push({ rank, suit }));
    });
    const redCount = second.filter((c) => isRed(c.suit)).length;
    const pool = second.filter((c) => isRed(c.suit) === (redCount > 3));
    second.splice(second.indexOf(pool[Math.floor(Math.random() * pool.length)]), 1);
    return { first: shuffle(first), second: shuffle(second) };
  }

  const GRID6 = [[18, 28], [50, 28], [82, 28], [18, 72], [50, 72], [82, 72]];
  const GRID5 = [[18, 28], [50, 28], [82, 28], [34, 72], [66, 72]];

  function makeCard() {
    const el = document.createElement('div');
    el.className = 'card down instant';
    el.innerHTML = '<div class="inner"><div class="face front"></div><div class="face back"></div></div>';
    stage.appendChild(el);
    return el;
  }
  function setFace(el, c) {
    el.querySelector('.front').innerHTML = c ? cardSVG(c) : '';
    if (c) el.setAttribute('aria-label', cardName(c)); else el.removeAttribute('aria-label');
  }
  function moveTo(el, x, y, r) {
    el.style.left = x + '%'; el.style.top = y + '%';
    el.style.setProperty('--r', (r || 0) + 'deg');
  }
  const stack = (el) => moveTo(el, 50 + rnd(-1.5, 1.5), 50 + rnd(-1.5, 1.5), rnd(-4, 4));

  // ------------------------------------------------------------------ outils
  async function caption(t, s) {
    title.classList.add('fade'); sub.classList.add('fade');
    await sleep(260);
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

  function stat(key) {
    try {
      const s = JSON.parse(localStorage.getItem('arrachee-stats') || '{}');
      s[key] = (s[key] || 0) + 1;
      localStorage.setItem('arrachee-stats', JSON.stringify(s));
    } catch (e) { /* stockage indisponible */ }
  }

  function showDebug(deal) {
    if (!DEBUG) return;
    debugBox.hidden = false;
    let stats = '';
    try { stats = localStorage.getItem('arrachee-stats') || ''; } catch (e) { /* */ }
    debugBox.textContent = 'table :\n  ' + deal.first.map(cardName).join('\n  ') +
      '\n\nensuite :\n  ' + deal.second.map(cardName).join('\n  ') + (stats ? '\n\nstats ' + stats : '');
  }

  function scan() {
    const s = document.createElement('div'); s.className = 'scan';
    stage.appendChild(s);
    setTimeout(() => s.remove(), 2700);
  }

  async function shuffleStack(cards) {
    cards.forEach((el) => el.classList.add('quick'));
    for (let k = 0; k < 3; k++) {
      cards.forEach((el, i) => moveTo(el, i % 2 ? 67 : 33, 50 + rnd(-1.5, 1.5), i % 2 ? 7 : -7));
      await sleep(290);
      shuffle(cards.slice()).forEach((el, i) => { el.style.zIndex = i; });
      cards.forEach(stack);
      await sleep(310);
    }
    cards.forEach((el) => el.classList.remove('quick'));
  }

  async function burn(el) {
    const x = parseFloat(el.style.left), y = parseFloat(el.style.top);
    el.classList.add('burning');
    for (let i = 0; i < 24; i++) {
      const e = document.createElement('i'); e.className = 'ember';
      e.style.setProperty('--x', (x + rnd(-10, 10)) + '%');
      e.style.setProperty('--y', (y + rnd(-14, 6)) + '%');
      e.style.setProperty('--dx', rnd(-110, 110).toFixed(0) + 'px');
      e.style.setProperty('--dy', rnd(-210, -30).toFixed(0) + 'px');
      e.style.setProperty('--d', rnd(0, 0.35).toFixed(2) + 's');
      stage.appendChild(e);
      setTimeout(() => e.remove(), 1800);
    }
    await sleep(1150);
    el.hidden = true;
  }

  // ------------------------------------------------------------------ déroulé
  async function run() {
    stat('parties');
    const deal = newDeal();
    showDebug(deal);

    const cards = deal.first.map((c, i) => { const el = makeCard(); setFace(el, c); stack(el); el.style.zIndex = i; return el; });
    await frame();
    cards.forEach((el) => el.classList.remove('instant'));
    await sleep(250);
    for (let i = 0; i < cards.length; i++) { moveTo(cards[i], GRID6[i][0], GRID6[i][1]); await sleep(90); }
    await sleep(420);
    for (const el of cards) { el.classList.remove('down'); await sleep(85); }

    await caption('Choisis une carte.', 'Dans ta tête. Ne touche à rien.<br>Retiens-la bien.');
    await buttons([{ label: 'C\'est fait', value: 1, primary: true }]);

    await caption('Fixe-la.', 'Rien qu\'elle. Quelques secondes.');
    scan();
    await sleep(2700);

    await caption('Je la cherche…', '');
    for (const el of shuffle(cards.slice())) { el.classList.add('down'); await sleep(110); }
    await sleep(520);
    cards.forEach(stack);
    await sleep(600);

    // Le paquet se mélange ; les visages changent de place.
    const order = shuffle(cards.slice());
    order.forEach((el, i) => { el.style.zIndex = i; });
    const leaving = order[order.length - 1], staying = order.slice(0, -1);
    staying.forEach((el, i) => setFace(el, deal.second[i]));
    setFace(leaving, null);

    await caption('Je vois un visage…', 'Quelqu\'un qui te regarde, toi aussi.');
    await shuffleStack(cards);
    leaving.style.zIndex = 99;
    await sleep(500);

    await caption('Je l\'ai.', '');
    await sleep(350);
    await burn(leaving);

    staying.forEach((el, i) => moveTo(el, GRID5[i][0], GRID5[i][1]));
    await sleep(650);
    for (const el of staying) { el.classList.remove('down'); await sleep(140); }

    await caption('Cherche ta carte.', '');
    await sleep(2300);
    await caption('Elle n\'est plus là.', 'Je te l\'ai arrachée.');
    stat('fin');
    await sleep(900);
    return after(staying);
  }

  async function after(staying) {
    for (;;) {
      const r = await buttons([
        { label: 'Rejouer', value: 'again', primary: true },
        { label: 'Partager', value: 'share' },
        { label: 'Elle est encore là ?', value: 'miss', link: true },
      ]);
      if (r === 'again') { location.reload(); return; }
      if (r === 'share') { await share(); continue; }
      if (r === 'miss') return miss(staying);
    }
  }

  async function share() {
    const data = { title: 'Le Mentaliste', text: 'Choisis une carte dans ta tête. Il te l\'arrache.', url: location.href.split('?')[0] };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); await caption('Lien copié.', 'Envoie-le à quelqu\'un.'); await sleep(1500); await caption('Elle n\'est plus là.', 'Je te l\'ai arrachée.'); }
    } catch (e) { /* partage annulé */ }
  }

  async function miss(staying) {
    await caption('Laquelle ?', 'Touche-la.');
    stage.classList.add('tappable');
    await new Promise((resolve) => {
      stage.addEventListener('click', function onTap(ev) {
        const b = ev.target.closest('.card'); if (!b || !staying.includes(b)) return;
        stage.removeEventListener('click', onTap); resolve();
      });
    });
    stage.classList.remove('tappable');
    stat('rate');
    await caption('Alors tu m\'as eu.', 'C\'est rare. Une revanche ?');
    await buttons([{ label: 'Rejouer', value: 1, primary: true }]);
    location.reload();
  }

  run();
})();
