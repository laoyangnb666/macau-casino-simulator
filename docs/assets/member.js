/* ============================================================
   member.js — 会员中心：卡包 / 分游戏终身数据 / 礼遇订单与核销
   数据源：bj.wallet.v1（会籍/订单）+ bj.stats.v1（分游戏）
   ============================================================ */
(function () {
  'use strict';
  const EN = !!(window.I18N && window.I18N.lang === 'en');
  const BJ = window.BJ_CASINOS || {};
  const PROGRAMS = BJ.programs || {};
  const CASINOS = BJ.casinos || [];
  const MALL = window.BJ_MALL;
  const W = window.BJWallet.load();
  const S = window.BJStats.load();
  const $ = id => document.getElementById(id);
  const fmt = n => Math.round(n).toLocaleString('zh-CN');
  const GROUPS = ['sands', 'galaxy', 'wynn', 'mgm', 'melco', 'sjm'];

  /* 大数字紧凑显示，与商城同口径 */
  function fmtPts(n) {
    const a = Math.abs(n);
    if (!isFinite(a)) return '—';
    if (EN) {
      if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.0+$/, '') + 'M';
      return Math.round(n).toLocaleString();
    }
    if (a >= 1e12) return (n / 1e8).toExponential(2) + '亿';
    if (a >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (a >= 1e5) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万';
    return Math.round(n).toLocaleString();
  }
  const sign = n => (n > 0 ? '+' : '') + fmt(n);
  const pct = (a, b) => (b > 0 ? (a / b * 100).toFixed(1) + '%' : '—');
  function memOf(prog) {
    return W.mem[prog] || { points: 0, turnover: 0, maxStake: 0, dayTurnovers: [], card: 0, cardRound: 0 };
  }
  function tierIndex(prog, need) {
    const n = (prog.tiers || []).length;
    return n ? Math.min(n - 1, Math.round(need * (n - 1))) : 0;
  }

  /* ---------------- 页头 ---------------- */
  function renderHero() {
    const ses = window.BJAuth ? window.BJAuth.session() : null;
    let created = null;
    try {
      const users = JSON.parse(localStorage.getItem('bj.auth.users.v1') || '{}');
      if (ses && users[ses.u]) created = users[ses.u].created;
    } catch (e) {}
    $('memName').textContent = ses ? (ses.name || ses.u) : (EN ? 'Guest' : '访客');
    $('memSince').textContent = created
      ? (EN ? 'Member since ' : '注册于 ') + new Date(created).toISOString().slice(0, 10)
      : (EN ? 'Local session' : '本机会话');
    let pts = 0, vip = 0, turn = 0;
    GROUPS.forEach(g => {
      const m = memOf(g);
      pts += m.points || 0;
      turn += m.turnover || 0;
      if ((m.card || 0) >= 1) vip++;
    });
    $('sumPts').textContent = fmtPts(pts);
    $('sumVip').textContent = vip;
    $('sumOrders').textContent = W.orders.length;
    $('sumTurn').textContent = fmtPts(turn);
  }

  /* ---------------- 卡包 ---------------- */
  function cardHTML(prog, m) {
    const f = window.BJCard.face(prog, m, PROGRAMS[prog], { en: EN, t: s => s, fmt });
    if (f.art && !window.BJCard.failed.has(f.art)) {
      return `<div class="mcard art${f.portrait ? ' portrait' : ''}">
        <img class="mc-art" src="${f.art}" width="${f.dim[0]}" height="${f.dim[1]}" alt="${f.tierName}" decoding="async">
        <div class="mc-cap"><span class="mc-cap-t">${f.typeLabel} · ${f.tierName}</span>
          <span class="mc-pips">${f.pips}</span></div>
      </div>`;
    }
    return `<div class="mcard ${f.cls}">${f.drawn}</div>`;
  }

  function renderCards() {
    $('cardsGrid').innerHTML = GROUPS.map(g => {
      const prog = PROGRAMS[g];
      const m = memOf(g);
      const cp = window.BJCore.cardProgress(m, prog);
      const vp = window.BJCore.vipProgress(
        { turnover: m.turnover, maxBet: m.maxStake, days: (m.dayTurnovers || []).length }, prog.vip, m.card);
      const disc = MALL.discountPct(prog, m);
      /* 已开放厅房：该卡系所有场馆中 need <= 持卡级 的厅房去重 */
      const roomMap = {};
      CASINOS.filter(c => c.prog === g).forEach(c => (c.rooms || []).forEach(r => {
        if ((r.need || 0) <= (m.card || 0)) roomMap[r.name] = r.rank || 0;
      }));
      const rooms = Object.keys(roomMap).sort((a, b) => roomMap[a] - roomMap[b]).join(' / ');
      const items = MALL.itemsOf(g);
      const unlocked = items.filter(it => (it.need || 0) <= 0 || cp.idx >= tierIndex(prog, it.need)).length;
      const held = (m.card || 0) >= 1
        ? ((prog.vip.tiers || []).find(x => (x.card || 1) === m.card) || {}).name || '—'
        : null;
      const vipBlock = held
        ? `<div class="vhead"><span>${held}</span><span class="vh-tag">${EN ? 'Held' : '持有中'}</span></div>
           <div class="plabel" style="margin-top:5px">${EN ? 'Rooms at this level and below stay open.' : '该档及以下厅房长期开放。'}</div>`
        : vp.next
          ? `<div class="vhead"><span>${EN ? 'Next VIP candidate' : '下一贵宾候选'} · ${vp.next.name}</span></div>
             <div class="vbars">
               <div><span>${EN ? 'Turnover' : '投注'}</span><span class="pbar"><i style="width:${(vp.next.rt * 100).toFixed(1)}%"></i></span><b>${(vp.next.rt * 100).toFixed(0)}%</b></div>
               <div><span>${EN ? 'Max bet' : '单注'}</span><span class="pbar"><i style="width:${(vp.next.rm * 100).toFixed(1)}%"></i></span><b>${(vp.next.rm * 100).toFixed(0)}%</b></div>
               <div><span>${EN ? 'Visits' : '到访'}</span><span class="pbar"><i style="width:${(vp.next.rd * 100).toFixed(1)}%"></i></span><b>${(vp.next.rd * 100).toFixed(0)}%</b></div>
             </div>`
          : `<div class="vhead"><span>${EN ? 'Top VIP tier reached' : '贵宾档已到顶'}</span></div>`;
      return `<article class="mcardbox">
        ${cardHTML(g, m)}
        <div class="mcinfo">
          <h3>${prog.name}<small>${prog.brand}</small></h3>
          <div class="mrows">
            <span>${EN ? 'Membership tier' : '会员卡档'}</span><b>${cp.tier}</b>
            <span>${EN ? 'Points' : '积分'}</span><b>${fmtPts(m.points)}</b>
            <span>${EN ? 'Turnover' : '有效投注'}</span><b>${fmtPts(m.turnover)}</b>
          </div>
          <div class="pbar"><i style="width:${(cp.pct * 100).toFixed(1)}%"></i></div>
          <div class="plabel">${cp.next
            ? (EN ? `${fmt(cp.remain)} pts to ${cp.next}` : `距 ${cp.next} 还差 ${fmt(cp.remain)} 分`)
            : (EN ? 'Top membership tier' : '会员卡已到顶')}</div>
          <div class="vipbox">${vipBlock}</div>
          <ul class="perks">
            <li>${EN ? 'Redemption discount' : '兑换折扣'} <b>${disc}%</b>${disc >= 20 ? (EN ? ' (cap)' : '（上限）') : ''}</li>
            <li>${EN ? 'Open rooms' : '开放厅房'} <b>${rooms || '—'}</b></li>
            <li>${EN ? 'Unlocked benefits' : '已解锁礼遇'} <b>${unlocked}/${items.length}</b> ${EN ? 'items' : '项'}</li>
            <li class="pnote">${prog.vip.note || ''}</li>
          </ul>
        </div>
      </article>`;
    }).join('');
  }

  /* 官方图加载失败 → 记黑名单并重绘自绘卡面 */
  $('cardsGrid').addEventListener('error', ev => {
    const im = ev.target;
    if (im && im.tagName === 'IMG' && im.classList.contains('mc-art')) {
      window.BJCard.failed.add(im.getAttribute('src'));
      renderCards();
    }
  }, true);

  /* ---------------- 分游戏 ---------------- */
  function cell(label, val, cls) {
    return `<div><small>${label}</small><b class="${cls || ''}">${val}</b></div>`;
  }
  function renderGames() {
    const b = S.bj, c = S.bac, s = S.slot;
    const L = (zh, en) => (EN ? en : zh);
    $('gamesGrid').innerHTML = `
      <div class="gpanel">
        <h3>21 点<small>BLACKJACK</small></h3>
        <div class="gstats">
          ${cell(L('局数', 'Rounds'), fmt(b.rounds))}
          ${cell(L('胜/负/平', 'W/L/P'), `${b.w}/${b.l}/${b.d}`)}
          ${cell(L('Blackjack', 'Blackjacks'), fmt(b.bj))}
          ${cell(L('爆牌', 'Busts'), fmt(b.bust))}
          ${cell(L('附加注命中', 'Side hits'), fmt(b.side))}
          ${cell(L('胜率', 'Win rate'), pct(b.w, b.rounds))}
          ${cell(L('有效投注', 'Turnover'), fmtPts(b.turnover))}
          ${cell(L('净输赢', 'Net P/L'), sign(b.pl), b.pl > 0 ? 'pos' : b.pl < 0 ? 'neg' : '')}
        </div>
        <p class="gnote">${L('含主注与附加注流水；净输赢为结算现金流口径。', 'Turnover includes main and side bets; net P/L follows the settlement cash flow.')}</p>
      </div>
      <div class="gpanel">
        <h3>百家乐<small>BACCARAT</small></h3>
        <div class="gstats">
          ${cell(L('局数', 'Rounds'), fmt(c.rounds))}
          ${cell(L('庄赢', 'Banker'), fmt(c.b))}
          ${cell(L('闲赢', 'Player'), fmt(c.p))}
          ${cell(L('和局', 'Tie'), fmt(c.t))}
          ${cell(L('闲对 / 庄对', 'P/B pair'), `${c.pp}/${c.bp}`)}
          ${cell(L('幸运 6', 'Lucky 6'), fmt(c.l6))}
          ${cell(L('有效投注', 'Turnover'), fmtPts(c.wagered))}
          ${cell(L('抽水合计', 'Commission'), fmtPts(c.commission))}
          ${cell(L('净输赢', 'Net P/L'), sign(c.net), c.net > 0 ? 'pos' : c.net < 0 ? 'neg' : '')}
          ${cell(L('最大单局', 'Best round'), fmtPts(c.biggest))}
        </div>
        <p class="gnote">${L('免佣台庄 6 点赔半已计入净输赢；抽水为庄赢 5% 口径。', 'No-commission half-pay on banker 6 is included; commission follows the 5% banker-win rule.')}</p>
      </div>
      <div class="gpanel">
        <h3>老虎机<small>SLOTS</small></h3>
        <div class="gstats">
          ${cell(L('转数', 'Spins'), fmt(s.spins))}
          ${cell(L('命中率', 'Hit rate'), pct(s.hits, s.spins))}
          ${cell(L('有效投注', 'Turnover'), fmtPts(s.wagered))}
          ${cell(L('总派彩', 'Total won'), fmtPts(s.won))}
          ${cell(L('实测 RTP', 'Actual RTP'), pct(s.won, s.wagered))}
          ${cell(L('最大单转', 'Best spin'), fmtPts(s.biggest))}
          ${cell(L('免费游戏', 'Free spins'), fmt(s.fs))}
          ${cell(L('奖池累计', 'Jackpots'), fmtPts(s.jp))}
        </div>
        <p class="gnote">${L('免费转不计投注；派彩含免费游戏 ×2 与累积奖池。', 'Free spins carry no wager; payouts include the ×2 free-game multiplier and progressive jackpots.')}</p>
      </div>`;
  }

  /* ---------------- 订单 ---------------- */
  function renderOrders() {
    const list = $('ordList');
    if (!W.orders.length) {
      list.innerHTML = `<p class="oempty">${EN
        ? 'No redemptions yet — visit the <a href="blackjack-mall.html">rewards shop</a> to turn points into benefits.'
        : '还没有兑换记录 —— 去<a href="blackjack-mall.html">积分商城</a>把积分换成礼遇。'}</p>`;
      return;
    }
    list.innerHTML = W.orders.map((o, i) => {
      const used = o.status === 'used';
      return `<div class="orow" data-i="${i}">
        <div class="oinfo">
          <b>${o.name}</b>
          <small>${o.no || (EN ? 'legacy order' : '旧单')} · ${o.venue || '—'} · ${window.BJOrder.tsText(o.ts)}</small>
        </div>
        <div class="oact">
          <span class="oprice">−${fmtPts(o.price)} ${EN ? 'pts' : '分'}</span>
          <span class="ost${used ? ' used' : ''}">${used ? (EN ? 'USED' : '已核销') : (EN ? 'ISSUED' : '已出票')}</span>
          <button class="obtn" type="button" data-act="view">${EN ? 'Voucher' : '凭证'}</button>
          ${used ? '' : `<button class="obtn use" type="button" data-act="use">${EN ? 'Redeem' : '核销'}</button>`}
        </div>
      </div>`;
    }).join('');
  }

  $('ordList').addEventListener('click', ev => {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    const row = ev.target.closest('.orow');
    const o = W.orders[+row.dataset.i];
    if (!o) return;
    const prog = PROGRAMS[o.progId] || PROGRAMS.sands;
    if (btn.dataset.act === 'view') {
      window.BJOrder.view(o, { en: EN, prog });
      return;
    }
    if (o.status === 'used') return;
    /* 先落库再盖章 */
    o.status = 'used';
    o.usedTs = Date.now();
    window.BJWallet.save(W);
    if (!window.BJOrder.stampUsed(o, { en: EN, prog, onDone: renderOrders })) renderOrders();
  });

  /* ---------------- EN 静态文案 ---------------- */
  if (EN) {
    document.querySelector('.mem-kick').textContent = 'Member Center · membership & benefits';
    document.querySelector('.mem-head h1').innerHTML = 'Your cards, your rounds, <em>your benefits.</em>';
    document.querySelector('.mem-head p').textContent =
      'Six casino programmes accrue separately: points, turnover, membership tiers and VIP approval progress are summed here. Every settled round of blackjack, baccarat and slots feeds the lifetime stats; redeemed benefits are issued as vouchers and stamped when used.';
    const h2s = document.querySelectorAll('.mem-sec>h2');
    h2s[0].childNodes[0].textContent = 'My cards ';
    h2s[1].childNodes[0].textContent = 'By game ';
    h2s[2].childNodes[0].textContent = 'Redemptions ';
    document.querySelector('.mem-foot').innerHTML =
      '<b>Simulation notice</b> · All points, tiers, benefits and vouchers are simulated for probability education. No real accounts, no real entitlements. Tier names follow each group’s public materials; unpublished thresholds are estimated. Real gambling has a negative long-run expectation; minors must not gamble.';
  }

  renderHero();
  renderCards();
  renderGames();
  renderOrders();
})();