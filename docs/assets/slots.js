/* ============================================================
   slots.js — 澳门老虎机厅
   · 5×3 转轮，243 ways / 20–30 线两种机台
   · 每台机按场馆设定不同 RTP 与注码区间（金沙 / 银河 / 永利 / 美高梅 / 新濠 / 澳娱）
   · 免费游戏、累积奖池（迷你 / 次要 / 主要 / 超级）
   · 有效投注与积分同步六套会籍
   ============================================================ */
(function () {
  'use strict';

  const BJ = window.BJ_CASINOS || {};
  const CASINOS = BJ.casinos || [];
  const PROGRAMS = BJ.programs || {};
  const Wallet = window.BJWallet;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const fmt = n => Math.round(n).toLocaleString('zh-CN');
  const money = n => 'MOP ' + fmt(n);
  const delay = ms => new Promise(r => setTimeout(r, ms));

  /* ---------------- 符号与赔率 ---------------- */
  const SYM = {
    W:       { glyph: '百', label: 'WILD', type: 'wild' },
    S:       { glyph: '彩', label: 'SCATTER', type: 'scatter' },
    D:       { glyph: '龍', label: '龙', type: 'high' },
    JADE:    { glyph: '玉', label: '玉', type: 'high' },
    CAI:     { glyph: '財', label: '财', type: 'high' },
    XI:      { glyph: '囍', label: '囍', type: 'mid' },
    LANTERN: { glyph: '燈', label: '灯', type: 'mid' },
    A:       { glyph: 'A', label: 'A', type: 'low' },
    K:       { glyph: 'K', label: 'K', type: 'low' },
    Q:       { glyph: 'Q', label: 'Q', type: 'low' },
    TEN:     { glyph: '10', label: '10', type: 'low' }
  };
  const KEYS = ['W', 'S', 'D', 'JADE', 'CAI', 'XI', 'LANTERN', 'A', 'K', 'Q', 'TEN'];
  const BASE_W = { W: 2, S: 2, D: 6, JADE: 8, CAI: 10, XI: 12, LANTERN: 14, A: 17, K: 19, Q: 21, TEN: 23 };

  /* 243 ways：按「每条 way」下注单位赔付 */
  const PAY_WAYS = {
    D: [0, 0, 0, 0.6, 2.4, 10],
    JADE: [0, 0, 0, 0.45, 1.8, 7],
    CAI: [0, 0, 0, 0.35, 1.2, 4.5],
    XI: [0, 0, 0, 0.28, 0.9, 3.2],
    LANTERN: [0, 0, 0, 0.22, 0.7, 2.4],
    A: [0, 0, 0, 0.16, 0.5, 1.6],
    K: [0, 0, 0, 0.13, 0.4, 1.2],
    Q: [0, 0, 0, 0.1, 0.3, 0.9],
    TEN: [0, 0, 0, 0.08, 0.24, 0.7]
  };
  /* 多线：按「每条线注」赔付（已按常见 25/30 线机台量级设定） */
  const PAY_LINES = {
    D: [0, 0, 0, 60, 240, 1200],
    JADE: [0, 0, 0, 48, 180, 900],
    CAI: [0, 0, 0, 36, 120, 600],
    XI: [0, 0, 0, 30, 96, 480],
    LANTERN: [0, 0, 0, 24, 72, 360],
    A: [0, 0, 0, 18, 60, 240],
    K: [0, 0, 0, 14.4, 48, 180],
    Q: [0, 0, 0, 12, 36, 144],
    TEN: [0, 0, 0, 9.6, 30, 120]
  };
  const SCATTER_PAY = [0, 0, 0, 2, 5, 20];

  const LINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 0, 1, 2],
    [2, 2, 2, 1, 0], [1, 2, 2, 2, 1], [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [1, 0, 1, 0, 1],
    [1, 2, 1, 2, 1], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0],
    [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 1, 0, 1, 1],
    [1, 1, 2, 1, 1], [0, 0, 1, 0, 0], [2, 2, 1, 2, 2],
    [0, 1, 2, 2, 2], [2, 1, 0, 0, 0], [1, 2, 1, 0, 1],
    [1, 0, 1, 2, 1], [0, 1, 1, 0, 1], [2, 1, 1, 2, 1],
    [1, 2, 2, 1, 2], [1, 0, 0, 1, 0], [0, 2, 1, 2, 0]
  ];

  /* ---------------- 机台目录 ---------------- */
  const MACHINES = [
    { id: 'dragon', name: '金龙献瑞', en: "Dragon's Fortune", prov: 'Aristocrat 风格', mode: 'ways', rtp: 92.5, vol: '中', min: 0.1, max: 500, theme: 'dragon',
      note: '金沙系中场最常见的 243 线机台：命中率高、单次派彩温和，适合长时间消磨。' },
    { id: 'fortune8', name: '财神到', en: 'Fortune 8', prov: 'Light & Wonder 风格', mode: 'lines', lines: 25, rtp: 90.5, vol: '中', min: 0.1, max: 300, theme: 'fortune',
      note: '25 线经典财神主题，低额台常见；免费游戏 10 次、全奖 ×2。' },
    { id: 'fa88', name: '富贵 88', en: 'Prosperity 88', prov: 'Aruze 风格', mode: 'lines', lines: 25, rtp: 91.5, vol: '中高', min: 0.2, max: 300, theme: 'fa',
      note: '88 富贵主题，高符号出现率略低，但五连赔付更高。' },
    { id: 'fafafa', name: '发发发', en: 'Fa Fa Fa', prov: 'Aristocrat 风格', mode: 'ways', lines: 243, rtp: 91.0, vol: '中', min: 0.2, max: 500, theme: 'redgold',
      note: '银河中场常见的 243 线机台，免费游戏期间奖分 ×2。' },
    { id: 'lotus', name: '盛世金莲', en: 'Prosperity Lotus', prov: 'IGT 风格', mode: 'lines', lines: 20, rtp: 94.0, vol: '低中', min: 0.5, max: 1000, theme: 'lotus',
      note: '永利高额区常见的高 RTP 机台：注码门槛高，波动低。' },
    { id: 'diamond', name: '钻石人生', en: 'Diamond Life', prov: 'Konami 风格', mode: 'ways', rtp: 93.0, vol: '高', min: 1, max: 2000, theme: 'diamond',
      note: '永利 / 永利皇宫高额机台，单注高、波动大，适合大注短线。' },
    { id: 'lion', name: '金狮传奇', en: 'Golden Lion', prov: 'Aristocrat 风格', mode: 'ways', rtp: 92.0, vol: '高', min: 0.1, max: 500, theme: 'lion',
      note: '美高梅金狮会主题机台，高波动，五连龙形符号派彩最重。' },
    { id: 'lionvault', name: '狮王宝库', en: "Lion's Vault", prov: 'Light & Wonder 风格', mode: 'lines', lines: 30, rtp: 92.5, vol: '中高', min: 0.5, max: 1000, theme: 'lion',
      note: '30 线机台，美高梅高额区与 Privé 前厅常见。' },
    { id: 'mocha', name: '摩卡财富', en: 'Mocha Fortune', prov: 'Aruze 风格', mode: 'lines', lines: 30, rtp: 91.8, vol: '中', min: 0.05, max: 200, theme: 'mocha',
      note: '新濠摩卡会角子机厅的主力机台，最低注可到 0.05 MOP。' },
    { id: 'luckydragon', name: '幸运龙', en: 'Lucky Dragon', prov: 'Aristocrat 风格', mode: 'ways', rtp: 90.8, vol: '中', min: 0.1, max: 300, theme: 'green',
      note: '新濠天地中场常见，243 线、免费游戏可重触发。' },
    { id: 'lisboa', name: '葡京金彩', en: 'Lisboa Gold', prov: 'IGT 风格', mode: 'lines', lines: 25, rtp: 89.8, vol: '中', min: 0.1, max: 300, theme: 'lisboa',
      note: '澳娱半岛老场机台，RTP 偏低但最低注门槛也低。' }
  ];
  const MACHINE_BY_ID = Object.fromEntries(MACHINES.map(m => [m.id, m]));

  const PROG_ADJ = { sands: 0, galaxy: -0.8, wynn: 1.0, mgm: -0.4, melco: 0.2, sjm: -1.6 };
  const PROG_MACHINES = {
    sands: ['dragon', 'fortune8', 'fa88', 'fafafa'],
    galaxy: ['fafafa', 'fortune8', 'dragon'],
    wynn: ['lotus', 'diamond', 'dragon'],
    mgm: ['lion', 'lionvault', 'dragon'],
    melco: ['mocha', 'luckydragon', 'fa88'],
    sjm: ['lisboa', 'fortune8', 'lotus']
  };
  const VENUE_MIN = {
    venetian: 0.5, parisian: 0.5, londoner: 0.5, sands: 0.5, plaza: 1,
    galaxy: 0.5, starworld: 0.5, broadway: 0.2,
    wynn: 1, 'wynn-palace': 1,
    mgm: 0.5, 'mgm-cotai': 0.5,
    cod: 0.05, studio: 0.05, altira: 1,
    'grand-lisboa': 0.1, 'lisboa-palace': 0.5, lisboa: 0.1, larc: 0.1, oceanus: 0.2, ponte16: 0.1
  };
  const LEVELS = [0.05, 0.1, 0.2, 0.5, 1, 2, 3, 5, 8, 10, 20, 30, 50, 80, 100, 200, 300, 500, 1000, 2000];
  /* 与 21 点目录一致的英文名 / 集团名，供双语下拉显示 */
  const VENUE_EN = {
    venetian: 'The Venetian Macao', parisian: 'The Parisian Macao', londoner: 'The Londoner Macao',
    sands: 'Sands Macao', plaza: 'Plaza Macao', galaxy: 'Galaxy Macau', starworld: 'StarWorld Hotel',
    broadway: 'Broadway Macau', wynn: 'Wynn Macau', 'wynn-palace': 'Wynn Palace',
    mgm: 'MGM Macau', 'mgm-cotai': 'MGM Cotai', cod: 'City of Dreams', studio: 'Studio City',
    altira: 'Altira Macau', 'grand-lisboa': 'Grand Lisboa', 'lisboa-palace': 'Grand Lisboa Palace',
    lisboa: 'Hotel Lisboa', larc: "L'Arc Macau", oceanus: 'Oceanus', ponte16: 'Ponte 16'
  };
  const GROUP_EN = {
    sands: 'Sands China', galaxy: 'Galaxy Entertainment', wynn: 'Wynn Macau',
    mgm: 'MGM China', melco: 'Melco Resorts', sjm: 'SJM Holdings'
  };
  const GROUP_ORDER = ['sands', 'galaxy', 'wynn', 'mgm', 'melco', 'sjm'];
  function groupLabel(prog) {
    const c = CASINOS.find(x => x.prog === prog);
    return (c ? c.op : prog) + ' ' + (GROUP_EN[prog] || '');
  }

  /* ---------------- 本地存储 ---------------- */
  const BANK_KEY = 'slot.bank.v1';
  const PREF_KEY = 'slot.pref.v1';
  const JP_KEY = 'slot.jp.v1';
  const CAL_KEY = 'slot.cal.v2';

  function loadJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function loadNum(k, d) {
    const raw = localStorage.getItem(k);
    if (raw === null || raw === '') return d;
    const n = +raw;
    return isFinite(n) && n >= 0 ? n : d;
  }

  const prefs = loadJSON(PREF_KEY) || {};
  const state = {
    venue: Math.max(0, Math.min(CASINOS.length - 1, prefs.venue | 0)),
    group: prefs.group || CASINOS[Math.max(0, Math.min(CASINOS.length - 1, prefs.venue | 0))].prog,
    machineId: prefs.machineId || 'dragon',
    betIdx: prefs.betIdx || 4,
    bank: loadNum(BANK_KEY, 100000),
    turbo: !!prefs.turbo,
    auto: 0,
    free: 0,
    fsMult: 2,
    spinning: false,
    scale: 1,
    grid: [],
    stats: { spins: 0, wagered: 0, won: 0, biggest: 0, hits: 0, fs: 0, jp: 0 },
    jp: Object.assign({}, loadJSON(JP_KEY) || {})
  };
  const JP_SEED = { mini: 6000, minor: 48000, major: 420000, grand: 3200000 };
  const JP_META = {
    mini: { name: '迷你奖池', p: 1 / 900000 },
    minor: { name: '次要奖池', p: 1 / 9000000 },
    major: { name: '主要奖池', p: 1 / 90000000 },
    grand: { name: '超级大奖', p: 1 / 900000000 }
  };

  function venue() { return CASINOS[state.venue]; }
  function program() { return PROGRAMS[venue().prog] || null; }
  function machine() {
    let m = MACHINE_BY_ID[state.machineId];
    if (!m || (PROG_MACHINES[venue().prog] || []).indexOf(m.id) < 0) {
      m = MACHINE_BY_ID[(PROG_MACHINES[venue().prog] || ['dragon'])[0]] || MACHINES[0];
      state.machineId = m.id;
    }
    return m;
  }
  function effectiveRTP(m) {
    return Math.max(86, Math.min(96, m.rtp + (PROG_ADJ[venue().prog] || 0)));
  }
  function betLevels(m) {
    const floor = Math.max(m.min, VENUE_MIN[venue().id] || m.min);
    return LEVELS.filter(v => v >= floor && v <= m.max);
  }
  function currentBet() {
    const lv = betLevels(machine());
    const i = Math.max(0, Math.min(lv.length - 1, state.betIdx));
    return lv[i] || lv[0] || machine().min;
  }

  /* ---------------- 随机与校准 ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function drawSymbol(m, rnd) {
    const w = m.weights || BASE_W;
    let total = 0;
    KEYS.forEach(k => total += w[k] || 0);
    let x = rnd() * total;
    for (const k of KEYS) { x -= w[k] || 0; if (x <= 0) return k; }
    return 'TEN';
  }
  function drawGrid(m, rnd) {
    const g = [];
    for (let r = 0; r < 5; r++) {
      const col = [];
      for (let row = 0; row < 3; row++) col.push(drawSymbol(m, rnd || Math.random));
      g.push(col);
    }
    return g;
  }

  function evaluate(grid, m, scale, bet) {
    const pay = m.mode === 'ways' ? PAY_WAYS : PAY_LINES;
    const wins = [];
    let win = 0;
    if (m.mode === 'ways') {
      for (const s of Object.keys(pay)) {
        const counts = grid.map(col => col.filter(k => k === s || k === 'W').length);
        let run = 0;
        while (run < 5 && counts[run] > 0) run++;
        if (run < 3) continue;
        const ways = counts.slice(0, run).reduce((a, b) => a * b, 1);
        const amt = pay[s][run] * ways;
        if (!amt) continue;
        win += amt;
        const pos = [];
        grid.forEach((col, ri) => { if (ri < run) col.forEach((k, row) => { if (k === s || k === 'W') pos.push(ri * 3 + row); }); });
        wins.push({ sym: s, run, ways, amt, pos });
      }
    } else {
      const lineBet = bet / m.lines;
      LINES.slice(0, m.lines).forEach((line, li) => {
        let best = null;
        for (const s of Object.keys(pay)) {
          let run = 0;
          for (let r = 0; r < 5; r++) {
            const k = grid[r][line[r]];
            if (k === s || k === 'W') run++; else break;
          }
          if (run >= 3) {
            const amt = pay[s][run] * lineBet;
            if (!best || amt > best.amt) best = { sym: s, run, amt, line: li + 1 };
          }
        }
        if (best) {
          win += best.amt;
          const pos = [];
          for (let r = 0; r < best.run; r++) pos.push(r * 3 + line[r]);
          wins.push({ sym: best.sym, run: best.run, amt: best.amt, pos, line: best.line });
        }
      });
    }
    const scatPos = [];
    grid.forEach((col, ri) => col.forEach((k, row) => { if (k === 'S') scatPos.push(ri * 3 + row); }));
    const sc = scatPos.length;
    if (sc >= 3) {
      const amt = SCATTER_PAY[Math.min(5, sc)] * bet;
      win += amt;
      wins.push({ sym: 'S', scatter: true, count: sc, amt, pos: scatPos });
    }
    return { win: win * scale, wins, scatter: sc };
  }

  function calibrate(m) {
    const target = effectiveRTP(m);
    const key = m.id + '@' + target.toFixed(1);
    const cache = loadJSON(CAL_KEY) || {};
    if (cache[key]) return cache[key];
    const rnd = mulberry32(0x9E3779B9 ^ m.id.length * 97 ^ Math.round(target * 100));
    const N = 8000;
    let total = 0;
    for (let i = 0; i < N; i++) {
      const g = drawGrid(m, rnd);
      const res = evaluate(g, m, 1, 1);
      let w = res.win;
      if (res.scatter >= 3) {
        for (let f = 0; f < 10; f++) {
          const g2 = drawGrid(m, rnd);
          w += evaluate(g2, m, 1, 1).win * 2;
        }
      }
      total += w;
    }
    const ev = Math.max(0.0001, total / N);
    let scale = target / (ev * 100);
    scale = Math.max(0.25, Math.min(12, scale));
    cache[key] = scale;
    saveJSON(CAL_KEY, cache);
    return scale;
  }

  /* ---------------- 渲染 ---------------- */
  function renderGroup() {
    const sel = $('#grpSel');
    if (!sel) return;
    sel.innerHTML = GROUP_ORDER.map(g =>
      `<option value="${g}"${g === state.group ? ' selected' : ''}>${groupLabel(g)}</option>`).join('');
  }
  function renderVenue() {
    const sel = $('#venueSel');
    if (!sel) return;
    sel.innerHTML = CASINOS.map((c, i) => ({ c, i }))
      .filter(x => x.c.prog === state.group)
      .map(x => `<option value="${x.i}"${x.i === state.venue ? ' selected' : ''}>${x.c.name} ${VENUE_EN[x.c.id] || ''}</option>`)
      .join('');
  }
  function renderMachines() {
    const host = $('#machList');
    if (!host) return;
    const ids = PROG_MACHINES[venue().prog] || ['dragon'];
    const cur = machine();
    host.innerHTML = ids.map(id => {
      const m = MACHINE_BY_ID[id];
      if (!m) return '';
      const rtp = effectiveRTP(m).toFixed(1);
      return `<button class="mach${m.id === cur.id ? ' on' : ''}" data-m="${m.id}" type="button">
        <b>${m.name}</b><small>${m.en} · ${m.mode === 'ways' ? '243 WAYS' : m.lines + ' LINES'}</small>
        <span class="rt">${rtp}%</span><span class="vol">波动 ${m.vol}</span></button>`;
    }).join('');
    $$('.mach', host).forEach(b => b.addEventListener('click', () => {
      if (state.spinning) return msg('转轮停止后再换机台');
      state.machineId = b.dataset.m;
      prefs.machineId = state.machineId;
      saveJSON(PREF_KEY, prefs);
      const lv = betLevels(machine());
      state.betIdx = Math.min(state.betIdx, lv.length - 1);
      renderMachine();
    }));
  }

  function setCell(cell, k) {
    cell.dataset.k = k;
    cell.className = 'cell sym-' + k;
    cell.innerHTML = `<span class="glyph">${SYM[k].glyph}</span><span class="lbl">${SYM[k].label}</span>`;
  }
  function renderGrid(grid) {
    const host = $('#reels');
    if (!host) return;
    if (!host.children.length) {
      host.innerHTML = Array.from({ length: 5 }, () =>
        `<div class="reel">${Array.from({ length: 3 }, () => '<div class="cell"></div>').join('')}</div>`).join('');
    }
    $$('.reel', host).forEach((reel, ri) => {
      $$('.cell', reel).forEach((cell, row) => setCell(cell, grid[ri][row]));
    });
  }
  function renderMachine() {
    const m = machine();
    $('#marqueeName').textContent = m.name;
    $('#marqueeEn').textContent = m.en + ' · ' + m.prov;
    const badge = $('#cabBadge');
    if (badge) badge.textContent = `${m.mode === 'ways' ? '243 WAYS' : m.lines + ' LINES'} · ${effectiveRTP(m).toFixed(1)}%`;
    $('#specName').textContent = m.name;
    $('#specNote').textContent = m.note;
    $('#specMode').textContent = m.mode === 'ways' ? '243 ways（任意连续三列起算）' : m.lines + ' 条固定赔付线';
    $('#specVol').textContent = m.vol;
    $('#specRTP').textContent = effectiveRTP(m).toFixed(1) + '%（已校准）';
    $('#specVenue').textContent = venue().name + ' · ' + venue().op;
    state.grid = drawGrid(m);
    renderGrid(state.grid);
    state.scale = calibrate(m);
    const lv = betLevels(m);
    state.betIdx = Math.max(0, Math.min(lv.length - 1, state.betIdx));
    renderBet();
    renderMachines();
    renderJackpots();
    renderStats();
  }

  function renderBet() {
    const m = machine();
    const lv = betLevels(m);
    state.betIdx = Math.max(0, Math.min(lv.length - 1, state.betIdx));
    $('#betVal').innerHTML = `${currentBet().toFixed(2)}<small>MOP / 转</small>`;
    $('#betIdx').textContent = `${state.betIdx + 1} / ${lv.length}`;
    renderStats();
  }
  function renderBank() {
    $('#bankVal').textContent = fmt(state.bank);
    const net = state.stats.won - state.stats.wagered;
    $('#sessNet').textContent = (net >= 0 ? '+' : '') + fmt(net);
    $('#sessNet').style.color = net >= 0 ? '#BFE7C9' : '#F0C0C0';
    const prog = program();
    if (prog && Wallet) {
      const w = Wallet.load();
      const mem = Wallet.memOf(w, venue().prog);
      $('#ptVal').textContent = fmt(mem.points);
      $('#tierVal').textContent = tierName(prog, mem.points);
      Wallet.save(w);
    }
  }
  function tierName(prog, pts) {
    let name = '—';
    (prog.tiers || []).forEach(t => { if (pts >= t[1]) name = t[0]; });
    return name;
  }
  function renderStats() {
    const s = state.stats;
    $('#statSpins').textContent = fmt(s.spins);
    $('#statWager').textContent = fmt(s.wagered);
    $('#statWon').textContent = fmt(s.won);
    $('#statBiggest').textContent = fmt(s.biggest);
    $('#statHit').textContent = s.spins ? (s.hits / s.spins * 100).toFixed(1) + '%' : '—';
    $('#statRTP').textContent = s.wagered ? (s.won / s.wagered * 100).toFixed(1) + '%' : '—';
    $('#statFS').textContent = fmt(s.fs);
    renderBank();
  }
  function renderJackpots() {
    const jp = state.jp;
    ['mini', 'minor', 'major', 'grand'].forEach(k => {
      if (typeof jp[k] !== 'number' || !isFinite(jp[k])) jp[k] = JP_SEED[k];
      const el = $('#jp-' + k);
      if (el) el.textContent = fmt(jp[k]);
      const el2 = $('#jp2-' + k);
      if (el2) el2.textContent = fmt(jp[k]);
    });
  }

  /* ---------------- 转轮动画 ---------------- */
  async function animate(finalGrid) {
    const host = $('#reels');
    const reels = $$('.reel', host);
    const timers = [];
    reels.forEach((reel, i) => {
      reel.classList.add('spin');
      const cells = $$('.cell', reel);
      const iv = setInterval(() => {
        cells.forEach(c => setCell(c, KEYS[Math.floor(Math.random() * KEYS.length)]));
      }, state.turbo ? 38 : 55);
      timers.push({ iv, cells, reel });
    });
    for (let i = 0; i < 5; i++) {
      await delay((state.turbo ? 85 : 165) * (i + 1));
      const t = timers[i];
      clearInterval(t.iv);
      t.reel.classList.remove('spin');
      t.cells.forEach((c, row) => setCell(c, finalGrid[i][row]));
      t.reel.classList.add('landed');
      setTimeout(() => t.reel.classList.remove('landed'), 340);
      tone(520 + i * 60, 0.04, 0.05);
    }
    await delay(120);
  }

  function clearHighlights() {
    $$('.cell.win').forEach(c => c.classList.remove('win'));
  }
  function highlight(wins) {
    const set = new Set();
    wins.forEach(w => (w.pos || []).forEach(p => set.add(p)));
    $$('.cell').forEach((c, i) => c.classList.toggle('win', set.has(i)));
  }

  /* ---------------- 音效 ---------------- */
  let AC = null;
  function tone(freq, dur, vol) {
    if (!prefs.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.value = vol || 0.03;
      o.connect(g); g.connect(AC.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + (dur || 0.08));
      o.stop(AC.currentTime + (dur || 0.08));
    } catch (e) {}
  }

  /* ---------------- 开转 ---------------- */
  function msg(html, cls) {
    const el = $('#slotMsg');
    if (!el) return;
    el.innerHTML = html || '&nbsp;';
    el.className = cls || '';
  }

  async function spin() {
    if (state.spinning) { state.auto = 0; return; }
    const m = machine();
    const bet = currentBet();
    const isFree = state.free > 0;
    if (!isFree && state.bank < bet) {
      state.auto = 0;
      msg('本金不足，先补充模拟筹码', 'lose');
      updateSpinBtn();
      return;
    }
    if (!isFree) {
      state.bank -= bet;
      localStorage.setItem(BANK_KEY, String(state.bank));
      state.stats.spins++;
      state.stats.wagered += bet;
      addTurnover(bet);
      addJackpot(bet);
    } else {
      state.free--;
      state.stats.spins++;
    }
    state.spinning = true;
    updateSpinBtn();
    clearHighlights();
    $('#winAmount').textContent = '0';
    $('#winAmount').classList.add('zero');

    const grid = drawGrid(m);
    await animate(grid);
    state.grid = grid;
    renderGrid(grid);

    const res = evaluate(grid, m, state.scale, bet);
    let win = res.win;
    if (isFree || state.free > 0) win *= state.fsMult;

    if (win > 0) {
      state.bank += win;
      localStorage.setItem(BANK_KEY, String(state.bank));
      state.stats.won += win;
      state.stats.hits++;
      state.stats.biggest = Math.max(state.stats.biggest, win);
      $('#winAmount').textContent = fmt(win);
      $('#winAmount').classList.remove('zero');
      highlight(res.wins);
      tone(880, 0.12, 0.05);
      msg(`<b>${fmt(win)}</b> MOP · ${res.wins.length} 组中奖` + (isFree ? ' · 免费游戏 ×2' : ''));
      if (win >= bet * 25) showBigWin(win, bet);
      setTimeout(clearHighlights, 2200);
    } else {
      msg(isFree ? `免费游戏剩余 ${state.free} 次` : '未中奖 · 再试一转');
    }

    /* 免费游戏：3 个以上 SCATTER */
    if (res.scatter >= 3) {
      if (isFree) {
        state.free += 5;
        msg(`<b>再触发 5 次免费游戏</b> · 剩余 ${state.free} 次`);
        showFsBanner();
      } else {
        state.free = 10;
        state.stats.fs += 10;
        msg('<b>FREE SPINS</b> · 10 次免费游戏，全奖 ×2');
        showFsBanner(true);
        await showFreeOverlay();
      }
    }
    renderJackpots();
    renderStats();

    /* 奖池触发 */
    checkJackpot(bet);

    state.spinning = false;
    updateSpinBtn();
    updateFsBanner();

    if (state.free > 0) {
      setTimeout(() => { if (!state.spinning) spin(); }, state.turbo ? 420 : 900);
    } else if (state.auto > 0) {
      state.auto--;
      if (state.auto > 0) {
        setTimeout(() => { if (!state.spinning) spin(); }, state.turbo ? 260 : 620);
      } else {
        const ab = $('#autoBtn');
        if (ab) { ab.textContent = '自动'; ab.classList.remove('on'); }
      }
      updateSpinBtn();
    }
  }

  function addTurnover(bet) {
    if (!Wallet) return;
    const w = Wallet.load();
    const prog = program();
    if (!prog) return;
    const mem = Wallet.memOf(w, venue().prog);
    mem.points += bet / (prog.mopPerPoint || 5000);
    mem.turnover += bet;
    mem.maxStake = Math.max(mem.maxStake || 0, bet);
    mem.dayTurnovers = mem.dayTurnovers || [];
    mem.dayTurnovers.push({ d: new Date().toISOString().slice(0, 10), v: bet });
    Wallet.trim(mem);
    Wallet.save(w);
  }
  function addJackpot(bet) {
    const share = bet * 0.005;
    ['mini', 'minor', 'major', 'grand'].forEach(k => { state.jp[k] = (state.jp[k] || JP_SEED[k]) + share; });
    saveJSON(JP_KEY, state.jp);
  }
  function checkJackpot(bet) {
    const order = ['grand', 'major', 'minor', 'mini'];
    for (const k of order) {
      if (Math.random() < JP_META[k].p) {
        const amount = state.jp[k] || JP_SEED[k];
        state.bank += amount;
        localStorage.setItem(BANK_KEY, String(state.bank));
        state.stats.won += amount;
        state.stats.jp = (state.stats.jp || 0) + amount;
        state.jp[k] = JP_SEED[k];
        saveJSON(JP_KEY, state.jp);
        showJackpot(k, amount);
        renderBank();
        renderJackpots();
        renderStats();
        return;
      }
    }
  }

  /* ---------------- 奖池 / 免费动画 ---------------- */
  function showBigWin(win, bet) {
    const layer = $('#bigWin');
    if (!layer) return;
    const tier = win >= bet * 200 ? '超级大奖' : win >= bet * 75 ? '巨奖' : '大奖';
    layer.innerHTML = `<div class="bigwin"><div class="l1">${tier} · BIG WIN</div>
      <div class="amt">${fmt(win)}</div><div class="l2">MOP · 本转 ${(win / bet).toFixed(1)} × 注额</div>
      <div class="coins">${Array.from({ length: 14 }, (_, i) =>
        `<i style="left:${(i * 7 + 4) % 96}%;animation-delay:${(i % 7) * 0.12}s"></i>`).join('')}</div></div>`;
    layer.classList.add('show');
    setTimeout(() => layer.classList.remove('show'), 1900);
  }
  function showJackpot(k, amount) {
    const layer = $('#bigWin');
    if (!layer) return;
    layer.innerHTML = `<div class="bigwin"><div class="l1">${JP_META[k].name} · JACKPOT</div>
      <div class="amt">${fmt(amount)}</div><div class="l2">MOP · 累积奖池命中 · 已计入本金</div>
      <div class="coins">${Array.from({ length: 18 }, (_, i) =>
        `<i style="left:${(i * 5 + 3) % 96}%;animation-delay:${(i % 9) * 0.1}s"></i>`).join('')}</div></div>`;
    layer.classList.add('show');
    setTimeout(() => layer.classList.remove('show'), 2600);
  }
  function showFreeOverlay() {
    const layer = $('#bigWin');
    if (!layer) return Promise.resolve();
    layer.innerHTML = `<div class="bigwin"><div class="l1">FREE SPINS</div>
      <div class="amt">10</div><div class="l2">免费游戏 · 全部奖分 ×2 · 可再触发 +5</div></div>`;
    layer.classList.add('show');
    return delay(1400).then(() => layer.classList.remove('show'));
  }
  function showFsBanner(first) {
    const el = $('#fsBanner');
    if (!el) return;
    el.textContent = first ? 'FREE SPINS · 10 次 · 全奖 ×2' : 'FREE SPINS · 再触发 +5';
    el.classList.add('show');
  }
  function updateFsBanner() {
    const el = $('#fsBanner');
    if (!el) return;
    if (state.free > 0) {
      el.textContent = `FREE SPINS · 剩余 ${state.free} 次 · ×2`;
      el.classList.add('show');
    } else el.classList.remove('show');
  }

  /* ---------------- 控制 ---------------- */
  function updateSpinBtn() {
    const b = $('#spinBtn');
    if (!b) return;
    if (state.spinning) { b.textContent = '转轮中…'; b.disabled = true; return; }
    b.disabled = false;
    if (state.auto > 0 || state.free > 0) { b.textContent = '停 止'; b.classList.add('stop'); }
    else { b.textContent = '开 始'; b.classList.remove('stop'); }
  }

  function bind() {
    $('#grpSel').addEventListener('change', e => {
      if (state.spinning) { e.target.value = state.group; return msg('转轮停止后再换集团'); }
      state.group = e.target.value;
      const first = CASINOS.findIndex(c => c.prog === state.group);
      state.venue = first < 0 ? 0 : first;
      prefs.group = state.group;
      prefs.venue = state.venue;
      saveJSON(PREF_KEY, prefs);
      renderVenue();
      renderMachine();
      msg(`${venue().name} · 机台已切换`);
    });
    $('#venueSel').addEventListener('change', e => {
      if (state.spinning) { e.target.value = state.venue; return msg('转轮停止后再换场馆'); }
      state.venue = +e.target.value;
      state.group = venue().prog;
      prefs.venue = state.venue;
      prefs.group = state.group;
      saveJSON(PREF_KEY, prefs);
      renderGroup();
      renderVenue();
      renderMachine();
      msg(`${venue().name} · 机台已切换`);
    });
    $('#betMinus').addEventListener('click', () => {
      if (state.spinning) return;
      state.betIdx = Math.max(0, state.betIdx - 1);
      prefs.betIdx = state.betIdx; saveJSON(PREF_KEY, prefs); renderBet();
    });
    $('#betPlus').addEventListener('click', () => {
      if (state.spinning) return;
      const lv = betLevels(machine());
      state.betIdx = Math.min(lv.length - 1, state.betIdx + 1);
      prefs.betIdx = state.betIdx; saveJSON(PREF_KEY, prefs); renderBet();
    });
    $('#spinBtn').addEventListener('click', () => {
      if (state.spinning) { state.auto = 0; state.free = 0; updateSpinBtn(); updateFsBanner(); return; }
      if (state.auto > 0 || state.free > 0) { state.auto = 0; state.free = 0; updateSpinBtn(); updateFsBanner(); msg('已停止自动旋转'); return; }
      spin();
    });
    $('#autoBtn').addEventListener('click', () => {
      if (state.spinning) return;
      if (state.auto === 0) state.auto = 10;
      else if (state.auto === 10) state.auto = 25;
      else if (state.auto === 25) state.auto = 50;
      else if (state.auto === 50) state.auto = 100;
      else state.auto = 0;
      $('#autoBtn').textContent = state.auto ? `自动 ×${state.auto}` : '自动';
      $('#autoBtn').classList.toggle('on', state.auto > 0);
      updateSpinBtn();
      if (state.auto > 0) spin();
    });
    $('#turboBtn').addEventListener('click', () => {
      state.turbo = !state.turbo;
      prefs.turbo = state.turbo; saveJSON(PREF_KEY, prefs);
      $('#turboBtn').classList.toggle('on', state.turbo);
      $('#turboBtn').textContent = state.turbo ? '极速 · 开' : '极速';
    });
    $('#soundBtn').addEventListener('click', () => {
      prefs.sound = !prefs.sound; saveJSON(PREF_KEY, prefs);
      $('#soundBtn').classList.toggle('on', !!prefs.sound);
      $('#soundBtn').textContent = prefs.sound ? '音效 · 开' : '音效';
      if (prefs.sound) tone(660, 0.08, 0.04);
    });
    $('#payBtn').addEventListener('click', () => { buildPaytable(); $('#payModal').classList.add('show'); });
    $('#payClose').addEventListener('click', () => $('#payModal').classList.remove('show'));
    $('#payModal').addEventListener('click', e => {
      if (e.target === $('#payModal')) $('#payModal').classList.remove('show');
    });
    $('#addBank').addEventListener('click', () => {
      if (!confirm('补充 50,000 MOP 模拟筹码？')) return;
      state.bank += 50000;
      localStorage.setItem(BANK_KEY, String(state.bank));
      renderBank();
      msg('已补充 50,000 MOP 模拟筹码');
    });
    $('#resetBank').addEventListener('click', () => {
      if (!confirm('重置本金为 100,000 MOP？')) return;
      state.bank = 100000;
      localStorage.setItem(BANK_KEY, String(state.bank));
      renderBank();
      msg('本金已重置为 100,000 MOP');
    });
    $('#demoJp').addEventListener('click', () => showJackpot('grand', state.jp.grand || JP_SEED.grand));
    $('#fsBtn').addEventListener('click', () => {
      const el = $('.cab');
      if (!document.fullscreenElement) el.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
    const fsin = $('#fsExitIn');
    if (fsin) fsin.addEventListener('click', () => document.exitFullscreen?.());
    document.addEventListener('fullscreenchange', () => {
      $('#fsBtn').textContent = document.fullscreenElement ? '退出全屏' : '全屏';
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !state.spinning && !state.auto && !state.free) spin();
      if (e.key === ' ' && !state.spinning) { e.preventDefault(); spin(); }
    });
  }

  /* ---------------- 赔率表 ---------------- */
  function buildPaytable() {
    const m = machine();
    const pay = m.mode === 'ways' ? PAY_WAYS : PAY_LINES;
    const sc = state.scale || 1;
    const v = x => +(x * sc).toFixed(x * sc >= 100 ? 0 : 1);
    const nameMap = { D: '龙', JADE: '玉', CAI: '财', XI: '囍', LANTERN: '灯', A: 'A', K: 'K', Q: 'Q', TEN: '10', W: '百搭', S: '彩金' };
    const box = $('#payGrid');
    if (!box) return;
    box.innerHTML = Object.keys(pay).map(k =>
      `<div class="payitem"><div class="pic">${SYM[k].glyph}</div><div class="inf">
        <b>${nameMap[k]} · ${SYM[k].label}</b>
        <small>3 连 ×${v(pay[k][3])} · 4 连 ×${v(pay[k][4])} · 5 连 ×${v(pay[k][5])}</small></div></div>`
    ).join('') + `<div class="payitem"><div class="pic">彩</div><div class="inf">
      <b>彩金 · SCATTER</b><small>3 个 ×${v(SCATTER_PAY[3])} · 4 个 ×${v(SCATTER_PAY[4])} · 5 个 ×${v(SCATTER_PAY[5])} · 3 个触发 10 次免费游戏</small></div></div>`;
    $('#payTitle').textContent = `${m.name} · ${m.en}`;
    $('#paySub').textContent = `${venue().name} · ${m.mode === 'ways' ? '243 WAYS' : m.lines + ' LINES'} · 理论 RTP ${effectiveRTP(m).toFixed(1)}% · 波动 ${m.vol}`;
    $('#payRule').innerHTML = `赔付按注额计（已按机台 RTP 校准，显示为校准后的实际赔率）：${m.mode === 'ways'
      ? '243 ways 机台每条 way 的赔率见上表，实际派彩 = 单 way 赔率 × 命中 way 数。'
      : `${m.lines} 线机台按「总注 ÷ ${m.lines}」为每条线注，上表赔率乘线注。`}
      免费游戏期间全部奖分 ×2，3 个彩金可再触发 +5 次。累积奖池由每注 2% 累积，触发概率极低，为独立事件。`;
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    if (!CASINOS.length) return;
    state.machineId = prefs.machineId || (PROG_MACHINES[venue().prog] || ['dragon'])[0];
    renderGroup();
    renderVenue();
    $('#turboBtn').classList.toggle('on', state.turbo);
    $('#turboBtn').textContent = state.turbo ? '极速 · 开' : '极速';
    $('#soundBtn').textContent = prefs.sound ? '音效 · 开' : '音效';
    $('#soundBtn').classList.toggle('on', !!prefs.sound);
    ['mini', 'minor', 'major', 'grand'].forEach(k => {
      if (typeof state.jp[k] !== 'number' || !isFinite(state.jp[k])) state.jp[k] = JP_SEED[k];
    });
    bind();
    renderMachine();
    renderBank();
    updateSpinBtn();
    msg('选择场馆与机台，调整每转注额，然后按「开始」。3 个彩金触发 10 次免费游戏。');
  }

  window.SLOT = { state, spin, _eval: evaluate, _machines: MACHINES, _cal: calibrate };
  document.addEventListener('DOMContentLoaded', boot);
})();