/* ============================================================
   life-bridge.js — 模拟人生 ↔ 赌桌的资金桥
   仅在 URL 带 ?life=1 时激活：
     · 赌桌本金 = 人生随身现金
     · 每局结算把台面余额与净输赢实时写回人生存档
     · 「补充筹码」变成叠码仔高利贷（进负债）
   不改动任何台规、赔率、限红或厅房准入。
   ============================================================ */
(function () {
  'use strict';

  var params = null;
  try { params = new URLSearchParams(location.search); } catch (e) {}
  if (!params || params.get('life') !== '1') return;
  if (!window.BJLife) { location.replace('life.html'); return; }

  var L = window.BJLife;
  var s = L.load();
  if (!s) { location.replace('life.html'); return; }
  if (s.ending) { location.replace('life.html'); return; }

  document.documentElement.classList.add('life-mode');

  function cashNow() {
    var st = L.load();
    return st ? Math.round(st.cash) : 0;
  }
  function fmt(n) {
    n = Math.round(+n || 0);
    var a = Math.abs(n), sign = n < 0 ? '-' : '';
    if (a >= 1e8) return sign + (a / 1e8).toFixed(2).replace(/\.?0+$/, '') + ' 亿';
    if (a >= 1e4) return sign + (a / 1e4).toFixed(1).replace(/\.0$/, '') + ' 万';
    return sign + a.toLocaleString('zh-CN');
  }

  function injectStyle() {
    if (document.getElementById('life-hud-style')) return;
    var st = document.createElement('style');
    st.id = 'life-hud-style';
    st.textContent = [
      '.life-hud{position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;flex-direction:column;gap:5px;',
      'padding:11px 13px;border-radius:12px;border:1px solid rgba(201,162,39,.42);',
      'background:rgba(8,10,11,.94);color:#F4EDDB;font:11px/1.5 "Inter",-apple-system,"PingFang SC",sans-serif;',
      'box-shadow:0 18px 44px -20px #000,inset 0 1px 0 rgba(255,255,255,.05);backdrop-filter:blur(10px)}',
      '.life-hud .lh-t{font-size:8.5px;letter-spacing:.18em;color:rgba(201,162,39,.8);text-transform:uppercase}',
      '.life-hud b{color:#EBD98F;font-family:ui-monospace,monospace;font-weight:600}',
      '.life-hud .lh-row{display:flex;gap:10px;align-items:baseline;white-space:nowrap}',
      '.life-hud .lh-row span{font-size:9.5px;color:rgba(244,237,219,.42)}',
      '.life-hud .lh-net.pos b{color:#BFE7C9}.life-hud .lh-net.neg b{color:#F0C0C0}',
      '.life-hud button{margin-top:3px;height:28px;border-radius:999px;cursor:pointer;font:inherit;font-size:10.5px;',
      'border:1px solid rgba(201,162,39,.36);background:rgba(201,162,39,.1);color:#EBD98F;letter-spacing:.06em}',
      '.life-hud button:hover{background:rgba(201,162,39,.22)}',
      '@media(max-width:620px){.life-hud{left:10px;right:10px;bottom:10px;flex-direction:row;flex-wrap:wrap;align-items:center}',
      '.life-hud button{margin:0 0 0 auto}}'
    ].join('');
    document.head.appendChild(st);
  }

  function injectHud() {
    injectStyle();
    if (document.getElementById('lifeHud')) return;
    var hud = document.createElement('div');
    hud.id = 'lifeHud';
    hud.className = 'life-hud';
    hud.innerHTML =
      '<div class="lh-t">Life Mode · 人生模式</div>' +
      '<div class="lh-row"><span>随身现金</span><b id="lhCash">—</b></div>' +
      '<div class="lh-row lh-net"><span>本次</span><b id="lhNet">—</b><span id="lhRounds">0 局</span></div>' +
      '<button type="button" id="lhBack">回人生结算</button>';
    document.body.appendChild(hud);
    hud.querySelector('#lhBack').addEventListener('click', function () {
      location.href = 'life.html';
    });
    refreshHud();
  }

  function refreshHud() {
    var cash = cashNow();
    var ses = L.session();
    var c = document.getElementById('lhCash');
    var n = document.getElementById('lhNet');
    var r = document.getElementById('lhRounds');
    if (!c) return;
    c.textContent = fmt(cash) + (cash < 0 ? ' · 已透支' : '');
    if (ses) {
      n.textContent = (ses.net > 0 ? '+' : '') + fmt(ses.net);
      n.parentNode.className = 'lh-row lh-net ' + (ses.net >= 0 ? 'pos' : 'neg');
      r.textContent = ses.rounds + ' 局';
    } else {
      n.textContent = '—';
      r.textContent = '0 局';
    }
  }

  function sync(game, bank, net, stake) {
    var out = L.recordGamble(game, bank, net, stake);
    refreshHud();
    return out;
  }
  function borrow(amount, label) {
    var out = L.borrow(amount, label);
    refreshHud();
    return out;
  }

  window.BJLifeBridge = {
    active: true,
    bank: function () { return Math.max(0, cashNow()); },
    sync: sync,
    borrow: borrow,
    refresh: refreshHud,
    leave: function () { location.href = 'life.html'; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectHud);
  else injectHud();
})();