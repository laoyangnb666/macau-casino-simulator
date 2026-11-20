/* ============================================================
   baccarat.js — 澳门百家乐（Punto Banco）台面逻辑
   · 8 副牌靴 / 销牌 / 补牌规则 / 庄抽 5% 或免佣（庄 6 赔半）
   · 闲、庄、和、闲对、庄对、幸运 6
   · 珠盘路与大路
   · 有效投注同步写入六套会员体系（与 21 点共用钱包）
   ============================================================ */
(function () {
  'use strict';

  const BJ = window.BJ_CASINOS || {};
  const CASINOS = BJ.casinos || [];
  const PROGRAMS = BJ.programs || {};
  const Wallet = window.BJWallet;
  /* 人生模式：本金来自人生现金，每局净输赢实时回写人生存档 */
  const LIFE = !!(window.BJLifeBridge && window.BJLifeBridge.active);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const fmt = n => Math.round(n).toLocaleString('zh-CN');
  const money = n => 'MOP ' + fmt(n);

  /* ---------------- 场馆基础口径 ---------------- */
  const PROG_BASE = {
    sands:  { min: 500,  nocomm: false, lucky6: false, note: '中场标准庄抽水 5%，洗牌机发牌；高额区与贵宾厅偶有免佣台' },
    galaxy: { min: 500,  nocomm: false, lucky6: false, note: '标准庄抽水 5%，8 副牌靴，中场台数密集' },
    wynn:   { min: 1000, nocomm: false, lucky6: true,  note: '标准庄抽水，贵宾厅可咪牌；高额台最低注偏高' },
    mgm:    { min: 500,  nocomm: false, lucky6: true,  note: '标准庄抽水，幸运 6 附加注常开' },
    melco:  { min: 500,  nocomm: true,  lucky6: true,  note: '免佣台比例高：庄以 6 点胜出只赔一半' },
    sjm:    { min: 100,  nocomm: true,  lucky6: false, note: '半岛老场最低注门槛低，普通场多见免佣台' }
  };
  const VENUE_OVERRIDE = {
    venetian:     { min: 500,  lucky6: false },
    parisian:     { min: 500 },
    londoner:     { min: 500 },
    sands:        { min: 300 },
    plaza:        { min: 1000, nocomm: true, lucky6: true, squeeze: true },
    galaxy:       { min: 500 },
    starworld:    { min: 500, squeeze: true },
    broadway:     { min: 200, nocomm: true },
    wynn:         { min: 1000, lucky6: true, squeeze: true },
    'wynn-palace':{ min: 1000, lucky6: true, squeeze: true },
    mgm:          { min: 500, lucky6: true },
    'mgm-cotai':  { min: 500, lucky6: true },
    cod:          { min: 500, nocomm: true, lucky6: true },
    studio:       { min: 300, nocomm: true },
    altira:       { min: 1000, nocomm: true, lucky6: true, squeeze: true },
    'grand-lisboa':{ min: 200, nocomm: true, lucky6: false },
    'lisboa-palace':{ min: 500, nocomm: false, lucky6: true },
    lisboa:       { min: 100, nocomm: true },
    larc:         { min: 100, nocomm: true },
    oceanus:      { min: 300, nocomm: true },
    ponte16:      { min: 100, nocomm: false, note: '卫星场只开标准庄抽水台' }
  };
  const ROOMS = [
    { id: 'general', name: '普通场', mul: 1,   vip: false, desc: '娱乐场楼层' },
    { id: 'main',    name: '中场',   mul: 2,   vip: false, desc: '主赌厅' },
    { id: 'high',    name: '高额区', mul: 10,  vip: false, desc: '高限红台' },
    { id: 'vip',     name: '贵宾厅', mul: 40,  vip: true,  desc: '邀约制' },
    { id: 'private', name: '私人厅', mul: 100, vip: true,  desc: '独立包房' }
  ];
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

  /* ---------------- 本地状态 ---------------- */
  const BANK_KEY = 'bac.bank.v1';
  const PREF_KEY = 'bac.pref.v1';
  const bank = LIFE ? Math.max(0, window.BJLifeBridge.bank()) : loadNum(BANK_KEY, 200000);
  let prefs = loadJSON(PREF_KEY) || { venue: 0, room: 0, mode: 'comm', lucky6: false, last: null };

  function loadNum(k, d) {
    const raw = localStorage.getItem(k);
    if (raw === null || raw === '') return d;
    const n = +raw;
    return isFinite(n) && n > 0 ? n : d;
  }
  function loadJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function saveNum(k, v) {
    /* 人生模式的台面余额属于人生存档，不写普通模式的本金键 */
    if (LIFE && k === BANK_KEY) return;
    try { localStorage.setItem(k, String(Math.round(v))); } catch (e) {}
  }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  const state = {
    venue: Math.max(0, Math.min(CASINOS.length - 1, prefs.venue | 0)),
    group: prefs.group || CASINOS[Math.max(0, Math.min(CASINOS.length - 1, prefs.venue | 0))].prog,
    room: Math.max(0, Math.min(ROOMS.length - 1, prefs.room | 0)),
    mode: prefs.mode === 'nocomm' ? 'nocomm' : 'comm',
    lucky6On: !!prefs.lucky6,
    bank: bank,
    bets: { p: 0, b: 0, t: 0, pp: 0, bp: 0, l6: 0 },
    chip: 100,
    shoe: [], discard: 0, shoeNo: 1,
    player: [], banker: [],
    phase: 'bet',
    result: null,
    history: [],
    stats: { rounds: 0, p: 0, b: 0, t: 0, pp: 0, bp: 0, l6: 0, wagered: 0, commission: 0, net: 0, biggest: 0 },
    lastBets: null
  };

  /* ---------------- 工具 ---------------- */
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const rankValue = r => (r >= 9 ? 0 : r + 1); // A=1 … 9=9, 10/J/Q/K=0
  const total = cards => cards.reduce((s, c) => s + rankValue(c.r), 0) % 10;
  const isRed = s => s === 1 || s === 2;
  const delay = ms => new Promise(r => setTimeout(r, ms));

  function venue() { return CASINOS[state.venue]; }
  function room() { return ROOMS[state.room]; }
  function program() { return PROGRAMS[venue().prog] || null; }

  function tableCfg() {
    const base = PROG_BASE[venue().prog] || PROG_BASE.sands;
    const ov = VENUE_OVERRIDE[venue().id] || {};
    const min = Math.max(50, Math.round(((ov.min || base.min) * room().mul) / 50) * 50);
    const max = Math.round(min * 300);
    const nocomm = ov.nocomm !== undefined ? ov.nocomm : base.nocomm;
    const lucky6 = ov.lucky6 !== undefined ? ov.lucky6 : base.lucky6;
    return {
      min, max, nocomm, lucky6,
      decks: 8, pen: 0.82,
      squeeze: !!room().vip && !!(ov.squeeze || venue().prog === 'wynn' || venue().prog === 'melco'),
      note: ov.note || base.note,
      commission: state.mode === 'nocomm' && nocomm ? 0 : 0.05
    };
  }

  /* ---------------- 牌靴 ---------------- */
  function newShoe(cfg) {
    const cards = [];
    for (let d = 0; d < cfg.decks; d++) {
      for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) cards.push({ r, s });
    }
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    state.shoe = cards;
    state.discard = 0;
    // 销牌：首张牌面值决定销几张（公牌按 10 张计）
    const burnCard = state.shoe.shift();
    const burn = burnCard.r >= 9 ? 10 : burnCard.r + 1;
    for (let i = 0; i < burn; i++) state.shoe.shift();
    state.discard += burn + 1;
  }
  function ensureShoe(cfg) {
    if (!state.shoe.length || state.shoe.length < 16) {
      if (state.shoe.length) state.shoeNo++;
      newShoe(cfg);
      renderShoe(cfg);
      return true;
    }
    return false;
  }
  function draw() { return state.shoe.shift(); }

  /* ---------------- 补牌规则 ---------------- */
  function playerDraws(pt) { return pt <= 5; }
  function bankerDraws(bt, playerThird) {
    if (playerThird === null) return bt <= 5;
    const t = rankValue(playerThird.r);
    if (bt <= 2) return true;
    if (bt === 3) return t !== 8;
    if (bt === 4) return t >= 2 && t <= 7;
    if (bt === 5) return t >= 4 && t <= 7;
    if (bt === 6) return t === 6 || t === 7;
    return false;
  }

  /* ---------------- 渲染 ---------------- */
  function renderGroupSelect() {
    const sel = $('#grpSel');
    if (!sel) return;
    sel.innerHTML = GROUP_ORDER.map(g =>
      `<option value="${g}"${g === state.group ? ' selected' : ''}>${groupLabel(g)}</option>`).join('');
  }
  function renderVenueSelect() {
    const sel = $('#venueSel');
    if (!sel) return;
    sel.innerHTML = CASINOS.map((c, i) => ({ c, i }))
      .filter(x => x.c.prog === state.group)
      .map(x => `<option value="${x.i}"${x.i === state.venue ? ' selected' : ''}>${x.c.name} ${VENUE_EN[x.c.id] || ''}</option>`)
      .join('');
  }
  function renderRoomSelect() {
    const sel = $('#roomSel');
    if (!sel) return;
    sel.innerHTML = ROOMS.map((r, i) =>
      `<option value="${i}"${i === state.room ? ' selected' : ''}>${r.name} · ${r.desc}${r.vip ? '（模拟开放）' : ''}</option>`).join('');
  }
  function renderModeSelect() {
    const cfg = tableCfg();
    const sel = $('#modeSel');
    if (!sel) return;
    sel.innerHTML = `<option value="comm">标准 · 庄赢抽水 5%</option>` +
      (cfg.nocomm ? `<option value="nocomm">免佣 · 庄 6 点只赔一半</option>` : '');
    if (state.mode === 'nocomm' && !cfg.nocomm) state.mode = 'comm';
    sel.value = state.mode;
    const l6 = $('#lucky6Wrap');
    if (l6) l6.style.display = cfg.lucky6 ? '' : 'none';
    const l6c = $('#lucky6Chk');
    if (l6c) l6c.checked = state.lucky6On && cfg.lucky6;
  }
  function renderShoe(cfg) {
    const rem = state.shoe.length;
    const totalCards = cfg.decks * 52;
    const pct = Math.max(2, Math.round(rem / totalCards * 100));
    const stack = $('#shoeStack');
    if (stack) stack.style.height = pct + '%';
    const sh = $('#shoeNo');
    if (sh) sh.textContent = '#' + String(state.shoeNo).padStart(3, '0');
    const info = $('#penInfo');
    if (info) info.textContent = rem + ' 张';
    const disc = $('#discardBar');
    if (disc) disc.style.height = Math.min(96, Math.max(4, state.discard / totalCards * 100)) + '%';
  }
  function renderTableInfo() {
    const cfg = tableCfg();
    const v = venue();
    $('#tblMin').textContent = fmt(cfg.min);
    $('#tblMax').textContent = fmt(cfg.max);
    $('#tblDecks').textContent = cfg.decks + ' 副';
    $('#tblMode').textContent = state.mode === 'nocomm' && cfg.nocomm ? '免佣' : '抽水 5%';
    $('#tblName').textContent = v.name;
    $('#tblRoom').textContent = room().name;
    $('#tableNote').textContent = cfg.note;
    const vn = $('#venueName'), rn = $('#roomName');
    if (vn) vn.textContent = v.name;
    if (rn) rn.textContent = room().name;
    $('#felt') && $('#felt').classList.toggle('vip', room().vip);
    const sq = $('#squeezeTag');
    if (sq) sq.style.display = cfg.squeeze ? '' : 'none';
  }
  function renderBank() {
    $('#bankVal').textContent = fmt(state.bank);
    $('#statNet').textContent = (state.stats.net >= 0 ? '+' : '') + fmt(state.stats.net);
    $('#statNet').style.color = state.stats.net >= 0 ? '#BFE7C9' : '#F0C0C0';
    const prog = program();
    if (prog && Wallet) {
      const w = Wallet.load();
      const m = Wallet.memOf(w, venue().prog);
      $('#ptVal').textContent = fmt(m.points);
      $('#tierVal').textContent = tierName(prog, m.points);
      Wallet.save(w);
    }
  }
  function tierName(prog, pts) {
    let name = '—';
    (prog.tiers || []).forEach(t => { if (pts >= t[1]) name = t[0]; });
    return name;
  }
  function renderBets() {
    let totalB = 0;
    ['p', 'b', 't', 'pp', 'bp', 'l6'].forEach(k => {
      const el = $('#stk-' + k);
      if (el) {
        const v = state.bets[k];
        el.textContent = v ? fmt(v) : '';
        el.classList.toggle('on', v > 0);
      }
      const spot = document.querySelector(`.betspot[data-bet="${k}"]`);
      if (spot) spot.classList.toggle('on', state.bets[k] > 0);
      totalB += state.bets[k];
    });
    $('#betTotal').textContent = fmt(totalB);
    const btn = $('#dealBtn');
    if (btn) btn.disabled = state.phase !== 'bet' || totalB <= 0;
  }
  function renderStats() {
    const s = state.stats;
    $('#statRounds').textContent = fmt(s.rounds);
    $('#statP').textContent = fmt(s.p);
    $('#statB').textContent = fmt(s.b);
    $('#statT').textContent = fmt(s.t);
    $('#statPP').textContent = fmt(s.pp);
    $('#statBP').textContent = fmt(s.bp);
    $('#statWager').textContent = fmt(s.wagered);
    $('#statComm').textContent = fmt(s.commission);
    $('#statBiggest').textContent = fmt(s.biggest);
  }
  function cardHTML(c, hidden) {
    if (hidden) return `<div class="pcard back"></div>`;
    return `<div class="pcard${isRed(c.s) ? ' red' : ''}">
      <span class="cor tl">${RANKS[c.r]}<small>${SUITS[c.s]}</small></span>
      <span class="pip">${SUITS[c.s]}</span>
      <span class="cor br">${RANKS[c.r]}<small>${SUITS[c.s]}</small></span></div>`;
  }
  function renderHands() {
    const pc = $('#playerCards'), bc = $('#dealerCards');
    if (pc) pc.innerHTML = state.player.map(c => cardHTML(c)).join('');
    if (bc) bc.innerHTML = state.banker.map(c => cardHTML(c)).join('');
    $('#pTotal') && ($('#pTotal').textContent = state.player.length ? total(state.player) : '—');
    $('#bTotal') && ($('#bTotal').textContent = state.banker.length ? total(state.banker) : '—');
  }

  /* ---------------- 大路 / 珠盘 ---------------- */
  function buildBigRoad(history) {
    const cols = [];
    history.forEach(h => {
      if (h.result === 'T') {
        if (cols.length) {
          const col = cols[cols.length - 1];
          col[col.length - 1].ties = (col[col.length - 1].ties || 0) + 1;
        }
        return;
      }
      const last = cols[cols.length - 1];
      if (!last || last[0].r !== h.result || last.length >= 6) {
        cols.push([{ r: h.result, ties: 0 }]);
      } else {
        last.push({ r: h.result, ties: 0 });
      }
    });
    return cols;
  }
  function renderRoads() {
    const bead = $('#beadGrid');
    if (bead) {
      const last = state.history.slice(-60);
      bead.innerHTML = last.map(h => {
        const cls = h.result === 'P' ? 'p' : h.result === 'B' ? 'b' : 't';
        const label = h.result === 'P' ? '闲' : h.result === 'B' ? '庄' : '和';
        return `<span class="bead ${cls}" title="${label} ${h.pt}-${h.bt}">${label}</span>`;
      }).join('') || '<span class="roadempty">尚无牌局</span>';
    }
    const road = $('#bigRoad');
    if (!road) return;
    const cols = buildBigRoad(state.history.slice(-120));
    road.innerHTML = cols.map((col, ci) => col.map((cell, ri) => {
      const cls = cell.r === 'P' ? 'p' : 'b';
      const tie = cell.ties ? `<i class="tie-dot" title="和 ${cell.ties} 次"></i>` : '';
      return `<div class="bcell" style="grid-row:${ri + 1};grid-column:${ci + 1}"><span class="bh ${cls}">${cell.r === 'P' ? '闲' : '庄'}</span>${tie}</div>`;
    }).join('')).join('') || '<span class="roadempty">开牌后自动生成大路</span>';
    const st = state.stats;
    const totalR = st.p + st.b + st.t;
    $('#roadMeta').textContent = `庄 ${st.b} · 闲 ${st.p} · 和 ${st.t}` + (totalR ? `（${fmt(Math.round(st.p / totalR * 100))}% / ${fmt(Math.round(st.b / totalR * 100))}% / ${fmt(Math.round(st.t / totalR * 100))}%）` : '');
  }

  /* ---------------- 下注 ---------------- */
  function addBet(kind, amount) {
    if (state.phase !== 'bet') return;
    const cfg = tableCfg();
    const cur = ['p', 'b', 't', 'pp', 'bp', 'l6'].reduce((s, x) => s + state.bets[x], 0);
    if (cur + amount > state.bank) return msg('本金不足，先补充筹码', 'lose');
    if (cur + amount > cfg.max) return msg(`本台单局上限 ${fmt(cfg.max)}`, 'lose');
    state.bets[kind] += amount;
    renderBets();
    msg('');
  }
  function clearBets() {
    if (state.phase !== 'bet') return;
    ['p', 'b', 't', 'pp', 'bp', 'l6'].forEach(k => state.bets[k] = 0);
    renderBets();
  }
  function repeatBets() {
    if (state.phase !== 'bet' || !state.lastBets) return;
    state.bets = { ...state.lastBets };
    renderBets();
    msg('已重复上一局注码');
  }
  function undoBet() {
    if (state.phase !== 'bet') return;
    const keys = ['p', 'b', 't', 'pp', 'bp', 'l6'].filter(k => state.bets[k] > 0);
    if (!keys.length) return;
    const k = keys[keys.length - 1];
    state.bets[k] = Math.max(0, state.bets[k] - state.chip);
    renderBets();
  }

  /* ---------------- 开牌 ---------------- */
  async function deal() {
    const cfg = tableCfg();
    const stake = ['p', 'b', 't', 'pp', 'bp', 'l6'].reduce((s, x) => s + state.bets[x], 0);
    if (!stake) return msg('先在台面上下注');
    if (state.bank < stake) return msg('本金不足，先补充筹码', 'lose');
    if (stake < cfg.min) return msg(`本台最低注 ${fmt(cfg.min)}，当前 ${fmt(stake)}`, 'lose');
    if (stake > cfg.max) return msg(`本台单局上限 ${fmt(cfg.max)}`, 'lose');

    state.phase = 'dealing';
    state.bank -= stake;
    saveNum(BANK_KEY, state.bank);
    state.lastBets = { ...state.bets };
    renderBank();
    renderBets();

    const cf = tableCfg();
    const shuffled = ensureShoe(cf);
    state.player = [];
    state.banker = [];
    state.result = null;
    renderHands();
    $('#resultBadge') && ($('#resultBadge').className = 'bac-result');
    $('#resultBadge') && ($('#resultBadge').textContent = '');
    msg(shuffled ? `换新牌靴 #${state.shoeNo} · 已按首张牌销牌` : '发牌中…');

    const slow = cfg.squeeze ? 220 : 90;
    const face = c => `<span class="cor tl">${RANKS[c.r]}<small>${SUITS[c.s]}</small></span>
        <span class="pip">${SUITS[c.s]}</span>
        <span class="cor br">${RANKS[c.r]}<small>${SUITS[c.s]}</small></span>`;
    const reveal = (el, c) => {
      el.classList.remove('back', 'enter');
      el.className = 'pcard flip' + (isRed(c.s) ? ' red' : '');
      el.innerHTML = face(c);
    };
    const dealOne = async (who) => {
      const c = draw();
      if (!c) return;
      const host = who === 'P' ? $('#playerCards') : $('#dealerCards');
      const el = document.createElement('div');
      el.className = 'pcard back enter';
      host.appendChild(el);
      await delay(slow);
      reveal(el, c);
      (who === 'P' ? state.player : state.banker).push(c);
      renderTotals();
      await delay(slow * 0.5);
    };
    const renderTotals = () => {
      $('#pTotal').textContent = state.player.length ? total(state.player) : '—';
      $('#bTotal').textContent = state.banker.length ? total(state.banker) : '—';
    };

    await dealOne('P'); await dealOne('B');
    await dealOne('P'); await dealOne('B');

    let pt = total(state.player), bt = total(state.banker);
    renderTotals();

    if (pt >= 8 || bt >= 8) {
      msg('天生赢家 · 不再补牌');
    } else {
      let playerThird = null;
      if (playerDraws(pt)) {
        await delay(slow);
        playerThird = draw();
        state.player.push(playerThird);
        const host = $('#playerCards');
        const el = document.createElement('div');
        el.className = 'pcard back enter';
        host.appendChild(el);
        await delay(slow * 0.8);
        reveal(el, playerThird);
        renderTotals();
        msg(`闲补第三张：${RANKS[playerThird.r]}${SUITS[playerThird.s]}`);
      }
      pt = total(state.player);
      bt = total(state.banker);
      if (bankerDraws(bt, playerThird)) {
        await delay(slow);
        const bc = draw();
        state.banker.push(bc);
        const host = $('#dealerCards');
        const el = document.createElement('div');
        el.className = 'pcard back enter';
        host.appendChild(el);
        await delay(slow * 0.8);
        reveal(el, bc);
        renderTotals();
        msg(`庄补第三张：${RANKS[bc.r]}${SUITS[bc.s]}`);
      }
    }

    pt = total(state.player); bt = total(state.banker);
    renderTotals();
    const result = pt > bt ? 'P' : bt > pt ? 'B' : 'T';
    const pp = state.player.length >= 2 && state.player[0].r === state.player[1].r;
    const bp = state.banker.length >= 2 && state.banker[0].r === state.banker[1].r;
    const lucky6 = result === 'B' && bt === 6;

    settle(result, pt, bt, pp, bp, lucky6, stake, cfg);
  }

  /* ---------------- 结算 ---------------- */
  function settle(result, pt, bt, pp, bp, l6, stake, cfg) {
    const b = state.bets;
    let ret = 0, comm = 0, net = 0;
    const parts = [];

    if (b.p) {
      if (result === 'P') { ret += b.p * 2; net += b.p; }
      else if (result === 'T') { ret += b.p; }
      else net -= b.p;
    }
    if (b.b) {
      if (result === 'B') {
        if (state.mode === 'nocomm' && cfg.nocomm && bt === 6) {
          const profit = b.b * 0.5;
          ret += b.b + profit; net += profit; comm += 0;
          parts.push(`免佣台庄以 6 点胜出 · 只赔一半`);
        } else {
          const profit = b.b * (1 - cfg.commission);
          ret += b.b + profit; net += profit; comm += b.b * cfg.commission;
          parts.push(`庄赢 · 抽水 5%`);
        }
      } else if (result === 'T') { ret += b.b; }
      else net -= b.b;
    }
    if (b.t) {
      if (result === 'T') { ret += b.t * 9; net += b.t * 8; }
      else net -= b.t;
    }
    if (b.pp) {
      if (pp) { ret += b.pp * 12; net += b.pp * 11; }
      else net -= b.pp;
    }
    if (b.bp) {
      if (bp) { ret += b.bp * 12; net += b.bp * 11; }
      else net -= b.bp;
    }
    if (b.l6) {
      if (l6) {
        const rate = state.banker.length === 2 ? 12 : 20;
        ret += b.l6 * (rate + 1); net += b.l6 * rate;
        parts.push(`幸运 6 · ${state.banker.length === 2 ? '两张' : '三张'} · ${rate}:1`);
      } else net -= b.l6;
    }

    state.bank += ret;
    saveNum(BANK_KEY, state.bank);
    /* 人生模式：台面余额与净输赢实时回写人生现金 */
    if (LIFE) window.BJLifeBridge.sync('bac', state.bank, net, stake);

    const s = state.stats;
    s.rounds++; s.wagered += stake; s.commission += comm; s.net += net;
    s.biggest = Math.max(s.biggest, net > 0 ? net : 0);
    if (result === 'P') s.p++; else if (result === 'B') s.b++; else s.t++;
    if (pp) s.pp++;
    if (bp) s.bp++;
    if (l6) s.l6++;

    /* 终身统计：会员中心分游戏数据源 */
    if (window.BJStats) {
      window.BJStats.add('bac', {
        rounds: 1, wagered: stake, net: net, commission: comm,
        p: result === 'P' ? 1 : 0, b: result === 'B' ? 1 : 0, t: result === 'T' ? 1 : 0,
        pp: pp ? 1 : 0, bp: bp ? 1 : 0, l6: l6 ? 1 : 0
      }, { biggest: net > 0 ? net : 0 });
    }

    state.history.push({ result, pt, bt, pp, bp, l6, cards: state.banker.length });
    if (state.history.length > 300) state.history = state.history.slice(-300);

    /* 会员积分：有效投注累计，六家共用同一钱包 */
    if (Wallet) {
      const w = Wallet.load();
      const m = Wallet.memOf(w, venue().prog);
      const prog = program();
      if (prog) {
        m.points += stake / (prog.mopPerPoint || 5000);
        m.turnover += stake;
        m.maxStake = Math.max(m.maxStake || 0, stake);
        m.dayTurnovers = m.dayTurnovers || [];
        m.dayTurnovers.push({ d: new Date().toISOString().slice(0, 10), v: stake });
        Wallet.trim(m);
        Wallet.save(w);
      }
    }

    const cls = result === 'P' ? 'player' : result === 'B' ? 'banker' : 'tie';
    const zh = result === 'P' ? '闲赢' : result === 'B' ? '庄赢' : '和局';
    const badge = $('#resultBadge');
    if (badge) {
      badge.className = 'bac-result show ' + cls;
      badge.innerHTML = `<b>${zh}</b><span>闲 ${pt} · 庄 ${bt}</span>`;
    }

    const netTxt = net > 0 ? `+${fmt(net)}` : net < 0 ? fmt(net) : '0';
    msg(`${zh} · 闲 ${pt} 点 / 庄 ${bt} 点 · 本局 <b>${netTxt}</b> MOP` + (parts.length ? ' · ' + parts.join(' · ') : ''), net > 0 ? 'win' : net < 0 ? 'lose' : '');

    renderBank(); renderStats(); renderRoads(); renderShoe(cfg);

    state.bets = { p: 0, b: 0, t: 0, pp: 0, bp: 0, l6: 0 };
    state.phase = 'bet';
    state.player = []; state.banker = [];
    renderBets();
    setTimeout(() => {
      renderHands();
      if (badge) badge.className = 'bac-result';
    }, 2600);

    if (state.bank <= 0) msg('本金已耗尽，点击侧栏「补充筹码」继续模拟', 'lose');
  }

  /* ---------------- UI ---------------- */
  function msg(html, cls) {
    const el = $('#bacMsg');
    if (!el) return;
    el.className = 'bac-msg' + (cls ? ' ' + cls : '');
    el.innerHTML = html || '&nbsp;';
  }

  function renderSummary() {
    renderTableInfo();
    renderBank();
    renderStats();
    renderBets();
    renderRoads();
    renderShoe(tableCfg());
  }

  function bind() {
    $('#grpSel').addEventListener('change', e => {
      state.group = e.target.value;
      const first = CASINOS.findIndex(c => c.prog === state.group);
      state.venue = first < 0 ? 0 : first;
      prefs.group = state.group;
      prefs.venue = state.venue;
      prefs.mode = 'comm';
      state.mode = 'comm';
      saveJSON(PREF_KEY, prefs);
      state.shoe = [];
      renderVenueSelect();
      renderModeSelect();
      ensureShoe(tableCfg());
      renderSummary();
    });
    $('#venueSel').addEventListener('change', e => {
      state.venue = +e.target.value;
      state.group = venue().prog;
      prefs.venue = state.venue;
      prefs.group = state.group;
      prefs.mode = 'comm';
      state.mode = 'comm';
      saveJSON(PREF_KEY, prefs);
      state.shoe = [];
      renderGroupSelect();
      renderModeSelect();
      ensureShoe(tableCfg());
      renderSummary();
      renderVenueSelect();
    });
    $('#roomSel').addEventListener('change', e => {
      state.room = +e.target.value;
      prefs.room = state.room;
      saveJSON(PREF_KEY, prefs);
      renderSummary();
    });
    $('#modeSel').addEventListener('change', e => {
      state.mode = e.target.value;
      prefs.mode = state.mode;
      saveJSON(PREF_KEY, prefs);
      renderSummary();
    });
    const l6c = $('#lucky6Chk');
    if (l6c) l6c.addEventListener('change', e => {
      state.lucky6On = e.target.checked;
      prefs.lucky6 = state.lucky6On;
      saveJSON(PREF_KEY, prefs);
      renderBets();
    });

    $$('.bchip').forEach(c => c.addEventListener('click', () => {
      state.chip = +c.dataset.v;
      $$('.bchip').forEach(x => x.classList.remove('on'));
      c.classList.add('on');
      renderBets();
      msg(`筹码面额 ${fmt(state.chip)} MOP`);
    }));

    $$('.betspot').forEach(spot => {
      spot.addEventListener('click', () => {
        if (state.phase !== 'bet') return msg('本局已开始，等结算后再下注');
        const kind = spot.dataset.bet;
        if (kind === 'l6' && !tableCfg().lucky6) return msg('本台未开幸运 6');
        addBet(kind, state.chip);
      });
    });

    $('#dealBtn').addEventListener('click', () => { if (state.phase === 'bet') deal(); });
    $('#clearBtn').addEventListener('click', clearBets);
    $('#repeatBtn').addEventListener('click', repeatBets);
    $('#undoBtn').addEventListener('click', undoBet);
    $('#addBank').addEventListener('click', () => {
      if (LIFE) {
        if (!confirm('向叠码仔借 100,000 MOP 筹码？人生负债将增加 125,000 MOP。')) return;
        state.bank += 100000;
        window.BJLifeBridge.borrow(100000, '百家乐补码');
        renderBank(); msg('借入 100,000 MOP 筹码 · 人生负债 +125,000 MOP');
        return;
      }
      if (!confirm('补充 100,000 MOP 模拟筹码？')) return;
      state.bank += 100000; saveNum(BANK_KEY, state.bank); renderBank(); msg('已补充 100,000 MOP 模拟筹码');
    });
    $('#resetBank').addEventListener('click', () => {
      if (LIFE) return msg('人生模式下本金由人生现金决定，不能重置；请回人生页结算');
      if (!confirm('重置本金为 200,000 MOP？')) return;
      state.bank = 200000; saveNum(BANK_KEY, state.bank); renderBank(); msg('本金已重置为 200,000 MOP');
    });
    $('#fsBtn').addEventListener('click', () => {
      const el = document.querySelector('.bac-tablewrap');
      if (!document.fullscreenElement) el.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
    $('#focusBtn').addEventListener('click', () => {
      document.body.classList.toggle('focus');
      $('#focusBtn').textContent = document.body.classList.contains('focus') ? '退出专注' : '专注模式';
    });
    $('#fsExit').addEventListener('click', () => document.exitFullscreen?.());
    const fsIn = $('#fsExitIn');
    if (fsIn) fsIn.addEventListener('click', () => document.exitFullscreen?.());
    document.addEventListener('fullscreenchange', () => {
      document.body.classList.toggle('fs', !!document.fullscreenElement);
      $('#fsBtn').textContent = document.fullscreenElement ? '退出全屏' : '全屏';
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && state.phase === 'bet') deal();
      if (e.key === 'Escape' && document.body.classList.contains('focus')) {
        document.body.classList.remove('focus');
        $('#focusBtn').textContent = '专注模式';
      }
    });
  }

  function boot() {
    if (!CASINOS.length) return;
    state.shoeNo = 1;
    renderGroupSelect();
    renderVenueSelect();
    renderRoomSelect();
    renderModeSelect();
    renderSummary();
    bind();
    ensureShoe(tableCfg());
    renderShoe(tableCfg());
    renderHands();
    msg('选择场馆与厅房，点筹码下注，然后按「开牌」。庄赢抽水 5%，免佣台庄 6 点只赔一半。');
  }

  window.BAC = { state, deal, _cfg: tableCfg, _total: total, _buildBigRoad: buildBigRoad };
  document.addEventListener('DOMContentLoaded', boot);
})();