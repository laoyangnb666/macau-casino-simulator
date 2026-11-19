/* ============================================================
   bj-card.js — 会员卡卡面共用数据与骨架（21 点牌桌 / 会员中心）
   自 blackjack.html 内联提取：官方图目录 / 尺寸 / 皮肤映射 / 卡面 HTML
   face() 只产数据与 HTML 串；DOM 编排（缓存/错误回退）留在各页
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 有官方图用官方图，无官方图用 AI 生成图 ---------- */
  const CARD_ART = {
    sands: ['sands_gold', 'sands_ruby1', 'sands_ruby2', 'sands_ruby3',
            'sands_dia1', 'sands_dia2', 'sands_dia3'],
    melco: ['melco_gold', 'melco_platinum', 'melco_diamond',
            'melco_ruby', 'melco_dragon', 'melco_emperor'],
    sjm: ['sjm_emerald', 'sjm_gold', 'sjm_platinum', 'sjm_diamond'],
    galaxy: ['gal_royal', 'gal_noble', 'gal_eminent'],
    wynn: ['wyn_red', 'wyn_silver', 'wyn_gold', 'wyn_plat'],
    mgm: ['mgm_sapp', 'mgm_pearl', 'mgm_plat', 'mgm_seal', 'mgm_diam', 'mgm_bdia']
  };
  /* 官方图原始尺寸：写进 img 的 width/height，换档时高度不会塌成 0 */
  const ART_DIM = {
    sands: [496, 314],
    sjm: [620, 395],
    melco: [360, 560],
    galaxy: [720, 480],
    wynn: [720, 480],
    mgm: [720, 480],
    vip: [720, 480]
  };
  /* AI 生成图（非官方）：提示语区分「官方卡面 / AI 卡面」 */
  const ART_GEN = new Set(['galaxy', 'wynn', 'mgm', 'vip']);
  function cardArtOf(progId, idx) {
    const list = CARD_ART[progId];
    if (!list || idx < 0 || idx >= list.length) return null;
    return 'assets/cards/' + list[idx] + '.webp';
  }
  /* 贵宾卡：金沙 / 新濠 / 澳娱用官方卡图；银河 / 永利从 AI 卡面里取对应档位 */
  const VIP_ART = {
    sands: ['sands_apex_platinum', 'sands_apex_diamond', 'sands_apex_chairman'], // 御匾白金 / 钻石 / 主席
    melco: ['melco_ruby', 'melco_dragon', 'melco_emperor'], // 红玺 / 龙玺 / 天皇
    sjm: ['sjm_diamond'],                                    // 至尊钻石
    galaxy: ['gal_prestige', 'gal_sov', 'gal_apex'],          // 尊 / 金尊 / 至尊（银河卡面）
    wynn: ['wyn_black', 'wyn_chair']                         // 黑卡 / 主席卡（AI 卡面）
  };
  function vipArtOf(progId, card) {
    const list = VIP_ART[progId];
    if (!list) return null;   // 该卡系没有贵宾卡图 → 走自绘卡面兜底
    if (card >= 1 && card <= list.length) return 'assets/cards/' + list[card - 1] + '.webp';
    return null;
  }
  /* 进场时把本卡系的官方图全部预载，升档换图时不用等网络，也就不会出现空白窗口 */
  const ART_PRELOADED = {};
  const failed = new Set();   /* 加载失败的官方图，后续直接走自绘卡面 */
  function preload(progId) {
    if (!ART_PRELOADED[progId]) {
      const list = CARD_ART[progId];
      if (list) {
        ART_PRELOADED[progId] = 1;
        list.forEach(n => { const im = new Image(); im.src = 'assets/cards/' + n + '.webp'; });
      }
    }
    const vlist = VIP_ART[progId];
    if (vlist && !ART_PRELOADED['vip-' + progId]) {
      ART_PRELOADED['vip-' + progId] = 1;
      vlist.forEach(n => { const im = new Image(); im.src = 'assets/cards/' + n + '.webp'; });
    }
  }

  /* 卡面配色按各场官方档位语义映射：金 / 红宝 / 钻石 / 白金 / 御匾 / 翡翠 */
  const SKIN = {
    sands: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    melco: [1, 8, 6, 3, 9, 10],
    sjm: [11, 1, 8, 6],
    galaxy: [1, 8, 6],
    wynn: [3, 2, 1, 8],
    mgm: [6, 8, 1, 10, 5, 9]
  };

  /**
   * 产出一张卡的全部展示数据与 HTML 骨架
   * opts: { en, t(译名函数), fmt(数字格式化) }
   */
  function face(progId, m, prog, opts) {
    const o = opts || {};
    const EN = !!o.en;
    const T = o.t || (s => s);
    const fmt = o.fmt || (n => Math.round(n).toLocaleString('zh-CN'));
    const vip = prog.vip;
    const t = window.BJCore ? window.BJCore.tierOf(m.points, prog) : { idx: 0, tier: '—', next: null, need: null };

    let cls, tierName, sub, typeLabel, pipsTotal, pipsOn, note, vipArt = null;
    if (m.card >= 1) {
      const held = (vip.tiers || []).find(x => (x.card || 1) === m.card) || vip.tiers[0];
      cls = 'v' + Math.max(1, Math.min(4, m.card));
      vipArt = vipArtOf(progId, m.card);
      /* 该档没有卡图或图加载失败时（如永利后两档）才走自绘品牌卡面 */
      if (!vipArt || failed.has(vipArt)) cls += ' vipskin-' + progId + '-' + Math.max(1, Math.min(4, m.card));
      typeLabel = EN ? 'VIP card' : '贵宾卡';
      tierName = held ? T(held.name) : '—';
      sub = vip.name;
      pipsTotal = (vip.tiers || []).length || 4;
      pipsOn = m.card;
      note = EN
        ? `VIP card held — every room up to this level is open. Membership card (${T(t.tier)}) is tracked separately.`
        : `贵宾卡已持有，该档及以下厅房全部开放；会员卡（${t.tier}）另行累计。`;
    } else {
      const skin = (SKIN[progId] || [])[t.idx];
      cls = 'm' + (skin || Math.min(11, t.idx + 1));
      typeLabel = EN ? 'Membership card' : '会员卡';
      tierName = T(t.tier);
      sub = prog.brand;
      pipsTotal = Math.min(10, (prog.tiers || []).length);
      pipsOn = t.idx + 1;
      note = t.next
        ? (EN ? `${fmt(t.need)} pts to ${T(t.next)} · VIP rooms need a separate VIP card`
              : `距${t.next}还差 ${t.need} 分 · 贵宾厅需另申请贵宾卡`)
        : (EN ? 'Top membership tier · official VIP tiers need a separate application'
              : '会员卡已到顶 · 官方贵宾档需另行申请');
    }

    const pips = Array.from({ length: pipsTotal }, (_, i) =>
      `<i class="${i < pipsOn ? 'on' : ''}"></i>`).join('');

    const drawn = `
      ${m.card >= 1 ? '<span class="mc-shine"></span>' : ''}
      <div class="mc-row">
        <div class="mc-brand">${prog.brand}</div>
        <span class="mc-type">${typeLabel}</span>
      </div>
      <div class="mc-row" style="align-items:flex-end">
        <div>
          <div class="mc-tier">${tierName}</div>
          <div class="mc-sub">${sub}</div>
        </div>
        <div class="mc-chip"></div>
      </div>
      <div class="mc-foot">
        <span class="mc-no">MOP · 21 · 0088 ${String(pipsOn).padStart(4, '0')}</span>
        <span class="mc-pips">${pips}</span>
      </div>`;

    const art = (m.card >= 1 ? vipArt : cardArtOf(progId, t.idx));
    const kind = (m.card >= 1 ? (!!VIP_ART[progId] && !ART_GEN.has(progId)) : !ART_GEN.has(progId)) ? 'official' : 'gen';
    const dim = ART_DIM[m.card >= 1 ? (VIP_ART[progId] ? progId : 'vip') : progId] || [720, 454];

    return {
      cls, drawn, art, dim, pips, typeLabel, tierName, sub, note, kind, t,
      portrait: progId === 'melco'
    };
  }

  window.BJCard = { CARD_ART, ART_DIM, ART_GEN, VIP_ART, SKIN, cardArtOf, vipArtOf, preload, failed, face };
})();