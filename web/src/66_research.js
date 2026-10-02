/* EnergyLab — module d'évaluation pour la recherche : pré-test / post-test, utilisabilité (SUS),
 * motivation, et analyse statistique (t de Student apparié, d de Cohen, gain normalisé de Hake) */
(function (root) {
  'use strict';
  const EL = root.EL = root.EL || {};
  if (typeof document === 'undefined') return;
  const U = EL.util, h = U.h;

  // ---------------------------------------------------------------- instruments
  const TEST = [
    { q: 'Une bouilloire de 2 000 W fonctionne pendant 6 minutes. Quelle énergie consomme-t-elle ?', o: ['200 Wh', '12 000 Wh', '2 000 Wh', '333 Wh'], c: 0 },
    { q: 'L’unité de la puissance active est :', o: ['le watt (W)', 'le kilowattheure (kWh)', 'le volt-ampère réactif (var)', 'l’ampère (A)'], c: 0 },
    { q: 'Sur une facture d’électricité, on paie principalement :', o: ['l’énergie consommée (kWh)', 'la tension (V)', 'le courant (A)', 'la fréquence (Hz)'], c: 0 },
    { q: 'Un appareil mesure U = 230 V et I = 0,5 A avec un facteur de puissance de 0,6. Sa puissance active vaut :', o: ['69 W', '115 W', '460 W', '383 W'], c: 0 },
    { q: 'Pour un radiateur électrique (résistance), le facteur de puissance est proche de :', o: ['1', '0,5', '0', '2'], c: 0 },
    { q: 'La puissance apparente S est :', o: ['le produit U × I', 'toujours égale à P', 'la puissance perdue en chaleur', 'l’énergie divisée par la tension'], c: 0 },
    { q: 'Un téléviseur en veille consomme 2 W en permanence. Sur une année, cela fait environ :', o: ['17,5 kWh', '2 kWh', '730 kWh', '0,05 kWh'], c: 0 },
    { q: 'Le « délestage » consiste à :', o: ['couper temporairement des appareils peu prioritaires pour ne pas dépasser une puissance limite', 'augmenter la tension', 'mesurer l’énergie', 'changer de fournisseur'], c: 0 },
    { q: 'Décaler le fonctionnement d’un chauffe-eau vers les heures creuses permet surtout de :', o: ['réduire le coût', 'réduire la tension', 'augmenter le facteur de puissance', 'supprimer la consommation'], c: 0 },
    { q: 'Dans un thermostat, l’hystérésis sert à :', o: ['éviter que le chauffage s’allume et s’éteigne trop souvent', 'chauffer plus vite', 'mesurer l’humidité', 'augmenter la consigne'], c: 0 },
    { q: 'Un relais est :', o: ['un interrupteur commandé électriquement', 'un capteur de courant', 'un disjoncteur différentiel', 'une résistance'], c: 0 },
    { q: 'Dans l’algorithme des k plus proches voisins, un appareil inconnu est reconnu :', o: ['par vote des exemples appris les plus proches de sa mesure', 'au hasard', 'par sa couleur', 'par la tension du réseau uniquement'], c: 0 },
    { q: 'Le disjoncteur différentiel 30 mA protège avant tout :', o: ['les personnes contre l’électrocution', 'les appareils contre la surtension', 'le compteur contre le vol', 'le Wi-Fi'], c: 0 },
    { q: 'Le capteur de courant (tore) doit entourer :', o: ['un seul conducteur (la phase)', 'la phase et le neutre ensemble', 'le fil de terre', 'le câble USB'], c: 0 }
  ];
  // SUS - System Usability Scale (Brooke, 1996), traduction française (Gronier & Baudet, 2021)
  const SUS = [
    'Je pense que j’aimerais utiliser ce système fréquemment.',
    'J’ai trouvé ce système inutilement complexe.',
    'J’ai trouvé ce système facile à utiliser.',
    'Je pense que j’aurais besoin de l’aide d’un technicien pour être capable d’utiliser ce système.',
    'J’ai trouvé que les différentes fonctions de ce système ont été bien intégrées.',
    'J’ai trouvé qu’il y avait trop d’incohérences dans ce système.',
    'Je suppose que la plupart des gens apprendraient très rapidement à utiliser ce système.',
    'J’ai trouvé ce système très lourd à utiliser.',
    'Je me suis senti·e très en confiance en utilisant ce système.',
    'J’ai eu besoin d’apprendre beaucoup de choses avant de pouvoir utiliser ce système.'
  ];
  // Motivation (adapté de l'Intrinsic Motivation Inventory, McAuley, Duncan & Tammen, 1989) — échelle 1 à 7
  const IMI = [
    { t: 'J’ai pris plaisir à faire ces activités.', s: 'interet', r: false },
    { t: 'Ces activités étaient intéressantes.', s: 'interet', r: false },
    { t: 'J’ai trouvé ces activités ennuyeuses.', s: 'interet', r: true },
    { t: 'Je pense être assez compétent·e dans ces activités.', s: 'competence', r: false },
    { t: 'Je suis satisfait·e de ma performance.', s: 'competence', r: false },
    { t: 'Je pense que ces activités peuvent m’être utiles.', s: 'valeur', r: false },
    { t: 'Ces activités sont importantes pour comprendre l’énergie à la maison.', s: 'valeur', r: false },
    { t: 'Je me suis senti·e tendu·e pendant ces activités.', s: 'pression', r: false }
  ];

  // ---------------------------------------------------------------- statistiques
  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
  function sd(a) { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1)); }
  // fonction bêta incomplète régularisée (Numerical Recipes, fraction continue)
  function betacf(a, b, x) {
    const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
    let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let hh = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; hh *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      hh *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return hh;
  }
  function gammaln(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function ibeta(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  // p bilatéral pour une statistique t à df degrés de liberté
  function pT(t, df) { return ibeta(df / 2, 0.5, df / (df + t * t)); }
  function pairedT(pre, post) {
    const d = pre.map(function (x, i) { return post[i] - x; });
    const n = d.length;
    if (n < 2) return null;
    const md = mean(d), sdd = sd(d);
    const t = sdd > 0 ? md / (sdd / Math.sqrt(n)) : NaN;
    return { n: n, meanDiff: md, sdDiff: sdd, t: t, df: n - 1, p: Number.isFinite(t) ? pT(Math.abs(t), n - 1) : NaN, dz: sdd > 0 ? md / sdd : NaN };
  }
  function welchT(a, b) {
    if (a.length < 2 || b.length < 2) return null;
    const ma = mean(a), mb = mean(b), va = sd(a) ** 2, vb = sd(b) ** 2;
    const se = Math.sqrt(va / a.length + vb / b.length);
    const t = (ma - mb) / se;
    const df = (va / a.length + vb / b.length) ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
    const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2));
    return { t: t, df: df, p: pT(Math.abs(t), df), d: sp > 0 ? (ma - mb) / sp : NaN, ma: ma, mb: mb };
  }
  function susScore(ans) {
    let s = 0;
    for (let i = 0; i < 10; i++) s += i % 2 === 0 ? ans[i] - 1 : 5 - ans[i];
    return s * 2.5;
  }

  // ---------------------------------------------------------------- vue
  const view = {
    mount: function (main) {
      this.main = main;
      this.render();
    },
    render: function () {
      const self = this, main = this.main;
      U.clear(main);
      main.appendChild(h('div.page-head', [h('div', [h('h1', 'Évaluation'), h('p', 'Questionnaires pour mesurer les apprentissages et l’expérience utilisateur. Les réponses sont enregistrées sur le kit pour l’enseignant-chercheur.')])]));
      const p = EL.app.profile || {};
      const done = U.store.get('research.done.' + (p.name || 'anonyme'), {});
      const card = function (id, icon, title, desc, fn) {
        return h('div.card', [h('h2', icon + ' ' + title), h('p.small', desc), h('div.row', [
          done[id] ? h('span.badge.ok', '✓ déjà répondu') : null,
          h('button.btn' + (done[id] ? '' : '.primary'), { onclick: fn }, done[id] ? 'Répondre à nouveau' : 'Commencer')
        ])]);
      };
      main.appendChild(h('div.grid.g2', [
        card('pretest', '📝', 'Pré-test de connaissances', TEST.length + ' questions à choix multiple, à faire AVANT les activités (environ 10 min).', function () { self.test('pretest'); }),
        card('posttest', '✅', 'Post-test de connaissances', 'Les mêmes questions, à faire APRÈS les activités : on mesure la progression.', function () { self.test('posttest'); }),
        card('sus', '🖐️', 'Utilisabilité (SUS)', 'Questionnaire standard de 10 affirmations (System Usability Scale).', function () { self.likert('sus'); }),
        card('motivation', '🔥', 'Motivation', '8 affirmations sur l’intérêt, la compétence perçue, l’utilité et la tension ressentie.', function () { self.likert('motivation'); })
      ]));
      main.appendChild(h('div.card', { style: { marginTop: '14px' } }, [
        h('h2', '👩‍🏫 Espace enseignant-chercheur'),
        h('p.small', 'Analyse des résultats enregistrés sur le kit : progression pré/post-test, gain normalisé, test t de Student apparié, taille d’effet, comparaison de groupes (ex. guidage fort / faible), score SUS moyen.'),
        h('button.btn', { onclick: async function () { if (await EL.requireTeacher()) self.analysis(); } }, [EL.icon('chart'), 'Analyser les résultats'])
      ]));
    },
    submit: async function (kind, score, max, answers, t0) {
      const p = EL.app.profile || {};
      const res = {
        ts: new Date().toISOString(), learner: p.name || 'anonyme', group: p.group || '', cond: EL.app.config ? EL.SCAF[EL.app.config.peda.scaffold] : '',
        kind: kind, score: Math.round(score * 100) / 100, max: max, duration: Math.round((Date.now() - t0) / 1000), answers: answers
      };
      const r = await EL.app.kit.postResult(res);
      const key = 'research.done.' + (p.name || 'anonyme');
      const done = U.store.get(key, {});
      done[kind] = res.ts;
      U.store.set(key, done);
      const local = U.store.get('research.local', []);
      local.push(res);
      U.store.set('research.local', local);
      EL.track('research_submit', { kind: kind, score: res.score });
      EL.toast(r && r.ok ? 'Merci ! Réponses enregistrées.' : 'Réponses gardées sur cet appareil (kit injoignable).', r && r.ok ? 'ok' : 'warn');
      return res;
    },
    test: function (kind) {
      const self = this, t0 = Date.now();
      const body = h('div');
      body.appendChild(h('p.small.muted', 'Répondez seul·e, sans chercher : on mesure ce que vous savez. Il n’y a pas de note.'));
      const groups = TEST.map(function (q, i) {
        const g = h('div.qcm', { style: { marginBottom: '14px' } }, [h('b', (i + 1) + '. ' + q.q)]);
        // ordre des options mélangé de façon reproductible (même ordre au pré et au post-test)
        const order = q.o.map(function (_, j) { return j; }).sort(function (a, b) { return ((a * 7 + i * 3) % 5) - ((b * 7 + i * 3) % 5); });
        order.forEach(function (j) { g.appendChild(h('label', [h('input', { type: 'radio', name: 'tq' + i, value: j }), q.o[j]])); });
        body.appendChild(g);
        return g;
      });
      EL.modal({
        title: kind === 'pretest' ? 'Pré-test' : 'Post-test', body: body, wide: true,
        actions: [{ label: 'Annuler' }, {
          label: 'Envoyer mes réponses', kind: 'primary', onClick: async function () {
            const answers = groups.map(function (g) { const s = g.querySelector('input:checked'); return s ? Number(s.value) : -1; });
            if (answers.some(function (a) { return a < 0; })) { EL.toast('Répondez à toutes les questions', 'warn'); return false; }
            const score = answers.reduce(function (s, a, i) { return s + (a === TEST[i].c ? 1 : 0); }, 0);
            await self.submit(kind, score, TEST.length, answers, t0);
            self.render();
          }
        }]
      });
    },
    likert: function (kind) {
      const self = this, t0 = Date.now();
      const items = kind === 'sus' ? SUS.map(function (t) { return { t: t }; }) : IMI;
      const n = kind === 'sus' ? 5 : 7;
      const body = h('div');
      body.appendChild(h('p.small.muted', kind === 'sus' ? '1 = pas du tout d’accord … 5 = tout à fait d’accord' : '1 = pas du tout vrai … 7 = tout à fait vrai'));
      const rows = items.map(function (it, i) {
        const row = h('div', { style: { marginBottom: '12px' } }, [h('div', (i + 1) + '. ' + it.t)]);
        const lk = h('div.likert', { style: { '--n': n } });
        for (let v = 1; v <= n; v++) lk.appendChild(h('label', [h('input', { type: 'radio', name: 'lk' + i, value: v }), String(v)]));
        row.appendChild(lk);
        body.appendChild(row);
        return row;
      });
      EL.modal({
        title: kind === 'sus' ? 'Utilisabilité du kit (SUS)' : 'Motivation', body: body, wide: true,
        actions: [{ label: 'Annuler' }, {
          label: 'Envoyer', kind: 'primary', onClick: async function () {
            const ans = rows.map(function (r) { const s = r.querySelector('input:checked'); return s ? Number(s.value) : 0; });
            if (ans.some(function (a) { return !a; })) { EL.toast('Répondez à toutes les affirmations', 'warn'); return false; }
            let score, max;
            if (kind === 'sus') { score = susScore(ans); max = 100; } else {
              score = mean(ans.map(function (a, i) { return IMI[i].r ? 8 - a : a; }).filter(function (_, i) { return IMI[i].s !== 'pression'; }));
              max = 7;
            }
            await self.submit(kind, score, max, ans, t0);
            self.render();
          }
        }]
      });
    },
    analysis: async function () {
      const kit = EL.app.kit;
      let text = await kit.fetchFile('research', 'results.csv');
      let rows = U.parseCsv(text || '').slice(1).filter(function (r) { return r.length >= 8; });
      let source = 'kit';
      if (!rows.length) {
        source = 'cet appareil';
        rows = U.store.get('research.local', []).map(function (r) { return [r.ts, r.learner, r.group, r.cond, r.kind, r.score, r.max, r.duration, JSON.stringify(r.answers)]; });
      }
      const recs = rows.map(function (r) { return { ts: r[0], learner: r[1], group: r[2], cond: r[3], kind: r[4], score: Number(r[5]), max: Number(r[6]) }; });
      // dernière réponse de chaque apprenant pour chaque instrument
      const last = {};
      for (const r of recs) { last[r.learner + '|' + r.kind] = r; }
      const learners = Array.from(new Set(recs.map(function (r) { return r.learner; })));
      const pairs = [];
      for (const l of learners) {
        const a = last[l + '|pretest'], b = last[l + '|posttest'];
        if (a && b) pairs.push({ learner: l, group: b.group || a.group, cond: b.cond || a.cond, pre: a.score, post: b.score, max: a.max });
      }
      const body = h('div');
      body.appendChild(h('p.small.muted', 'Source : ' + source + ' · ' + recs.length + ' réponse(s), ' + learners.length + ' apprenant(s), ' + pairs.length + ' paire(s) pré/post complètes.'));
      if (pairs.length) {
        const pre = pairs.map(function (x) { return x.pre; }), post = pairs.map(function (x) { return x.post; });
        const max = pairs[0].max;
        const st = pairedT(pre, post);
        const gains = pairs.map(function (x) { return x.max > x.pre ? (x.post - x.pre) / (x.max - x.pre) : 0; });
        const gAvg = (mean(post) - mean(pre)) / (max - mean(pre));
        body.appendChild(h('div.card.flat', [
          h('h3', 'Progression des connaissances (pré-test → post-test)'),
          h('table.tbl', h('tbody', [
            h('tr', [h('td', 'Score moyen au pré-test'), h('td.num', U.fmt(mean(pre), 2) + ' / ' + max + ' (σ = ' + U.fmt(sd(pre), 2) + ')')]),
            h('tr', [h('td', 'Score moyen au post-test'), h('td.num', U.fmt(mean(post), 2) + ' / ' + max + ' (σ = ' + U.fmt(sd(post), 2) + ')')]),
            h('tr', [h('td', 'Gain moyen'), h('td.num', U.fmt(st ? st.meanDiff : NaN, 2) + ' point(s)')]),
            h('tr', [h('td', 'Gain normalisé de Hake ⟨g⟩ (sur les moyennes)'), h('td.num', U.fmt(gAvg, 2) + ' (moyenne individuelle : ' + U.fmt(mean(gains), 2) + ')')]),
            h('tr', [h('td', 't de Student apparié'), h('td.num', st ? 't(' + st.df + ') = ' + U.fmt(st.t, 2) + ', p = ' + (st.p < 0.001 ? '< 0,001' : U.fmt(st.p, 3)) : 'au moins 2 paires nécessaires')]),
            h('tr', [h('td', 'Taille d’effet (d de Cohen pour mesures appariées, dz)'), h('td.num', U.fmt(st ? st.dz : NaN, 2))])
          ])),
          h('p.small.muted', 'Repères : ⟨g⟩ < 0,3 gain faible, 0,3–0,7 moyen, > 0,7 élevé (Hake, 1998). d ≈ 0,2 petit, 0,5 moyen, 0,8 grand (Cohen, 1988). Vérifiez la normalité des différences pour de petits effectifs (sinon, test de Wilcoxon).')
        ]));
        // comparaison des groupes / conditions
        const byKey = function (key) {
          const m = {};
          for (const x of pairs) { const k = x[key] || '(vide)'; (m[k] = m[k] || []).push(x.max > x.pre ? (x.post - x.pre) / (x.max - x.pre) : 0); }
          return m;
        };
        for (const key of ['cond', 'group']) {
          const m = byKey(key);
          const ks = Object.keys(m);
          if (ks.length < 2) continue;
          const rowsT = ks.map(function (k) { return h('tr', [h('td', k), h('td.num', String(m[k].length)), h('td.num', U.fmt(mean(m[k]), 2)), h('td.num', U.fmt(sd(m[k]), 2))]); });
          const w = ks.length === 2 ? welchT(m[ks[0]], m[ks[1]]) : null;
          body.appendChild(h('div.card.flat', { style: { marginTop: '10px' } }, [
            h('h3', 'Gain normalisé par ' + (key === 'cond' ? 'condition de guidage' : 'groupe')),
            h('table.tbl', [h('thead', h('tr', ['Modalité', 'n', 'g moyen', 'σ'].map(function (t, i) { return h('th' + (i ? '.num' : ''), t); }))), h('tbody', rowsT)]),
            w ? h('p.small', 'Test t de Welch (' + ks[0] + ' vs ' + ks[1] + ') : t(' + U.fmt(w.df, 1) + ') = ' + U.fmt(w.t, 2) + ', p = ' + (w.p < 0.001 ? '< 0,001' : U.fmt(w.p, 3)) + ', d = ' + U.fmt(w.d, 2)) : null
          ]));
        }
      }
      for (const inst of ['sus', 'motivation']) {
        const xs = learners.map(function (l) { return last[l + '|' + inst]; }).filter(Boolean).map(function (r) { return r.score; });
        if (!xs.length) continue;
        body.appendChild(h('div.card.flat', { style: { marginTop: '10px' } }, [
          h('h3', inst === 'sus' ? 'Utilisabilité (SUS)' : 'Motivation (1 à 7)'),
          h('p', 'n = ' + xs.length + ' ; moyenne = ' + U.fmt(mean(xs), 1) + ' ; σ = ' + U.fmt(sd(xs), 1) + (inst === 'sus' ? ' (repère : 68 = moyenne des systèmes évalués ; > 80 = excellent)' : ''))
        ]));
      }
      if (!recs.length) body.appendChild(h('div.empty', 'Aucun résultat pour le moment.'));
      EL.modal({
        title: 'Analyse des résultats', body: body, wide: true,
        actions: [
          { label: 'Télécharger results.csv', onClick: function () { U.download('results.csv', text || U.toCsv([['horodatage', 'apprenant', 'groupe', 'condition', 'instrument', 'score', 'max', 'duree_s', 'reponses']].concat(rows), ','), 'text/csv'); return false; } },
          { label: 'Télécharger les traces (events.csv)', onClick: async function () { U.download('events.csv', await kit.fetchFile('research', 'events.csv'), 'text/csv'); return false; } },
          { label: 'Fermer' }
        ]
      });
      EL.track('research_analysis', { n: recs.length });
    }
  };
  EL.stats = { mean: mean, sd: sd, pT: pT, pairedT: pairedT, welchT: welchT, susScore: susScore, ibeta: ibeta };
  EL.views.evaluation = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
