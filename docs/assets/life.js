/* ============================================================
   life.js — 模拟人生模式 UI（选项卡式）
   数据全部来自 life-core.js；本文件只负责渲染与交互。
   ============================================================ */
(function () {
  'use strict';

  var L = window.BJLife;
  var $ = function (id) { return document.getElementById(id); };
  var state = { origin: null, tab: 'overview' };
  var GAMES = [
    {
      id: 'bj', href: 'blackjack.html', name: '21 点', en: 'BLACKJACK', icon: '♠', color: '#C9A227',
      desc: '六门独立结算、无底牌制、七档厅房。贵宾厅仍按游戏内会员卡级准入，人生模式不改任何台规。'
    },
    {
      id: 'bac', href: 'baccarat.html', name: '百家乐', en: 'BACCARAT', icon: '♦', color: '#B71C1C',
      desc: '8 副牌靴、庄抽水或免佣台、珠盘路与大路。注码上限与台面限红完全按场馆原规则。'
    },
    {
      id: 'slot', href: 'slots.html', name: '老虎机', en: 'SLOTS', icon: '★', color: '#7FC0DD',
      desc: '11 款机台，按场馆校准 RTP，免费游戏与四层累积奖池。每转结果实时计入人生现金。'
    }
  ];

  /* ---------------- 工具 ---------------- */
  function fmt(n) {
    n = Math.round(+n || 0);
    var a = Math.abs(n), sign = n < 0 ? '-' : '';
    if (a >= 1e8) return sign + (a / 1e8).toFixed(2).replace(/\.?0+$/, '') + ' 亿';
    if (a >= 1e4) return sign + (a / 1e4).toFixed(1).replace(/\.0$/, '') + ' 万';
    return sign + a.toLocaleString('zh-CN');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }
  var toastTimer = null;
  function toast(msg, kind) {
    var el = $('toast');
    el.textContent = msg;
    el.className = 'lifetoast on' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = 'lifetoast'; }, 2400);
  }
  function modal(html) {
    $('modalBox').innerHTML = html;
    $('modal').hidden = false;
    var first = $('modalBox').querySelector('[data-close]');
    if (first) first.focus();
  }
  function closeModal() { $('modal').hidden = true; $('modalBox').innerHTML = ''; }

  /* ---------------- 身世选择 ---------------- */
  function renderChoose() {
    var grid = $('origGrid');
    grid.innerHTML = L.ORIGINS.map(function (o) {
      var traits = o.traits.map(function (t) {
        return '<div><b>' + esc(t.n) + '</b> · ' + esc(t.d) + '</div>';
      }).join('');
      return '<div class="orig-card" data-origin="' + o.id + '" style="--oc:' + o.color + '" role="button" tabindex="0">' +
        '<div class="orig-top"><div><div class="orig-name">' + esc(o.name) + '</div>' +
        '<div class="orig-en">' + esc(o.en) + '</div></div>' +
        '<span class="orig-diff">难度 ' + '●'.repeat(o.diff) + '</span></div>' +
        '<p class="orig-intro">' + esc(o.intro) + '</p>' +
        '<div class="orig-nums">' +
        '<div><span>起始现金</span><b>' + fmt(o.cash) + '</b></div>' +
        '<div><span>月收入</span><b>' + fmt(o.income || 0) + '</b></div>' +
        '<div><span>月开销</span><b>' + fmt(o.expense) + '</b></div>' +
        '</div>' +
        '<div class="orig-traits">' + traits + '</div>' +
        '<div class="orig-goal">目标 · ' + esc(o.goal) + '</div>' +
        '</div>';
    }).join('');
    grid.onclick = function (e) {
      var card = e.target.closest('.orig-card');
      if (!card) return;
      state.origin = card.getAttribute('data-origin');
      Array.prototype.forEach.call(grid.children, function (c) { c.classList.toggle('on', c === card); });
      $('chooseGo').disabled = false;
      var o = L.ORIGINS.filter(function (x) { return x.id === state.origin; })[0];
      $('chooseNote').textContent = '已选择「' + o.name + '」 · 开局后不可更改身世';
    };
    $('chooseGo').onclick = function () {
      if (!state.origin) return;
      L.create(state.origin);
      state.origin = null;
      showApp();
      switchTab('overview');
      toast('新的人生开始了', 'good');
    };
    $('choose').hidden = false;
    $('lifeApp').hidden = true;
  }

  /* ---------------- 顶栏与选项卡 ---------------- */
  function showApp() {
    if (!L.hasSave()) { renderChoose(); return; }
    $('choose').hidden = true;
    $('lifeApp').hidden = false;
    var s = L.load();
    if (s.ending) { renderAll(); showEnding(s.ending); return; }
    renderAll();
  }

  $('ltabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (!b) return;
    switchTab(b.getAttribute('data-tab'));
  });
  function switchTab(tab) {
    state.tab = tab;
    Array.prototype.forEach.call($('ltabs').children, function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === tab);
    });
    ['overview', 'actions', 'casino', 'assets', 'dex'].forEach(function (t) {
      $('pane-' + t).classList.toggle('on', t === tab);
    });
    if (tab === 'casino') renderCasino();
  }

  /* ---------------- 总览 ---------------- */
  function renderHeader(s) {
    var o = L.origin(s);
    $('lifeTitle').innerHTML = '你的第二人生 · <em>' + esc(o.name) + '</em>';
    $('lifeIntro').textContent = o.intro + ' 目标：' + o.goal + '。';
    var dex = L.dex();
    $('lifeMeta').innerHTML =
      '<span>年龄 <b>' + s.age + '</b></span>' +
      '<span>时间 <b>' + L.monthLabel(s) + '</b></span>' +
      '<span>第 <b>' + (s.months + 1) + '</b> 个月</span>' +
      '<span>净资产 <b>' + fmt(L.netWorth(s)) + '</b></span>' +
      '<span>已达成结局 <b>' + dex.length + ' / ' + L.allEndings().length + '</b></span>' +
      '<span>难度 <b>' + '●'.repeat(o.diff) + '</b></span>';
  }

  function renderOverview(s) {
    var nw = L.netWorth(s);
    var debt = L.debtTotal(s);
    $('finCards').innerHTML =
      card('随身现金', fmt(s.cash), s.cash < 0 ? 'neg' : 'gold', '赌桌上带入的本金') +
      card('净资产', fmt(nw), nw < 0 ? 'neg' : '', '现金 + 资产 − 负债') +
      card('总负债', debt ? fmt(debt) : '无', debt ? 'neg' : '', debt ? '每月计息，越低越轻松' : '目前没有债务') +
      card('月固定收入', fmt(s.income), '', '每月自动入账');

    var attrs = [
      ['健康', s.health, s.health < 40 ? 'warn' : ''],
      ['心情', s.mood, ''],
      ['声望', s.fame, ''],
      ['人脉', s.network, ''],
      ['赌瘾', s.addiction, s.addiction >= 60 ? 'hot' : '']
    ];
    $('attrBox').innerHTML = '<h3>身心状态 <small>STATUS</small></h3>' +
      attrs.map(function (a) {
        return '<div class="abar ' + a[2] + '"><div class="lab"><span>' + a[0] + '</span><b>' +
          Math.round(a[1]) + '</b></div><div class="track"><i style="width:' + Math.round(a[1]) + '%"></i></div></div>';
      }).join('') +
      '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed rgba(201,162,39,.2);font-size:9.5px;color:rgba(244,237,219,.4)">' +
      '技能 · 经营 ' + Math.round(s.skills.work * 10) / 10 + ' / 投资 ' + Math.round(s.skills.invest * 10) / 10 +
      ' / 社交 ' + Math.round(s.skills.social * 10) / 10 + '</div>';

    $('apNum').textContent = s.ap;
    var dots = '';
    for (var i = 0; i < 3; i++) dots += '<i class="' + (i < s.ap ? 'on' : '') + '"></i>';
    $('apDots').innerHTML = dots;

    var o = L.origin(s);
    $('goalBox').innerHTML = '<b>本世目标 · GOAL</b>' + esc(o.goal) +
      '<div style="margin-top:6px;color:rgba(244,237,219,.42)">结局判定看净资产、赌瘾与健康。净资产 1 亿为「赌王传奇」，3000 万为「商业帝国」，净资产跌破 -200 万会被破产清算。</div>';

    $('logList').innerHTML = s.log.slice(0, 24).map(function (l) {
      return '<li class="' + (l.k || 'info') + '"><span class="t">' + esc(l.t) + '</span><span class="txt">' +
        esc(l.txt) + '</span></li>';
    }).join('');
    $('logList').scrollTop = 0;
  }
  function card(label, val, cls, small) {
    return '<div class="fin"><span>' + label + '</span><b class="' + (cls || '') + '">' + val +
      '</b><small>' + small + '</small></div>';
  }

  /* ---------------- 行动 ---------------- */
  function renderActions(s) {
    $('actAp').textContent = s.ap;
    var disabled = s.ap <= 0 || !!s.ending;
    Array.prototype.forEach.call(document.querySelectorAll('[data-act]'), function (b) {
      b.disabled = disabled;
    });
    $('endMonthBtn').disabled = !!s.ending;
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var id = b.getAttribute('data-act');
    var opt = {};
    if (id === 'invest') {
      opt.amount = +$('invAmount').value || 0;
      opt.risk = $('invRisk').value;
    }
    if (id === 'repay') opt.amount = +$('repayAmount').value || 0;
    var r = L.act(id, opt);
    if (!r.ok) { toast(r.msg, 'bad'); return; }
    toast(r.msg, r.tone === 'in' ? 'good' : '');
    renderAll();
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-goto]');
    if (!b) return;
    switchTab(b.getAttribute('data-goto'));
  });

  $('endMonthBtn').addEventListener('click', function () {
    var s = L.load();
    if (!s || s.ending) return;
    var rep = L.endMonth();
    if (!rep) return;
    renderAll();
    showReport(rep);
  });

  /* ---------------- 月报与结局 ---------------- */
  function showReport(rep) {
    var lines = rep.lines.filter(function (l) { return l.k !== 'balance'; });
    var html = '<div class="mk">MONTHLY REPORT · ' + esc(rep.period) + '</div>' +
      '<h2>月度结算</h2>' +
      '<div class="sub">工资、租金、生活开销与债务利息自动结算；健康与赌瘾也在变化。</div>' +
      '<div class="rep-sum">' +
      '<div><span>本月收入</span><b class="in">+' + fmt(rep.income) + '</b></div>' +
      '<div><span>本月支出</span><b class="out">-' + fmt(rep.expense + rep.interest) + '</b></div>' +
      '<div><span>月末现金</span><b>' + fmt(rep.lines[rep.lines.length - 1].val) + '</b></div>' +
      '</div>' +
      '<div class="rep-lines">' + lines.map(function (l) {
        var cls = l.val > 0 ? 'pos' : l.val < 0 ? 'neg' : 'zero';
        var val = l.k === 'event' || l.k === 'up' ? (l.k === 'up' ? fmt(l.val) : '·') :
          (l.val > 0 ? '+' : '') + fmt(l.val);
        return '<div><span>' + esc(l.txt) + '</span><b class="' + cls + '">' + val + '</b></div>';
      }).join('') + '</div>' +
      (rep.event ? '<div class="rep-event"><b>' + esc(rep.event.title) + '</b><p>' + esc(rep.event.text) + '</p></div>' : '') +
      '<div class="foot"><button class="btn btn-dark" data-close>继续</button></div>';
    modal(html);
    $('modalBox').querySelector('[data-close]').addEventListener('click', function () {
      closeModal();
      if (rep.ending) showEnding(rep.ending);
    });
  }

  function showEnding(end) {
    var s = L.load();
    if (!s) return;
    var nw = L.netWorth(s);
    var dex = L.dex();
    var html = '<div class="endbox">' +
      '<div class="mk">LIFE ENDED</div>' +
      '<div class="big">' + esc(end.name) + '</div>' +
      '<p>' + esc(end.desc) + '</p>' +
      '<div class="sum">' +
      '<div>净资产<b>' + fmt(nw) + '</b></div>' +
      '<div>活了<b>' + s.months + '</b> 个月</div>' +
      '<div>年龄<b>' + s.age + '</b></div>' +
      '<div>身世<b>' + esc(L.origin(s).name) + '</b></div>' +
      '</div>' +
      '<div class="foot" style="justify-content:center">' +
      '<button class="btn btn-ghost" data-dex>查看图鉴</button>' +
      '<button class="btn btn-dark" data-new>开始新的人生</button>' +
      '</div></div>';
    modal(html);
    $('modalBox').querySelector('[data-dex]').onclick = function () {
      closeModal();
      switchTab('dex');
    };
    $('modalBox').querySelector('[data-new]').onclick = function () {
      closeModal();
      L.reset();
      renderChoose();
    };
  }

  /* ---------------- 赌场 ---------------- */
  function renderCasino(s) {
    s = s || L.load();
    if (!s) return;
    var old = document.querySelector('.casino-block-note');
    if (old) old.remove();
    var ban = s.flags.banMonth === s.months;
    var reason = s.ending ? '这一世已经结束'
      : ban ? '本月被赌场列入观察名单，无法入场'
      : s.ap <= 0 ? '本月行动点已用完，先结束本月'
      : s.cash < 1000 ? '随身现金不足 1,000 MOP'
      : '';
    var o = L.origin(s);
    $('casGrid').innerHTML = GAMES.map(function (g) {
      var rec = s.casino.byGame[g.id] || { rounds: 0, net: 0 };
      return '<div class="cas" style="--cc:' + g.color + '">' +
        '<div class="ic" style="color:' + g.color + '">' + g.icon + '</div>' +
        '<h4>' + g.name + '</h4><div class="sub">' + g.en + '</div>' +
        '<p>' + g.desc + '</p>' +
        (o.eff.info ? '<p style="color:rgba(201,162,39,.7)">懂行：你对台面与厅房限制更熟悉，入场前可先在游戏内查看台规。</p>' : '') +
        '<div class="stats">' +
        '<span>随身现金 <b>' + fmt(s.cash) + '</b></span>' +
        '<span>累计 <b>' + rec.rounds + '</b> 局</span>' +
        '<span>净额 <b>' + (rec.net > 0 ? '+' : '') + fmt(rec.net) + '</b></span>' +
        '</div>' +
        '<button class="btn btn-dark btn-sm" data-enter="' + g.id + '"' + (reason ? ' disabled' : '') + '>' +
        (reason ? '暂不可入场' : '带资入场 →') + '</button>' +
        '</div>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('[data-enter]'), function (b) {
      b.disabled = !!reason;
      b.onclick = function () {
        var g = GAMES.filter(function (x) { return x.id === b.getAttribute('data-enter'); })[0];
        var r = L.gambleOpen();
        if (!r.ok) { toast(r.msg, 'bad'); return; }
        sessionStorage.setItem('bj.life.return', '1');
        location.href = g.href + '?life=1';
      };
    });
    var sess = s.session;
    var box = $('sessionBox');
    if (sess) {
      box.hidden = false;
      box.innerHTML = '<b>最近一次入场</b>' +
        '<div class="kv">起始资金<b>' + fmt(sess.start) + '</b></div>' +
        '<div class="kv">当前现金<b>' + fmt(s.cash) + '</b></div>' +
        '<div class="kv">局数<b>' + sess.rounds + '</b></div>' +
        '<div class="kv">净输赢<b class="' + (sess.net >= 0 ? 'pos' : 'neg') + '">' +
        (sess.net > 0 ? '+' : '') + fmt(sess.net) + '</b></div>';
    } else box.hidden = true;
    if (reason) {
      var n = document.createElement('div');
      n.className = 'casino-note casino-block-note';
      n.style.borderColor = 'rgba(228,104,95,.28)';
      n.style.background = 'rgba(228,104,95,.06)';
      n.innerHTML = '<b>当前无法入场</b> ' + esc(reason) + '。';
      $('casGrid').before(n);
    }
  }

  /* ---------------- 资产 ---------------- */
  function renderAssets(s) {
    var arows = s.assets.length ? s.assets.map(function (a) {
      return '<div class="rowitem"><div class="nm">' + esc(a.name) +
        '<small>' + (a.income ? '每月 +' + fmt(a.income) : a.risky ? '浮动分红' : '无租金') + '</small></div>' +
        '<b>' + fmt(a.value) + '</b></div>';
    }).join('') : '<div class="empty">还没有资产。先攒够首付，从一间小公寓开始。</div>';
    $('assetRows').innerHTML = arows;

    $('debtRows').innerHTML = s.debts.length ? s.debts.map(function (d) {
      return '<div class="rowitem debt"><div class="nm">' + esc(d.name) +
        '<small>月息 ' + (d.rate * 100).toFixed(1) + '%</small></div><b>' + fmt(d.amount) + '</b></div>';
    }).join('') : '<div class="empty">没有负债，保持住。</div>';

    $('buyList').innerHTML = L.ASSETS.map(function (a) {
      var down = a.id === 'car' ? a.price : Math.round(a.price * 0.3);
      var can = s.cash >= down && !s.ending && s.ap > 0;
      return '<div class="buyitem"><div class="bh"><b>' + esc(a.name) + '</b><span class="pr">' + fmt(a.price) + '</span></div>' +
        '<small>' + esc(a.desc) + ' · ' + (a.id === 'car' ? '全款' : '首付 30% = ' + fmt(down)) + '</small>' +
        '<button class="btn btn-ghost btn-sm" data-buy="' + a.id + '"' + (can ? '' : ' disabled') + '>' +
        (can ? '购入' : (s.ap <= 0 ? '本月行动点已用完' : '首付不足')) + '</button></div>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('[data-buy]'), function (b) {
      b.onclick = function () {
        var r = L.act('buy', { assetId: b.getAttribute('data-buy') });
        if (!r.ok) { toast(r.msg, 'bad'); return; }
        toast(r.msg, 'good');
        renderAll();
      };
    });
  }
  $('assetRepayBtn').addEventListener('click', function () {
    var r = L.act('repay', { amount: +$('assetRepay').value || 0 });
    if (!r.ok) { toast(r.msg, 'bad'); return; }
    toast(r.msg, 'good');
    $('assetRepay').value = '';
    renderAll();
  });

  /* ---------------- 图鉴 ---------------- */
  function renderDex(s) {
    var list = L.dex();
    $('endGrid').innerHTML = L.allEndings().map(function (e) {
      var rec = list.filter(function (r) { return r.id === e.id; })[0];
      return '<div class="endcard ' + (e.kind || '') + (rec ? '' : ' un') + '">' +
        '<div class="en">' + esc(e.name) + '</div>' +
        '<div class="kind">' + (rec ? '已达成' : '未解锁') + '</div>' +
        '<p>' + esc(e.desc) + '</p>' +
        (rec ? '<div class="rec">' + esc(rec.origin) + ' · ' + fmt(rec.netWorth) + ' · ' + rec.months + ' 个月</div>' : '') +
        '</div>';
    }).join('');
    $('quitBtn').onclick = function () {
      modal('<div class="mk">RETIRE · 主动收手</div><h2>现在就结束这一世？</h2>' +
        '<div class="sub">按当前净资产结算结局并记入图鉴，之后可以重开人生。</div>' +
        '<div class="foot"><button class="btn btn-ghost" data-close>再想想</button>' +
        '<button class="btn btn-dark" data-ok>确认收手</button></div>');
      $('modalBox').querySelector('[data-close]').onclick = closeModal;
      $('modalBox').querySelector('[data-ok]').onclick = function () {
        var end = L.finish();
        closeModal();
        if (end) { renderAll(); showEnding(end); }
      };
    };
    $('restartBtn').onclick = function () {
      modal('<div class="mk">NEW LIFE · 重开</div><h2>清空当前人生？</h2>' +
        '<div class="sub">当前存档会被清除，图鉴与已达成结局保留。</div>' +
        '<div class="foot"><button class="btn btn-ghost" data-close>取消</button>' +
        '<button class="btn btn-dark" data-ok>确认重开</button></div>');
      $('modalBox').querySelector('[data-close]').onclick = closeModal;
      $('modalBox').querySelector('[data-ok]').onclick = function () {
        L.reset(); closeModal(); renderChoose();
      };
    };
  }

  /* ---------------- 汇总渲染 ---------------- */
  function renderAll() {
    var s = L.load();
    if (!s) { renderChoose(); return; }
    $('choose').hidden = true;
    $('lifeApp').hidden = false;
    renderHeader(s);
    renderOverview(s);
    renderActions(s);
    if (state.tab === 'casino') renderCasino(s);
    renderAssets(s);
    renderDex(s);
  }

  /* ---------------- 启动 ---------------- */
  if (!L) { document.body.innerHTML = '<p style="padding:120px;color:#fff">人生引擎加载失败。</p>'; return; }
  if (L.hasSave()) showApp();
  else renderChoose();
  switchTab('overview');
})();