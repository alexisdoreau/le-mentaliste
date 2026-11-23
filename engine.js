/*
 * Moteur de déduction du « Mentaliste ».
 *
 * Principe : on part d'une poignée de prénoms candidats (ceux qui étaient à l'écran
 * quand la personne a dit « Je le vois »), pondérés par leur fréquence réelle (INSEE)
 * et par la compatibilité d'âge avec le joueur. Chaque « vision » est en réalité une
 * question choisie pour couper au mieux la liste (gain d'information maximal) :
 * sexe, âge relatif, présence d'une lettre. Calcul bayésien, rien de plus.
 *
 * Utilisable dans le navigateur (window.MentalisteEngine) et dans Node (simulation).
 */
(function (root) {
  'use strict';

  const CURRENT_YEAR = 2026;
  const CFG = {
    priorExponent: 0.7,   // adoucit l'écart entre prénoms très et peu fréquents
    singleThreshold: 0.8, // probabilité à partir de laquelle on révèle un seul prénom
    minQuestions: 2,      // pour garder la mise en scène, même si on est déjà sûr
    maxQuestions: 6,
    maxLetters: 4,
    minGainNarrative: 0.12, // gain minimal (bits) pour poser sexe / âge
    minGainLetter: 0.08,
    sameAgeWindow: 5,     // « à peu près mon âge » = ± 5 ans
    noise: { sex: 0.03, age: 0.1, letter: 0.05 },
    surpriseThreshold: 0.1, // une réponse qu'on n'attendait qu'à moins de 10 %…
    maxSurprises: 2,        // … deux fois : on passe au plan B
  };

  function norm(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  }

  // Probabilité relative de connaître quelqu'un né d years après soi (d < 0 : plus âgé).
  // Pairs (même âge), parents, enfants, grands-parents.
  function acquaintanceKernel(d) {
    return 0.15
      + Math.exp(-((d / 9) ** 2))
      + 0.6 * Math.exp(-(((d + 28) / 8) ** 2))
      + 0.45 * Math.exp(-(((d - 28) / 8) ** 2))
      + 0.25 * Math.exp(-(((d + 55) / 9) ** 2));
  }

  function entropy(p) {
    let h = 0;
    for (const x of p) if (x > 0) h -= x * Math.log2(x);
    return h;
  }

  function createDatabase(rows, meta) {
    const entries = rows.map((r) => {
      const s = r[3].reduce((a, b) => a + b, 0) || 1;
      return { name: r[0], key: norm(r[0]), male: r[1] / 100, weight: r[2], bins: r[3].map((v) => v / s), known: true };
    });
    // Distribution moyenne des naissances, pour les prénoms inconnus (plan B).
    const avg = new Array(meta.nBins).fill(0);
    let tot = 0;
    for (const e of entries) { e.bins.forEach((v, i) => { avg[i] += v * e.weight; }); tot += e.weight; }
    const avgBins = avg.map((v) => v / tot);
    const byKey = new Map();
    for (const e of entries) if (!byKey.has(e.key)) byKey.set(e.key, e);
    const medianWeight = entries.map((e) => e.weight).sort((a, b) => a - b)[Math.floor(entries.length / 2)];

    function lookup(typed) {
      const key = norm(typed);
      const found = byKey.get(key);
      if (found) return found;
      const pretty = String(typed).trim().replace(/\s+/g, ' ');
      return { name: pretty || typed, key, male: 0.5, weight: medianWeight, bins: avgBins, known: false };
    }
    return { entries, meta, lookup };
  }

  function Session(db, userAge, cfg) {
    this.db = db;
    this.meta = db.meta;
    this.cfg = Object.assign({}, CFG, cfg || {});
    this.userBirth = CURRENT_YEAR - userAge;
    this.cands = [];      // { entry, base }  base = indice écran × prior
    this.answers = [];    // { q, a }
    this.excluded = new Set();
    this.questionsAsked = 0;
    this.surprises = 0;   // réponses très improbables : la personne pense sans doute à un prénom hors de la zone
    this._ageCache = new Map();
  }

  // [pPlusAgé, pMêmeÂge, pPlusJeune] et compatibilité brute avec le joueur
  Session.prototype.ageProfile = function (entry) {
    if (this._ageCache.has(entry)) return this._ageCache.get(entry);
    const m = this.meta, u = this.userBirth, W = this.cfg.sameAgeWindow;
    const out = [0, 0, 0];
    let compat = 0;
    entry.bins.forEach((p, b) => {
      if (!p) return;
      for (let k = 0; k < m.binSize; k++) {
        const y = m.binStart + b * m.binSize + k;
        const d = y - u;
        const w = (p / m.binSize) * acquaintanceKernel(d);
        compat += w;
        out[d < -W ? 0 : d > W ? 2 : 1] += w;
      }
    });
    const s = out[0] + out[1] + out[2] || 1;
    const prof = { dist: [out[0] / s, out[1] / s, out[2] / s], compat };
    this._ageCache.set(entry, prof);
    return prof;
  };

  // Indices : [{ entry, w }] avec w = poids « écran » (visibilité, survol, toucher)
  Session.prototype.setCandidates = function (hints, opts) {
    const usePopularity = !(opts && opts.equalPrior);
    const byEntry = new Map();
    for (const h of hints) {
      if (this.excluded.has(h.entry.key)) continue;
      byEntry.set(h.entry, (byEntry.get(h.entry) || 0) + h.w);
    }
    this.cands = [];
    for (const [entry, w] of byEntry) {
      const pop = usePopularity ? Math.pow(entry.weight, this.cfg.priorExponent) : 1;
      const base = w * pop * this.ageProfile(entry).compat;
      if (base > 0) this.cands.push({ entry, base });
    }
  };

  Session.prototype.exclude = function (entry) { this.excluded.add(entry.key); this.cands = this.cands.filter((c) => c.entry.key !== entry.key); };

  Session.prototype.likelihood = function (entry, q, a) {
    const n = this.cfg.noise;
    if (q.type === 'sex') {
      const pm = entry.male;
      const pM = (1 - n.sex) * pm + n.sex * (1 - pm);
      return a === 'M' ? pM : 1 - pM;
    }
    if (q.type === 'age') {
      const dist = this.ageProfile(entry).dist;
      const idx = { older: 0, same: 1, younger: 2 }[a];
      return (1 - n.age) * dist[idx] + n.age / 3;
    }
    if (q.type === 'letter') {
      const has = entry.key.includes(q.letter);
      const yes = has ? 1 - n.letter : n.letter;
      return a === 'yes' ? yes : 1 - yes;
    }
    return 1;
  };

  Session.prototype.outcomes = function (q) {
    if (q.type === 'sex') return ['M', 'F'];
    if (q.type === 'age') return ['older', 'same', 'younger'];
    return ['yes', 'no'];
  };

  Session.prototype.posterior = function () {
    const w = this.cands.map((c) => {
      let v = c.base;
      for (const { q, a } of this.answers) v *= this.likelihood(c.entry, q, a);
      return v;
    });
    const s = w.reduce((x, y) => x + y, 0) || 1;
    return this.cands.map((c, i) => ({ entry: c.entry, p: w[i] / s })).sort((x, y) => y.p - x.p);
  };

  Session.prototype.gain = function (q, post) {
    const p = post.map((x) => x.p);
    const h0 = entropy(p);
    let eh = 0;
    let best = null, bestP = -1;
    for (const o of this.outcomes(q)) {
      const lw = post.map((x) => x.p * this.likelihood(x.entry, q, o));
      const po = lw.reduce((a, b) => a + b, 0);
      if (po > bestP) { bestP = po; best = o; }
      if (po > 0) eh += po * entropy(lw.map((v) => v / po));
    }
    return { gain: h0 - eh, likely: best };
  };

  Session.prototype.nextQuestion = function () {
    const post = this.posterior();
    if (post.length < 2) return null;
    const asked = (t) => this.answers.some((x) => x.q.type === t);
    const lettersAsked = this.answers.filter((x) => x.q.type === 'letter').map((x) => x.q.letter);
    const c = this.cfg;

    if (!asked('sex')) {
      const g = this.gain({ type: 'sex' }, post);
      if (g.gain >= c.minGainNarrative) return { type: 'sex', guess: g.likely, gain: g.gain };
    }
    if (!asked('age')) {
      const g = this.gain({ type: 'age' }, post);
      if (g.gain >= c.minGainNarrative) return { type: 'age', guess: g.likely, gain: g.gain };
    }
    if (lettersAsked.length < c.maxLetters) {
      let best = null;
      for (const L of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        if (lettersAsked.includes(L)) continue;
        const g = this.gain({ type: 'letter', letter: L }, post);
        if (!best || g.gain > best.gain) best = { type: 'letter', letter: L, gain: g.gain, likely: g.likely };
      }
      if (best && best.gain >= c.minGainLetter) return best;
    }
    // Sexe / âge peu informatifs au départ mais devenus utiles ?
    for (const t of ['sex', 'age']) {
      if (asked(t)) continue;
      const g = this.gain({ type: t }, post);
      if (g.gain >= c.minGainLetter) return { type: t, guess: g.likely, gain: g.gain };
    }
    return null;
  };

  Session.prototype.answer = function (q, a) {
    const post = this.posterior();
    const pa = post.reduce((sum, x) => sum + x.p * this.likelihood(x.entry, q, a), 0);
    if (post.length && pa < this.cfg.surpriseThreshold) this.surprises++;
    this.answers.push({ q, a });
    this.questionsAsked++;
  };

  // { kind: 'ask', question } | { kind: 'single', entry } | { kind: 'double', entries } | { kind: 'none' }
  Session.prototype.decide = function (opts) {
    const minQ = opts && opts.minQuestions != null ? opts.minQuestions : this.cfg.minQuestions;
    const post = this.posterior();
    if (!post.length) return { kind: 'none' };
    if (opts && opts.allowLost && this.surprises >= this.cfg.maxSurprises) return { kind: 'lost', post };
    const p1 = post[0].p, p2 = post[1] ? post[1].p : 0;
    const canAsk = this.questionsAsked < this.cfg.maxQuestions;
    const q = canAsk ? this.nextQuestion() : null;
    if (p1 >= this.cfg.singleThreshold && this.questionsAsked >= minQ) return { kind: 'single', entry: post[0].entry, post };
    if (q && (p1 < this.cfg.singleThreshold || this.questionsAsked < minQ)) return { kind: 'ask', question: q, post };
    if (p1 >= this.cfg.singleThreshold || !post[1]) return { kind: 'single', entry: post[0].entry, post };
    return { kind: 'double', entries: [post[0].entry, post[1].entry], post };
  };

  // Probabilité courante que la personne pensée soit un homme (pour accorder les phrases).
  Session.prototype.maleProbability = function () {
    const sexAns = this.answers.find((x) => x.q.type === 'sex');
    if (sexAns) return sexAns.a === 'M' ? 1 : 0;
    const post = this.posterior();
    return post.reduce((s, x) => s + x.p * x.entry.male, 0);
  };

  const api = { CFG, norm, createDatabase, Session, acquaintanceKernel, CURRENT_YEAR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MentalisteEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
