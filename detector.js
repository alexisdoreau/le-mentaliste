/*
 * Le détecteur de mensonge — moteur.
 *
 * La personne choisit un symbole parmi 12. Les symboles défilent un par un : « C'est lui ? »
 * Elle doit toujours répondre NON, même pour le sien, en essayant de tromper l'app.
 * Mentir sur son propre symbole coûte un petit temps de réaction en plus (conflit entre la
 * vraie réponse et la réponse imposée, effort pour « rester normal ») : c'est le principe du
 * Concealed Information Test des psychologues. On mesure chaque temps de réaction, on retire
 * l'effet d'entraînement (les premiers essais sont plus lents), et on cherche le symbole qui
 * ralentit la personne. En cas de doute : une seconde manche sur les suspects, puis une
 * « vision » (question oui/non sur un attribut) pour trancher.
 *
 * Dépend de oracle.js (liste des symboles et de leurs attributs).
 */
(function (root) {
  'use strict';

  const O = root.Oracle || (typeof require !== 'undefined' ? require('./oracle.js') : null);
  const N = O.SYMBOLS.length;

  const CFG = {
    effect: 1.2,          // écart supposé (en écarts-types) entre le symbole caché et les autres
    confessBonus: 6,      // a appuyé sur « Oui » : il s'est trahi
    revealThreshold: 0.85,
    round1Reps: 2,
    round2Suspects: 3,
    round2Fillers: 3,
    round2Reps: 2,
    maxVisions: 3,
  };

  function shuffle(a, rand) {
    const r = rand || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Ordre de passage : chaque symbole `reps` fois, jamais deux fois de suite le même.
  function makeSequence(syms, reps, rand) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const seq = shuffle([].concat(...Array.from({ length: reps }, () => syms.slice())), rand);
      if (seq.every((s, i) => i === 0 || s !== seq[i - 1])) return seq;
    }
    return shuffle([].concat(...Array.from({ length: reps }, () => syms.slice())), rand);
  }

  function median(a) { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  // trials : [{ sym, rt (ms), answer: 'non' | 'oui' }] dans l'ordre de passage.
  // Renvoie les écarts standardisés (z) de chaque essai, une fois l'entraînement retiré.
  function residuals(trials) {
    const pts = trials.map((t, i) => ({ i, sym: t.sym, y: Math.log(Math.min(3000, Math.max(200, t.rt))), oui: t.answer === 'oui' }));
    const use = pts.filter((p) => !p.oui);
    if (use.length < 4) return pts.map((p) => ({ sym: p.sym, z: 0, oui: p.oui }));
    // Tendance d'entraînement : décroissance rapide au début + pente légère (moindres carrés sur 3 bases).
    const basis = (i) => [1, Math.exp(-i / 4), i / trials.length];
    const X = use.map((p) => basis(p.i)), Y = use.map((p) => p.y);
    const beta = leastSquares(X, Y);
    const res = pts.map((p) => {
      const b = basis(p.i);
      return { sym: p.sym, r: p.y - (beta[0] * b[0] + beta[1] * b[1] + beta[2] * b[2]), oui: p.oui };
    });
    const rs = res.filter((p) => !p.oui).map((p) => p.r);
    const med = median(rs);
    const mad = median(rs.map((r) => Math.abs(r - med))) * 1.4826 || 0.15;
    return res.map((p) => ({ sym: p.sym, z: Math.max(-3, Math.min(4, (p.r - med) / mad)), oui: p.oui }));
  }

  function leastSquares(X, Y) {
    const k = X[0].length;
    const A = Array.from({ length: k }, () => new Array(k).fill(0)), b = new Array(k).fill(0);
    X.forEach((x, n) => { for (let i = 0; i < k; i++) { b[i] += x[i] * Y[n]; for (let j = 0; j < k; j++) A[i][j] += x[i] * x[j]; } });
    for (let i = 0; i < k; i++) A[i][i] += 1e-6;
    // Élimination de Gauss
    for (let c = 0; c < k; c++) {
      let p = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = c + 1; r < k; r++) { const f = A[r][c] / A[c][c]; for (let j = c; j < k; j++) A[r][j] -= f * A[c][j]; b[r] -= f * b[c]; }
    }
    const x = new Array(k).fill(0);
    for (let r = k - 1; r >= 0; r--) { let s = b[r]; for (let j = r + 1; j < k; j++) s -= A[r][j] * x[j]; x[r] = s / A[r][r]; }
    return x;
  }

  // Probabilité que chaque symbole soit le bon, d'après les temps de réaction et les visions.
  function posterior(trials, visions, cfg) {
    const c = Object.assign({}, CFG, cfg || {});
    const logL = new Array(N).fill(0);
    for (const t of residuals(trials)) {
      if (t.oui) { logL[t.sym] += c.confessBonus; continue; }
      logL[t.sym] += c.effect * t.z - c.effect * c.effect / 2;
    }
    for (const { attr, yes } of visions || []) {
      for (let i = 0; i < N; i++) {
        const py = 0.03 + 0.94 * O.SYMBOLS[i].attrs[attr];
        logL[i] += Math.log(yes ? py : 1 - py);
      }
    }
    const m = Math.max(...logL);
    const w = logL.map((v) => Math.exp(v - m));
    const s = w.reduce((a, b) => a + b, 0);
    return w.map((v, i) => ({ sym: i, p: v / s })).sort((a, b) => b.p - a.p);
  }

  function entropy(ps) { let h = 0; for (const p of ps) if (p > 0) h -= p * Math.log2(p); return h; }

  function bestVision(trials, visions, cfg) {
    const post = posterior(trials, visions, cfg);
    const asked = new Set((visions || []).map((v) => v.attr));
    let best = null;
    for (const attr of O.VISIONS) {
      if (asked.has(attr)) continue;
      let eh = 0;
      for (const yes of [true, false]) {
        const pa = post.reduce((s, x) => { const py = 0.03 + 0.94 * O.SYMBOLS[x.sym].attrs[attr]; return s + x.p * (yes ? py : 1 - py); }, 0);
        eh += pa * entropy(posterior(trials, (visions || []).concat([{ attr, yes }]), cfg).map((x) => x.p));
      }
      const gain = entropy(post.map((x) => x.p)) - eh;
      if (!best || gain > best.gain) best = { attr, gain };
    }
    return best && best.gain > 0.05 ? best : null;
  }

  // Seconde manche : les suspects + quelques autres pour comparer.
  function round2Symbols(trials, cfg, rand) {
    const c = Object.assign({}, CFG, cfg || {});
    const post = posterior(trials, [], c);
    const suspects = post.slice(0, c.round2Suspects).map((x) => x.sym);
    const others = shuffle(post.slice(c.round2Suspects).map((x) => x.sym), rand).slice(0, c.round2Fillers);
    return makeSequence(suspects.concat(others), c.round2Reps, rand);
  }

  // Petit profil pour l'affichage final : hésitation moyenne par symbole (z).
  function hesitationProfile(trials) {
    const sum = new Array(N).fill(0), cnt = new Array(N).fill(0);
    for (const t of residuals(trials)) { if (t.oui) { sum[t.sym] += 4; cnt[t.sym]++; continue; } sum[t.sym] += t.z; cnt[t.sym]++; }
    return sum.map((s, i) => (cnt[i] ? s / cnt[i] : 0));
  }

  const api = { CFG, makeSequence, residuals, posterior, bestVision, round2Symbols, hesitationProfile, shuffle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Detector = api;
})(typeof window !== 'undefined' ? window : globalThis);
