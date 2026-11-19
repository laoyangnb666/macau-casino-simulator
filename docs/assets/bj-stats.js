/* ============================================================
   bj-stats.js — 三游戏终身统计（跨页面共享，会员中心数据源）
   键 bj.stats.v1：{ v, bj:{...}, bac:{...}, slot:{...} }
   add(game, delta, maxes)：delta 数值累加；maxes 按 Math.max 合并
   口径：自本模块上线起累计；会话面板仍由各游戏自行维护
   ============================================================ */
(function () {
  'use strict';
  const KEY = 'bj.stats.v1';
  const VERSION = 1;

  function blank() {
    return {
      v: VERSION,
      bj:   { rounds: 0, w: 0, l: 0, d: 0, bj: 0, bust: 0, side: 0, pl: 0, turnover: 0 },
      bac:  { rounds: 0, p: 0, b: 0, t: 0, pp: 0, bp: 0, l6: 0, wagered: 0, commission: 0, net: 0, biggest: 0 },
      slot: { spins: 0, hits: 0, wagered: 0, won: 0, fs: 0, jp: 0, biggest: 0 }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const s = JSON.parse(raw) || {};
      const base = blank();
      ['bj', 'bac', 'slot'].forEach(g => {
        const src = s[g] || {};
        Object.keys(base[g]).forEach(k => {
          const n = +src[k];
          base[g][k] = isFinite(n) && n > 0 ? n : (isFinite(n) ? n : 0);
        });
      });
      return base;
    } catch (e) {
      return blank();
    }
  }

  function save(s) {
    s.v = VERSION;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function add(game, delta, maxes) {
    const s = load();
    const target = s[game];
    if (!target) return s;
    Object.keys(delta || {}).forEach(k => {
      const n = +delta[k];
      if (!isFinite(n)) return;
      target[k] = (+target[k] || 0) + n;
    });
    Object.keys(maxes || {}).forEach(k => {
      const n = +maxes[k];
      if (!isFinite(n)) return;
      target[k] = Math.max(+target[k] || 0, n);
    });
    save(s);
    return s;
  }

  function get(game) { return load()[game]; }

  window.BJStats = { KEY, blank, load, save, add, get };
})();