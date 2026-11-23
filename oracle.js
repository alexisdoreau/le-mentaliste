/*
 * L'Oracle des 12 symboles — moteur.
 *
 * La personne choisit mentalement un symbole sur un cercle de 12, puis « brouille les pistes » :
 * elle épelle son symbole en avançant d'une case par lettre (sens des aiguilles d'une montre)
 * et touche la case d'arrivée. Le cercle est disposé pour que chaque point de départ mène à une
 * case d'arrivée différente : la case touchée trahit donc le symbole pensé.
 * Les erreurs de comptage courantes (compter sa propre case, sens inverse, une case de trop)
 * sont prises en compte ; s'il reste un doute, une « vision » (lumière ? vivant ? …) tranche.
 */
(function (root) {
  'use strict';

  // attrs : 1 = oui, 0 = non, entre les deux = discutable (la personne peut répondre l'un ou l'autre)
  const SYMBOLS = [
    { id: 'lune', name: 'Lune', art: 'la Lune', word: 'LUNE', attrs: { lumiere: 0.6, vivant: 0, objet: 0, ciel: 1, eau: 0, nuit: 1, chaud: 0, animal: 0, verre: 0, ailes: 0 } },
    { id: 'chat', name: 'Chat', art: 'le Chat', word: 'CHAT', attrs: { lumiere: 0, vivant: 1, objet: 0, ciel: 0, eau: 0, nuit: 0.3, chaud: 0.3, animal: 1, verre: 0, ailes: 0 } },
    { id: 'arbre', name: 'Arbre', art: "l'Arbre", word: 'ARBRE', attrs: { lumiere: 0, vivant: 1, objet: 0, ciel: 0, eau: 0, nuit: 0, chaud: 0, animal: 0, verre: 0, ailes: 0 } },
    { id: 'vague', name: 'Vague', art: 'la Vague', word: 'VAGUE', attrs: { lumiere: 0, vivant: 0.1, objet: 0, ciel: 0, eau: 1, nuit: 0, chaud: 0, animal: 0, verre: 0, ailes: 0 } },
    { id: 'soleil', name: 'Soleil', art: 'le Soleil', word: 'SOLEIL', attrs: { lumiere: 1, vivant: 0, objet: 0, ciel: 1, eau: 0, nuit: 0, chaud: 1, animal: 0, verre: 0, ailes: 0 } },
    { id: 'bougie', name: 'Bougie', art: 'la Bougie', word: 'BOUGIE', attrs: { lumiere: 1, vivant: 0, objet: 1, ciel: 0, eau: 0, nuit: 0.6, chaud: 1, animal: 0, verre: 0, ailes: 0 } },
    { id: 'etoile', name: 'Étoile', art: "l'Étoile", word: 'ETOILE', attrs: { lumiere: 1, vivant: 0, objet: 0, ciel: 1, eau: 0, nuit: 1, chaud: 0.2, animal: 0, verre: 0, ailes: 0 } },
    { id: 'miroir', name: 'Miroir', art: 'le Miroir', word: 'MIROIR', attrs: { lumiere: 0.3, vivant: 0, objet: 1, ciel: 0, eau: 0, nuit: 0, chaud: 0, animal: 0, verre: 1, ailes: 0 } },
    { id: 'sablier', name: 'Sablier', art: 'le Sablier', word: 'SABLIER', attrs: { lumiere: 0, vivant: 0, objet: 1, ciel: 0, eau: 0, nuit: 0, chaud: 0, animal: 0, verre: 0.9, ailes: 0 } },
    { id: 'serpent', name: 'Serpent', art: 'le Serpent', word: 'SERPENT', attrs: { lumiere: 0, vivant: 1, objet: 0, ciel: 0, eau: 0, nuit: 0, chaud: 0, animal: 1, verre: 0, ailes: 0 } },
    { id: 'couronne', name: 'Couronne', art: 'la Couronne', word: 'COURONNE', attrs: { lumiere: 0.1, vivant: 0, objet: 1, ciel: 0, eau: 0, nuit: 0, chaud: 0, animal: 0, verre: 0, ailes: 0 } },
    { id: 'papillon', name: 'Papillon', art: 'le Papillon', word: 'PAPILLON', attrs: { lumiere: 0, vivant: 1, objet: 0, ciel: 0.3, eau: 0, nuit: 0, chaud: 0, animal: 0.9, verre: 0, ailes: 1 } },
  ];
  const N = SYMBOLS.length;

  // Façons de compter, avec leur fréquence supposée (à affiner avec de vrais tests).
  const MODES = [
    { id: 'juste', shift: (p, L) => p + L, w: 0.8 },
    { id: 'compte-sa-case', shift: (p, L) => p + L - 1, w: 0.12 },
    { id: 'une-de-trop', shift: (p, L) => p + L + 1, w: 0.04 },
    { id: 'sens-inverse', shift: (p, L) => p - L, w: 0.04 },
  ];
  const mod = (x) => ((x % N) + N) % N;

  // Questions « vision » possibles.
  const VISIONS = ['lumiere', 'vivant', 'objet', 'ciel', 'eau', 'nuit', 'chaud', 'animal', 'verre', 'ailes'];

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // Disposition : layout[pos] = indice du symbole. Contrainte : (pos + longueur) mod 12 tous différents.
  function randomLayout(rand) {
    const order = SYMBOLS.map((_, i) => i);
    const layout = new Array(N).fill(-1), usedSym = new Array(N).fill(false), usedLand = new Array(N).fill(false);
    function place(pos) {
      if (pos === N) return true;
      const cand = order.slice().sort(() => rand() - 0.5);
      for (const i of cand) {
        if (usedSym[i]) continue;
        const land = mod(pos + SYMBOLS[i].word.length);
        if (usedLand[land]) continue;
        usedSym[i] = usedLand[land] = true; layout[pos] = i;
        if (place(pos + 1)) return true;
        usedSym[i] = usedLand[land] = false; layout[pos] = -1;
      }
      return false;
    }
    return place(0) ? layout : null;
  }

  // Probabilité de chaque symbole pensé, sachant la case touchée.
  function posterior(layout, landing, answers) {
    const w = new Array(N).fill(0);
    layout.forEach((sym, pos) => {
      const L = SYMBOLS[sym].word.length;
      for (const m of MODES) if (mod(m.shift(pos, L)) === landing) w[sym] += m.w;
    });
    for (let i = 0; i < N; i++) {
      w[i] += 0.002; // erreur quelconque
      for (const { attr, yes } of answers || []) {
        const a = SYMBOLS[i].attrs[attr];
        const pYes = 0.03 + 0.94 * a;
        w[i] *= yes ? pYes : 1 - pYes;
      }
    }
    const s = w.reduce((x, y) => x + y, 0);
    return w.map((v, i) => ({ sym: i, p: v / s })).sort((a, b) => b.p - a.p);
  }

  function entropy(ps) { let h = 0; for (const p of ps) if (p > 0) h -= p * Math.log2(p); return h; }

  // Meilleure vision pour départager, ou null si on est déjà sûr.
  function bestVision(layout, landing, answers, threshold) {
    const post = posterior(layout, landing, answers);
    if (post[0].p >= (threshold || 0.9)) return null;
    const asked = new Set((answers || []).map((a) => a.attr));
    let best = null;
    for (const attr of VISIONS) {
      if (asked.has(attr)) continue;
      let eh = 0, pYesTot = 0;
      for (const yes of [true, false]) {
        const pa = post.reduce((s, x) => { const a = SYMBOLS[x.sym].attrs[attr]; const py = 0.03 + 0.94 * a; return s + x.p * (yes ? py : 1 - py); }, 0);
        if (yes) pYesTot = pa;
        const p2 = posterior(layout, landing, (answers || []).concat([{ attr, yes }]));
        eh += pa * entropy(p2.map((x) => x.p));
      }
      const gain = entropy(post.map((x) => x.p)) - eh;
      if (!best || gain > best.gain) best = { attr, gain, likelyYes: pYesTot >= 0.5 };
    }
    return best && best.gain > 0.05 ? best : null;
  }

  // Qualité d'une disposition : probabilité de trouver juste après au plus `maxVisions` visions,
  // en supposant des réponses franches. Sert à choisir la meilleure parmi plusieurs tirages.
  function layoutScore(layout, maxVisions) {
    let score = 0;
    layout.forEach((sym, pos) => {
      const L = SYMBOLS[sym].word.length;
      for (const m of MODES) {
        const landing = mod(m.shift(pos, L));
        const answers = [];
        for (let k = 0; k < (maxVisions || 1); k++) {
          const v = bestVision(layout, landing, answers);
          if (!v) break;
          answers.push({ attr: v.attr, yes: SYMBOLS[sym].attrs[v.attr] >= 0.5 });
        }
        if (posterior(layout, landing, answers)[0].sym === sym) score += m.w / N;
      }
    });
    return score;
  }

  function bestLayout(seed, tries) {
    const rand = rng(seed);
    let best = null, bestS = -1;
    for (let t = 0; t < (tries || 40); t++) {
      const l = randomLayout(rand);
      if (!l) continue;
      const s = layoutScore(l, 2);
      if (s > bestS) { bestS = s; best = l; }
    }
    return { layout: best, score: bestS };
  }

  const api = { SYMBOLS, MODES, VISIONS, mod, rng, randomLayout, posterior, bestVision, layoutScore, bestLayout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Oracle = api;
})(typeof window !== 'undefined' ? window : globalThis);
