/* Le Mentaliste — mise en scène (chat, liste, révélations). Le calcul est dans engine.js. */
(function () {
  'use strict';

  const E = window.MentalisteEngine;
  const db = E.createDatabase(window.PRENOMS, window.PRENOMS_META);
  const DEBUG = new URLSearchParams(location.search).has('debug');
  const FAST = new URLSearchParams(location.search).has('fast'); // pour tester sans attendre

  const chat = document.getElementById('chat');
  const controls = document.getElementById('controls');
  const listView = document.getElementById('listView');
  const nameList = document.getElementById('nameList');
  const alphaIndex = document.getElementById('alphaIndex');
  const seeBtn = document.getElementById('seeBtn');
  const notInListBtn = document.getElementById('notInListBtn');
  const focusOverlay = document.getElementById('focusOverlay');
  const focusText = document.getElementById('focusText');
  const focusCount = document.getElementById('focusCount');
  const debugBox = document.getElementById('debug');

  const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 30) : ms));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------------------------------------------------------------- chat
  function scrollDown() { chat.scrollTop = chat.scrollHeight; }

  async function typing(ms) {
    const t = document.createElement('div');
    t.className = 'typing';
    t.innerHTML = '<i></i><i></i><i></i>';
    chat.appendChild(t); scrollDown();
    await sleep(ms);
    t.remove();
  }

  // Le mentaliste parle : temps de réflexion, puis les mots apparaissent un à un,
  // avec un vrai silence sur les « … » (les temps morts de la masterclass).
  async function say(text, opts) {
    const o = opts || {};
    await typing(o.think != null ? o.think : Math.min(1900, 650 + text.length * 14));
    const b = document.createElement('div');
    b.className = 'msg them';
    const words = text.split(/(\s+)/);
    const spans = [];
    for (const w of words) {
      if (/^\s+$/.test(w)) { b.appendChild(document.createTextNode(w)); continue; }
      const s = document.createElement('span');
      s.className = 'w'; s.textContent = w;
      b.appendChild(s); spans.push(s);
    }
    chat.appendChild(b); scrollDown();
    for (const s of spans) {
      s.classList.add('on');
      await sleep(/…$/.test(s.textContent) ? 650 : 55);
    }
    scrollDown();
    await sleep(o.after != null ? o.after : 250);
  }

  function me(text) {
    const b = document.createElement('div');
    b.className = 'msg me'; b.textContent = text;
    chat.appendChild(b); scrollDown();
  }

  function clearControls() { controls.innerHTML = ''; }

  function ask(options) {
    clearControls();
    return new Promise((resolve) => {
      options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn' + (opt.primary || (options.length === 1 && i === 0) ? ' primary' : '');
        btn.textContent = opt.label;
        btn.style.animationDelay = (i * 60) + 'ms';
        btn.addEventListener('click', () => {
          clearControls();
          if (!opt.silent) me(opt.echo || opt.label);
          resolve(opt.value !== undefined ? opt.value : opt.label);
        });
        controls.appendChild(btn);
      });
    });
  }

  function askText(placeholder, validate, inputMode) {
    clearControls();
    return new Promise((resolve) => {
      const f = document.createElement('form');
      f.className = 'field';
      const inp = document.createElement('input');
      inp.placeholder = placeholder; inp.autocomplete = 'off'; inp.maxLength = 40;
      if (inputMode) inp.inputMode = inputMode;
      const btn = document.createElement('button');
      btn.className = 'btn primary'; btn.type = 'submit'; btn.textContent = 'OK';
      f.append(inp, btn); controls.appendChild(f);
      setTimeout(() => inp.focus(), 50);
      const hint = document.createElement('p'); hint.className = 'hint';
      f.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const v = inp.value.trim();
        const err = validate ? validate(v) : (v ? null : '…');
        if (err) { hint.textContent = err; if (!hint.isConnected) controls.appendChild(hint); return; }
        clearControls(); me(v); resolve(v);
      });
    });
  }

  function askFive() {
    clearControls();
    return new Promise((resolve) => {
      const f = document.createElement('form');
      f.className = 'five';
      const inputs = [];
      for (let i = 0; i < 5; i++) {
        const inp = document.createElement('input');
        inp.placeholder = 'Prénom ' + (i + 1); inp.autocomplete = 'off'; inp.maxLength = 30;
        inputs.push(inp); f.appendChild(inp);
      }
      const hint = document.createElement('p'); hint.className = 'hint';
      hint.textContent = 'Un seul est vrai. Les 4 autres sont inventés.';
      const btn = document.createElement('button');
      btn.className = 'btn primary'; btn.type = 'submit'; btn.textContent = "C'est fait";
      f.append(hint, btn); controls.appendChild(f);
      setTimeout(() => inputs[0].focus(), 50);
      f.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const vals = inputs.map((x) => x.value.trim());
        const keys = vals.map(E.norm);
        if (vals.some((v) => !v)) { hint.textContent = 'Il me faut 5 prénoms.'; return; }
        if (new Set(keys).size < 5) { hint.textContent = 'Mets 5 prénoms différents.'; return; }
        clearControls(); me(vals.join(' · ')); resolve(vals);
      });
    });
  }

  // ---------------------------------------------------------------- liste
  let listBuilt = false;
  const items = [];
  function buildList() {
    if (listBuilt) return;
    listBuilt = true;
    let cur = '';
    const frag = document.createDocumentFragment();
    db.entries.forEach((e, i) => {
      const L = e.key[0];
      if (L !== cur) {
        cur = L;
        const h = document.createElement('div');
        h.className = 'sec'; h.textContent = L; h.id = 'sec-' + L;
        frag.appendChild(h);
        const a = document.createElement('span');
        a.textContent = L; a.dataset.l = L;
        alphaIndex.appendChild(a);
      }
      const d = document.createElement('div');
      d.className = 'nm'; d.textContent = e.name; d.dataset.i = i;
      frag.appendChild(d); items.push(d);
    });
    nameList.appendChild(frag);

    const jump = (L) => { const s = document.getElementById('sec-' + L); if (s) nameList.scrollTop = s.offsetTop - nameList.offsetTop; };
    alphaIndex.addEventListener('click', (ev) => { const L = ev.target.dataset && ev.target.dataset.l; if (L) jump(L); });
    alphaIndex.addEventListener('touchmove', (ev) => {
      const t = ev.touches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      if (el && el.dataset && el.dataset.l) jump(el.dataset.l);
      ev.preventDefault();
    }, { passive: false });
  }

  // Ce que la personne regarde, sans jamais cliquer : la zone affichée au moment
  // où elle dit « Je le vois », les arrêts prolongés, le survol (souris), les touchers.
  function visibleItems() {
    const r = nameList.getBoundingClientRect();
    const top = r.top + 34; // sous l'en-tête de lettre collant
    const out = [];
    for (const d of items) {
      const b = d.getBoundingClientRect();
      if (b.bottom <= top || b.top >= r.bottom) continue;
      const vis = Math.min(b.bottom, r.bottom) - Math.max(b.top, top);
      out.push({ i: Number(d.dataset.i), frac: Math.max(0, Math.min(1, vis / b.height)) });
    }
    return out;
  }

  function showList() {
    buildList();
    nameList.scrollTop = 0;
    listView.classList.remove('shuffle');
    items.forEach((d) => { d.style.transform = ''; d.style.transitionDelay = ''; });
    listView.hidden = false;

    const dwell = new Map();   // index -> ms survolé
    const touched = new Map(); // index -> nombre de touchers
    const pauses = [];         // { set, ms }
    let hovered = null, lastHoverT = 0, lastScrollT = performance.now(), pauseSnap = null, hasScrolled = false;

    const onMove = (ev) => {
      if (ev.pointerType !== 'mouse') return;
      const now = performance.now();
      if (hovered != null) dwell.set(hovered, (dwell.get(hovered) || 0) + (now - lastHoverT));
      const el = ev.target.closest && ev.target.closest('.nm');
      hovered = el ? Number(el.dataset.i) : null; lastHoverT = now;
    };
    const tick = setInterval(() => {
      const now = performance.now();
      if (hovered != null) { dwell.set(hovered, (dwell.get(hovered) || 0) + (now - lastHoverT)); lastHoverT = now; }
      // On ignore l'arrêt du début (la personne lit les consignes en haut de la liste).
      if (hasScrolled && now - lastScrollT > 1200 && !pauseSnap) pauseSnap = { set: visibleItems(), start: lastScrollT };
    }, 150);
    const onScroll = () => {
      const now = performance.now();
      if (pauseSnap) { pauses.push({ set: pauseSnap.set, ms: now - pauseSnap.start }); pauseSnap = null; }
      lastScrollT = now; hasScrolled = true;
    };
    let downAt = null;
    const onDown = (ev) => { if (ev.pointerType !== 'mouse') downAt = { x: ev.clientX, y: ev.clientY, el: ev.target.closest && ev.target.closest('.nm') }; };
    const onUp = (ev) => {
      if (!downAt || ev.pointerType === 'mouse') return;
      const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
      if (moved < 12 && downAt.el) { const i = Number(downAt.el.dataset.i); touched.set(i, (touched.get(i) || 0) + 1); }
      downAt = null;
    };
    nameList.addEventListener('pointermove', onMove);
    nameList.addEventListener('scroll', onScroll, { passive: true });
    nameList.addEventListener('pointerdown', onDown);
    nameList.addEventListener('pointerup', onUp);

    return new Promise((resolve) => {
      const cleanup = () => {
        clearInterval(tick);
        nameList.removeEventListener('pointermove', onMove);
        nameList.removeEventListener('scroll', onScroll);
        nameList.removeEventListener('pointerdown', onDown);
        nameList.removeEventListener('pointerup', onUp);
        seeBtn.onclick = null; notInListBtn.onclick = null;
      };
      seeBtn.onclick = async () => {
        const finalSet = visibleItems();
        cleanup();
        const w = new Map();
        for (const v of finalSet) w.set(v.i, v.frac);
        for (const p of pauses.slice(-3)) {
          if (p.ms < 1500) continue;
          for (const v of p.set) if (!w.has(v.i)) w.set(v.i, 0.3 * v.frac);
        }
        const totalDwell = [...dwell.values()].reduce((a, b) => a + b, 0);
        for (const [i, ms] of dwell) {
          if (ms < 250) continue;
          const boost = 1 + 3 * Math.min(1, ms / 1500) * (totalDwell ? ms / totalDwell : 0);
          w.set(i, (w.get(i) || 0.3) * boost);
        }
        for (const [i, n] of touched) w.set(i, (w.get(i) || 0.5) * (1 + 2 * Math.min(n, 2)));
        const hints = [...w].map(([i, x]) => ({ entry: db.entries[i], w: x }));

        // Mise en scène : on fixe, puis on « détruit » l'information.
        focusOverlay.hidden = false;
        focusText.textContent = 'Fixe son prénom… pense à cette personne.';
        for (let k = 3; k >= 1; k--) { focusCount.textContent = k; await sleep(1000); }
        focusCount.textContent = '';
        focusText.textContent = 'Je mélange tout.';
        const vis = visibleItems();
        vis.forEach(({ i }, n) => {
          const d = items[i];
          d.style.transitionDelay = (n * 35) + 'ms';
          d.style.transform = `translate(${(Math.random() - 0.5) * 260}px, ${(Math.random() - 0.5) * 340}px) rotate(${(Math.random() - 0.5) * 50}deg)`;
        });
        listView.classList.add('shuffle');
        await sleep(1500);
        focusOverlay.hidden = true;
        listView.hidden = true;
        resolve({ hints, notInList: false });
      };
      notInListBtn.onclick = () => { cleanup(); listView.hidden = true; resolve({ hints: [], notInList: true }); };
    });
  }

  // ---------------------------------------------------------------- phrases
  function g(session) {
    const pm = session.maleProbability();
    return pm > 0.85 ? 'M' : pm < 0.15 ? 'F' : null;
  }
  const W = (gd) => ({
    lui: gd === 'F' ? 'elle' : gd === 'M' ? 'lui' : 'cette personne',
    il: gd === 'F' ? 'elle' : gd === 'M' ? 'il' : 'cette personne',
    e: gd === 'F' ? 'e' : gd === 'M' ? '' : '(e)',
    le: gd === 'F' ? 'la' : gd === 'M' ? 'le' : 'la',
  });
  const HIT = ['C\'est bien ce que je sentais.', 'Oui… c\'est très net.', 'Je le savais.'];

  async function runQuestion(session, q, letterTurn) {
    const gd = g(session), w = W(gd);
    let a;
    if (q.type === 'sex') {
      if (q.guess === 'F') {
        await say('Je ressens… une présence plutôt féminine.');
        a = await ask([{ label: 'Oui', value: 'F' }, { label: "Non, c'est un homme", value: 'M' }]);
      } else {
        await say('Je ressens… une énergie plutôt masculine.');
        a = await ask([{ label: 'Oui', value: 'M' }, { label: "Non, c'est une femme", value: 'F' }]);
      }
      session.answer(q, a);
      if (a === q.guess) await say(a === 'F' ? 'Oui… Je la sens très nettement.' : 'Oui… Je le sens très nettement.');
      else if (a === 'F') await say('Pourtant il y a chez elle quelque chose de solide, de déterminé… C\'est ça que je captais. Une femme, donc.');
      else await say('Pourtant il y a chez lui beaucoup de douceur… C\'est ça que je captais. Un homme, donc.');
      return;
    }
    if (q.type === 'age') {
      const old = 'plus âgé' + w.e;
      if (q.guess === 'younger') {
        await say('J\'ai l\'impression que c\'est quelqu\'un… d\'assez jeune.');
        a = await ask([{ label: 'Oui, plus jeune que moi', value: 'younger' }, { label: 'Plutôt mon âge', value: 'same' }, { label: 'Non, ' + old + ' que moi', value: 'older' }]);
      } else if (q.guess === 'same') {
        await say('J\'ai l\'impression que c\'est quelqu\'un… de ta génération. Vous avez grandi avec les mêmes choses.');
        a = await ask([{ label: 'Oui, à peu près mon âge', value: 'same' }, { label: 'Non, plus jeune', value: 'younger' }, { label: 'Non, ' + old, value: 'older' }]);
      } else {
        await say('J\'ai l\'impression que c\'est quelqu\'un… de plus âgé que toi. Quelqu\'un qui a de l\'expérience.');
        a = await ask([{ label: 'Oui, ' + old + ' que moi', value: 'older' }, { label: 'Plutôt mon âge', value: 'same' }, { label: 'Non, plus jeune', value: 'younger' }]);
      }
      session.answer(q, a);
      const key = q.guess + '>' + a;
      const lines = {
        'younger>same': 'Jeune dans sa façon d\'être, alors… De ta génération, oui.',
        'younger>older': `Pas jeune au sens de l'âge… Je ${w.le} vois ${gd === 'M' ? 'tel' : 'telle'} que dans un de tes souvenirs. Plus âgé${w.e} que toi, oui.`,
        'same>younger': `Plus jeune… mais il y a chez ${w.lui} une maturité qui me trompait.`,
        'same>older': 'Plus âgé' + w.e + '… et pourtant, entre vous, il n\'y a presque pas de distance. C\'est ça que je sentais.',
        'older>same': 'De ton âge… mais avec une vraie expérience de la vie. C\'est ça que je captais.',
        'older>younger': `Plus jeune… et pourtant ${w.il} a quelque chose de sage. C'est ça que je captais.`,
      };
      await say(a === q.guess ? pick(HIT) : lines[key]);
      return;
    }
    // Lettre — en interro-négative une fois sur deux : juste quelle que soit la réponse.
    const L = q.letter;
    const accent = L === 'E' ? ' (même avec un accent)' : '';
    if (letterTurn % 2 === 0) {
      await say(`Attends… je vois une lettre. Un « ${L} ».`);
      await say(`Il n'y a pas de ${L} dans son prénom${accent}… si ?`, { think: 900 });
      a = await ask([{ label: 'Si, il y en a un', value: 'yes' }, { label: 'Non, pas de ' + L, value: 'no' }]);
      session.answer(q, a);
      await say(a === 'yes' ? `Je le savais. Ce « ${L} » était très net.` : `C'est bien ce que je pensais. Ce « ${L} » est autour de ${w.lui}, pas dans son prénom.`);
    } else {
      await say(`Je vois des lettres qui flottent… Un « ${L} », il me semble.`);
      await say(`Il y a un ${L} dans son prénom${accent}, n'est-ce pas ?`, { think: 900 });
      a = await ask([{ label: 'Oui', value: 'yes' }, { label: 'Non', value: 'no' }]);
      session.answer(q, a);
      await say(a === 'yes' ? 'Oui. Je le voyais briller.' : `Alors ce « ${L} » appartient à quelqu'un de son entourage. Ça m'aide quand même.`);
    }
  }

  async function revealName(name) {
    const box = document.createElement('div');
    box.className = 'reveal';
    const big = document.createElement('div'); big.className = 'big';
    const spans = [...name].map((ch) => { const s = document.createElement('span'); s.textContent = ch === ' ' ? ' ' : ch; big.appendChild(s); return s; });
    box.appendChild(big); chat.appendChild(box); scrollDown();
    await sleep(500);
    for (const s of spans) { s.classList.add('on'); await sleep(230); }
    await sleep(600);
  }

  function revealDouble(a, b) {
    const box = document.createElement('div');
    box.className = 'reveal';
    const big1 = document.createElement('div'); big1.className = 'big';
    const or = document.createElement('span'); or.className = 'or'; or.textContent = '… ou …';
    const big2 = document.createElement('div'); big2.className = 'big';
    [[big1, a], [big2, b]].forEach(([el, n]) => [...n].forEach((ch) => { const s = document.createElement('span'); s.textContent = ch; s.className = 'on'; el.appendChild(s); }));
    box.append(big1, or, big2); chat.appendChild(box); scrollDown();
  }

  // ---------------------------------------------------------------- lecture
  // Retourne l'entrée trouvée (et confirmée) ou null.
  async function reading(session, opts) {
    let letterTurn = 0, attempts = 0;
    let minQ = opts.minQuestions;
    for (;;) {
      const d = session.decide({ minQuestions: minQ, allowLost: opts.allowLost });
      showDebug(session, d);
      if (d.kind === 'ask') {
        await runQuestion(session, d.question, d.question.type === 'letter' ? letterTurn++ : letterTurn);
        continue;
      }
      if (d.kind === 'none' || d.kind === 'lost') return null;
      attempts++;
      if (d.kind === 'single') {
        await say(attempts === 1 ? 'Je crois que je l\'ai.' : 'Attends… Je me suis laissé distraire. Il y a un autre prénom, derrière.', { after: 500 });
        await say('Je vois son prénom se former…', { after: 300 });
        await revealName(d.entry.name);
        const ok = await ask([{ label: 'Oui ! C\'est ça', value: true, primary: true }, { label: 'Non', value: false }]);
        if (ok) return d.entry;
        session.exclude(d.entry);
      } else {
        const [a, b] = d.entries;
        await say('J\'hésite entre deux prénoms… Ils sont très proches dans ma tête.', { after: 400 });
        revealDouble(a.name, b.name);
        await sleep(700);
        const r = await ask([{ label: 'C\'est ' + a.name, value: a, primary: true }, { label: 'C\'est ' + b.name, value: b, primary: true }, { label: 'Aucun des deux', value: null }]);
        if (r) {
          const other = r === a ? b : a;
          await say(`${r.name}… Oui. Et ${other.name}, c'est peut-être quelqu'un de son entourage.`);
          return r;
        }
        session.exclude(a); session.exclude(b);
      }
      if (attempts >= opts.maxAttempts || !session.cands.length) return null;
      minQ = 0;
    }
  }

  function recapLine(session, entry) {
    const parts = [];
    for (const { q, a } of session.answers) {
      if (q.type === 'sex') parts.push(a === 'F' ? 'une femme' : 'un homme');
      if (q.type === 'age') {
        const sexAns = session.answers.find((x) => x.q.type === 'sex');
        const fem = sexAns ? sexAns.a === 'F' : entry.male < 0.5;
        parts.push(a === 'younger' ? 'plus jeune que toi' : a === 'same' ? 'de ta génération' : 'plus âgé' + (fem ? 'e' : '') + ' que toi');
      }
      if (q.type === 'letter' && a === 'yes') parts.push(`un « ${q.letter} » dans son prénom`);
    }
    return parts;
  }

  function stat(key) {
    try {
      const s = JSON.parse(localStorage.getItem('mentaliste-stats') || '{}');
      s[key] = (s[key] || 0) + 1;
      localStorage.setItem('mentaliste-stats', JSON.stringify(s));
    } catch (e) { /* stockage indisponible */ }
  }

  function showDebug(session, d) {
    if (!DEBUG) return;
    debugBox.hidden = false;
    const post = session.posterior().slice(0, 12);
    let stats = '';
    try { stats = localStorage.getItem('mentaliste-stats') || ''; } catch (e) { /* */ }
    debugBox.textContent =
      `candidats : ${session.cands.length}\nquestions : ${session.questionsAsked}\nprochain : ${d.kind}${d.question ? ' ' + d.question.type + (d.question.letter || '') : ''}\n\n` +
      post.map((x) => `${(100 * x.p).toFixed(1).padStart(5)} %  ${x.entry.name}`).join('\n') +
      (stats ? `\n\nstats ${stats}` : '');
  }

  async function finale(session, entry) {
    const sexAns = session.answers.find((x) => x.q.type === 'sex');
    const male = sexAns ? sexAns.a === 'M' : entry.male >= 0.5;
    const lui = male ? 'lui' : 'elle';
    const parts = recapLine(session, entry);
    if (parts.length) await say(`J'ai senti ${parts.join(', ')}… et c'était ${entry.name}.`);
    await say(`Tu as pensé à ${lui} pendant plusieurs minutes. Ce n'est pas un hasard si c'est ${lui} qui t'est venu${male ? '' : 'e'} en premier.`);
    await say('Et si tu lui envoyais un message aujourd\'hui ?');
    endButtons();
  }

  function endButtons() {
    clearControls();
    const again = document.createElement('button');
    again.className = 'btn primary'; again.textContent = 'Rejouer';
    again.onclick = () => location.reload();
    controls.appendChild(again);
    const share = document.createElement('button');
    share.className = 'btn'; share.textContent = 'Partager';
    share.onclick = async () => {
      const data = { title: 'Le Mentaliste', text: 'Ce site a deviné le prénom de la personne à qui je pensais. Essaie.', url: location.href.split('?')[0] };
      try {
        if (navigator.share) await navigator.share(data);
        else { await navigator.clipboard.writeText(data.url); share.textContent = 'Lien copié'; }
      } catch (e) { /* partage annulé */ }
    };
    controls.appendChild(share);
  }

  async function planB(age, previous, fromMiss) {
    stat('planB');
    if (fromMiss) await say('Le signal était brouillé… Laisse-moi une seconde chance. Autrement.');
    else await say('Pas de problème. On va faire autrement.');
    await say('Écris son prénom, caché au milieu de 4 faux prénoms que tu inventes.');
    await say('Pour me piéger, mélange les hommes et les femmes, les jeunes et les vieux.');
    const names = await askFive();
    const s = new E.Session(db, age);
    if (previous) {
      s.answers = previous.answers.slice();
      previous.excluded.forEach((k) => s.excluded.add(k));
    }
    const typed = names.map((n) => ({ entry: db.lookup(n), w: 1 }));
    s.setCandidates(typed, { equalPrior: true });
    if (!s.cands.length) { s.excluded.clear(); s.setCandidates(typed, { equalPrior: true }); }
    await say(previous && previous.answers.length ? 'Je garde ce que j\'ai déjà ressenti…' : 'Concentre-toi sur le vrai.');
    const found = await reading(s, { minQuestions: previous && previous.answers.length ? 0 : 2, maxAttempts: 2 });
    if (found) { stat('trouvePlanB'); return finale(s, found); }
    stat('rate');
    await say('Je me suis trompé… Ça arrive, même aux meilleurs.');
    await say('À qui pensais-tu ?');
    const real = await askText('Son prénom');
    await say(`${real}… Je m'en souviendrai. La prochaine fois, je ne te raterai pas.`);
    endButtons();
  }

  // ---------------------------------------------------------------- déroulé
  async function run() {
    stat('parties');
    await say('Bonsoir.', { think: 900 });
    await say('Je vais essayer de lire dans tes pensées. Pas de caméra, pas de micro. Juste toi… et ta concentration.');
    await say('Comment tu t\'appelles ?');
    const userName = await askText('Ton prénom');
    await say(`Enchanté, ${userName}. Et quel âge as-tu ?`);
    const ageStr = await askText('Ton âge', (v) => (/^\d{1,2}$/.test(v) && +v >= 8 && +v <= 99 ? null : 'Juste ton âge, en chiffres.'), 'numeric');
    const age = Number(ageStr);
    await say('Merci. Maintenant, pense à quelqu\'un que tu connais bien.');
    await say('Un ami, quelqu\'un de ta famille, un collègue… N\'importe qui, mais une vraie personne.');
    await say('Visualise son visage… Entends sa voix…');
    await ask([{ label: 'J\'y pense', value: 1 }]);
    await say('Je vais te montrer une liste de prénoms. Retrouve le sien.');
    await say('Quand son prénom est à l\'écran, arrête-toi. Fixe-le quelques secondes en pensant très fort à cette personne… puis appuie sur « Je le vois ».');
    await say('Surtout, ne clique pas sur son prénom. Je ne veux pas savoir lequel c\'est.');
    await ask([{ label: 'Montre-moi la liste', value: 1 }]);
    const res = await showList();
    if (res.notInList) return planB(age, null, false);

    await say('Merci. J\'ai tout mélangé : même moi, je ne pourrais plus dire où tu t\'es arrêté.');
    await say('Garde cette personne en tête. Je vais te dire ce que je ressens. Dis-moi simplement si ça résonne.');
    const s = new E.Session(db, age);
    s.setCandidates(res.hints);
    const found = await reading(s, { minQuestions: 2, maxAttempts: 2, allowLost: true });
    if (found) { stat('trouve'); return finale(s, found); }
    return planB(age, s, true);
  }

  run();
})();
