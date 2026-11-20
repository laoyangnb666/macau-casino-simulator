/* ============================================================
   life-core.js — 模拟人生引擎（纯数据层，不碰 DOM）
   存档按账号隔离：bj.life.v1.<用户名>
   图鉴跨周目保留：bj.life.dex.v1.<用户名>
   原则：人生模式只改变「资金归属 / 时间 / 叙事」，
        赌桌规则、赔率、限红、厅房准入全部沿用游戏本体，不在此处改动。
   ============================================================ */
(function () {
  'use strict';

  var VERSION = 1;
  var SAVE = 'bj.life.v1.';
  var DEX = 'bj.life.dex.v1.';
  var START = { year: 2026, month: 11 };
  var AP_PER_MONTH = 3;

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function irnd(a, b) { return Math.round(rnd(a, b)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function money(n) { return Math.round(n); }
  function user() {
    var s = window.BJAuth && BJAuth.session ? BJAuth.session() : null;
    return s && s.u ? s.u : 'guest';
  }
  function key(u) { return SAVE + (u || user()); }
  function dexKey(u) { return DEX + (u || user()); }

  /* ---------------- 八种开局身世 ---------------- */
  var ORIGINS = [
    {
      id: 'heir', name: '豪门弃子', en: 'THE HEIR', diff: 4, age: 27,
      cash: 600000, income: 80000, expense: 45000,
      attrs: { health: 70, mood: 58, fame: 65, network: 70, addiction: 15 },
      skills: { work: 1, invest: 1, social: 2, learn: 1 },
      traits: [{ n: '体面', d: '社交收益 +20%，走投无路时更容易借到钱' }, { n: '傲慢', d: '输钱时心情额外 −3' }],
      eff: { social: 0.2, loseMood: -3, loan: 1.5 },
      goal: '脱离家族阴影，建立自己的商业版图',
      intro: '家族只给了你一张船票和一句话：别再回来。',
      color: '#C9A227'
    },
    {
      id: 'street', name: '市井青年', en: 'THE LOCAL', diff: 2, age: 23,
      cash: 30000, income: 12000, expense: 9000,
      attrs: { health: 85, mood: 62, fame: 10, network: 15, addiction: 5 },
      skills: { work: 2, invest: 0, social: 1, learn: 1 },
      traits: [{ n: '能吃苦', d: '打工与经营收入 +25%' }, { n: '没本钱', d: '起始现金只有 3 万' }],
      eff: { work: 0.25 },
      goal: '在澳门买下第一间属于自己的房子',
      intro: '你在氹仔的旧楼长大，楼下就是通宵亮着的赌场灯牌。',
      color: '#7FC0DD'
    },
    {
      id: 'dealer', name: '荷官世家', en: 'THE DEALER', diff: 3, age: 29,
      cash: 120000, income: 22000, expense: 16000,
      attrs: { health: 65, mood: 60, fame: 30, network: 45, addiction: 20 },
      skills: { work: 1, invest: 1, social: 1, learn: 2 },
      traits: [{ n: '懂行', d: '进入赌场时额外提示台面与厅房信息' }, { n: '见过太多', d: '赌瘾增长比常人快 20%' }],
      eff: { addiction: 1.2, info: true },
      goal: '从发牌的人，变成定规则的人',
      intro: '你父亲发了三十年牌，他说：赌场从不输，输的是人。',
      color: '#7E57C2'
    },
    {
      id: 'merchant', name: '落魄商人', en: 'THE MERCHANT', diff: 5, age: 41,
      cash: 40000, income: 0, expense: 20000,
      attrs: { health: 55, mood: 38, fame: 50, network: 55, addiction: 10 },
      skills: { work: 1, invest: 2, social: 2, learn: 1 },
      traits: [{ n: '谈判', d: '投资成功时收益 +30%' }, { n: '旧债', d: '起始负债 120 万，月息 1.2%' }],
      eff: { invest: 0.3 },
      goal: '还清旧债，把失去的公司买回来',
      intro: '三年前你还有一间厂，现在只剩一叠法院传票。',
      color: '#C0392B',
      debts: [{ name: '旧公司欠款', amount: 1200000, rate: 0.012 }]
    },
    {
      id: 'athlete', name: '退役运动员', en: 'THE ATHLETE', diff: 2, age: 31,
      cash: 400000, income: 8000, expense: 12000,
      attrs: { health: 95, mood: 70, fame: 40, network: 35, addiction: 0 },
      skills: { work: 1, invest: 0, social: 1, learn: 1 },
      traits: [{ n: '自律', d: '赌瘾增长减半，休养恢复更好' }, { n: '旧伤', d: '健康低于 40 时收入减半' }],
      eff: { addiction: 0.5, rest: 1.5, fragile: true },
      goal: '找到退役后仍值得全力以赴的事',
      intro: '你的膝盖撑不住了，但你还不想认输。',
      color: '#2E9E8F'
    },
    {
      id: 'lottery', name: '彩票暴发户', en: 'THE WINNER', diff: 3, age: 35,
      cash: 4800000, income: 0, expense: 60000,
      attrs: { health: 70, mood: 75, fame: 15, network: 20, addiction: 35 },
      skills: { work: 0, invest: 0, social: 1, learn: 1 },
      traits: [{ n: '横财', d: '起始现金 480 万，全模式最高' }, { n: '挥霍', d: '每月生活开销 +60%' }],
      eff: { expense: 1.6 },
      goal: '证明自己不只是运气好',
      intro: '一张刮刮乐改变了一切，也把所有人带到了你身边。',
      color: '#D4AF37'
    },
    {
      id: 'stowaway', name: '偷渡客', en: 'THE STOWAWAY', diff: 5, age: 26,
      cash: 8000, income: 8000, expense: 6000,
      attrs: { health: 80, mood: 45, fame: 0, network: 5, addiction: 0 },
      skills: { work: 1, invest: 0, social: 0, learn: 1 },
      traits: [{ n: '韧性', d: '破产时仍可打黑工，现金不会归零' }, { n: '无身份', d: '无法通过正规渠道贷款，稽查风险高' }],
      eff: { noLoan: true, raid: true },
      goal: '拿到一张合法的澳门身份证',
      intro: '你藏在货柜里过了关，蛇头说：十五万，慢慢还。',
      color: '#8D6E63',
      debts: [{ name: '蛇头借款', amount: 150000, rate: 0.02 }]
    },
    {
      id: 'star', name: '过气明星', en: 'THE STAR', diff: 3, age: 38,
      cash: 600000, income: 30000, expense: 50000,
      attrs: { health: 60, mood: 55, fame: 75, network: 65, addiction: 25 },
      skills: { work: 0, invest: 1, social: 2, learn: 1 },
      traits: [{ n: '光环', d: '社交收益 +50%，商演与代言机会更多' }, { n: '成瘾', d: '赌瘾增长 +50%，更难戒断' }],
      eff: { social: 0.5, addiction: 1.5 },
      goal: '在被人彻底遗忘之前，再红一次',
      intro: '海报还挂在旧戏院门口，名字已经褪色了。',
      color: '#B76E9B'
    }
  ];

  var ASSETS = [
    { id: 'flat', name: '二手小公寓', price: 600000, income: 6000, dep: 0.001, mood: 4, fame: 0, desc: '月租 6,000 MOP，可贷款' },
    { id: 'shop', name: '临街商铺', price: 2400000, income: 26000, dep: 0.0005, mood: 6, fame: 2, desc: '月租 26,000 MOP，可贷款' },
    { id: 'car', name: '限量跑车', price: 800000, income: 0, dep: 0.012, mood: 12, fame: 8, desc: '每月贬值 1.2%，不能贷款' },
    { id: 'startup', name: '创业公司股份', price: 4000000, income: 0, dep: 0, mood: 2, fame: 10, desc: '每月 45% 概率分红 1%–4%，25% 概率亏损', risky: true }
  ];

  function originOf(id) {
    for (var i = 0; i < ORIGINS.length; i++) if (ORIGINS[i].id === id) return ORIGINS[i];
    return ORIGINS[0];
  }

  /* ---------------- 存档读写 ---------------- */
  function load(u) {
    try {
      var raw = localStorage.getItem(key(u));
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || s.v !== VERSION) return null;
      return s;
    } catch (e) { return null; }
  }
  function save(s) {
    if (!s) return;
    s.v = VERSION;
    s.updated = Date.now();
    try { localStorage.setItem(key(s.u), JSON.stringify(s)); } catch (e) {}
  }
  function hasSave(u) { return !!load(u); }

  function blankDex() { return []; }
  function dex(u) {
    try { return JSON.parse(localStorage.getItem(dexKey(u))) || blankDex(); } catch (e) { return blankDex(); }
  }
  function addDex(entry, u) {
    var list = dex(u);
    for (var i = 0; i < list.length; i++) if (list[i].id === entry.id) { list[i] = entry; saveDex(list, u); return list; }
    list.push(entry);
    saveDex(list, u);
    return list;
  }
  function saveDex(list, u) {
    try { localStorage.setItem(dexKey(u), JSON.stringify(list)); } catch (e) {}
  }

  /* ---------------- 创建 / 重置 ---------------- */
  function create(originId) {
    var o = originOf(originId);
    var s = {
      v: VERSION, u: user(), origin: o.id, created: Date.now(), updated: Date.now(),
      year: START.year, month: START.month, age: o.age,
      cash: o.cash, income: o.income,
      health: o.attrs.health, mood: o.attrs.mood, fame: o.attrs.fame,
      network: o.attrs.network, addiction: o.attrs.addiction,
      skills: Object.assign({ work: 1, invest: 1, social: 1, learn: 1 }, o.skills || {}),
      assets: [], debts: (o.debts || []).map(function (d) { return Object.assign({}, d); }),
      ap: AP_PER_MONTH, months: 0,
      casino: { sessions: 0, rounds: 0, net: 0, biggestWin: 0, biggestLoss: 0, byGame: {} },
      session: null,
      flags: {},
      log: [{ t: START.year + '-' + START.month, k: 'start', txt: o.intro }],
      ending: null
    };
    save(s);
    return s;
  }
  function reset() {
    try { localStorage.removeItem(key()); } catch (e) {}
    return true;
  }

  /* ---------------- 计算 ---------------- */
  function origin(s) { return originOf(s.origin); }
  function debtTotal(s) {
    return s.debts.reduce(function (n, d) { return n + (+d.amount || 0); }, 0);
  }
  function assetTotal(s) {
    return s.assets.reduce(function (n, a) { return n + (+a.value || 0); }, 0);
  }
  function netWorth(s) { return money(s.cash + assetTotal(s) - debtTotal(s)); }
  function monthLabel(s) { return s.year + ' 年 ' + s.month + ' 月'; }
  function log(s, txt, kind) {
    s.log.unshift({ t: s.year + '-' + s.month, k: kind || 'info', txt: txt });
    if (s.log.length > 80) s.log.length = 80;
  }

  /* ---------------- 行动 ---------------- */
  function fail(msg) { return { ok: false, msg: msg }; }
  function done(s, msg, tone) {
    log(s, msg, tone || 'info');
    save(s);
    return { ok: true, msg: msg, tone: tone || 'info' };
  }
  function useAp(s) { s.ap = Math.max(0, s.ap - 1); }

  function act(id, opt) {
    var s = load();
    if (!s) return fail('还没有人生存档');
    if (s.ending) return fail('这一世已经结束，请开始新的人生');
    if (s.ap <= 0) return fail('本月行动点已用完，先结束本月');
    opt = opt || {};
    var o = origin(s);

    if (id === 'work') {
      var add = Math.round(Math.max(2000, s.income * 0.5 * (1 + (o.eff.work || 0)) * rnd(0.85, 1.15)));
      s.cash += add;
      s.health = clamp(s.health - 2, 0, 100);
      s.mood = clamp(s.mood - 1, 0, 100);
      s.skills.work = Math.min(9, s.skills.work + 0.15);
      useAp(s);
      return done(s, '加班与副业带来额外收入 ' + add.toLocaleString() + ' MOP', 'in');
    }

    if (id === 'invest') {
      var amount = Math.max(0, Math.round(+opt.amount || 0));
      if (amount < 10000) return fail('投资金额至少 10,000 MOP');
      if (amount > s.cash * 0.85) return fail('最多可投入现金的 85%');
      var risky = opt.risk === 'high';
      var winP = (risky ? 0.42 : 0.64) + s.skills.invest * 0.025;
      var win = Math.random() < winP;
      var pct = risky ? (win ? rnd(0.15, 0.42) : -rnd(0.15, 0.35))
                      : (win ? rnd(0.05, 0.13) : -rnd(0.04, 0.10));
      if (win) pct *= (1 + (o.eff.invest || 0));
      var pl = Math.round(amount * pct);
      s.cash += pl;
      s.mood = clamp(s.mood + (win ? 4 : -7), 0, 100);
      s.skills.invest = Math.min(9, s.skills.invest + 0.1);
      useAp(s);
      return done(s, (win ? '投资获利 ' : '投资亏损 ') + (pl > 0 ? '+' : '') + pl.toLocaleString() + ' MOP',
        win ? 'in' : 'out');
    }

    if (id === 'learn') {
      var fee = Math.min(20000, Math.round(s.cash * 0.15));
      if (s.cash < 5000) return fail('现金不足，先赚点钱再进修');
      s.cash -= fee;
      var keys = ['work', 'invest', 'social'];
      var k = pick(keys);
      s.skills[k] = Math.min(9, s.skills[k] + 1);
      s.mood = clamp(s.mood - 2, 0, 100);
      s.health = clamp(s.health - 1, 0, 100);
      useAp(s);
      return done(s, '进修花费 ' + fee.toLocaleString() + ' MOP，' +
        ({ work: '经营', invest: '投资', social: '社交' })[k] + '能力 +1');
    }

    if (id === 'social') {
      var cost = Math.min(15000, Math.round(s.cash * 0.08));
      if (s.cash - cost < 0) return fail('现金不足，社交也需要成本');
      s.cash -= cost;
      var gain = Math.round((6 + s.skills.social * 2) * (1 + (o.eff.social || 0)));
      s.network = clamp(s.network + gain, 0, 100);
      s.fame = clamp(s.fame + 2, 0, 100);
      s.mood = clamp(s.mood + 5, 0, 100);
      s.skills.social = Math.min(9, s.skills.social + 0.2);
      useAp(s);
      return done(s, '社交花费 ' + cost.toLocaleString() + ' MOP，人脉 +' + gain + '，声望 +2');
    }

    if (id === 'rest') {
      var h = Math.round(10 * (o.eff.rest || 1));
      s.health = clamp(s.health + h, 0, 100);
      s.mood = clamp(s.mood + 6, 0, 100);
      s.addiction = clamp(s.addiction - 5 * (o.eff.rest || 1), 0, 100);
      useAp(s);
      return done(s, '休养：健康 +' + h + '，心情 +6，赌瘾下降');
    }

    if (id === 'repay') {
      var pay = Math.max(0, Math.round(+opt.amount || 0));
      if (pay <= 0) return fail('请输入还款金额');
      if (pay > s.cash) return fail('现金不足，无法偿还这么多');
      s.cash -= pay;
      var left = pay;
      s.debts.forEach(function (d) {
        if (left <= 0) return;
        var cut = Math.min(d.amount, left);
        d.amount -= cut;
        left -= cut;
      });
      s.debts = s.debts.filter(function (d) { return d.amount > 0.5; });
      s.mood = clamp(s.mood + 4, 0, 100);
      s.fame = clamp(s.fame + 1, 0, 100);
      useAp(s);
      return done(s, '偿还 ' + pay.toLocaleString() + ' MOP 债务', 'in');
    }

    if (id === 'buy') {
      var item = null;
      for (var i = 0; i < ASSETS.length; i++) if (ASSETS[i].id === opt.assetId) item = ASSETS[i];
      if (!item) return fail('请选择要购置的资产');
      var full = !!opt.full || item.id === 'car';
      var down = full ? item.price : Math.round(item.price * 0.3);
      if (s.cash < down) return fail('首付不足，需要 ' + down.toLocaleString() + ' MOP');
      s.cash -= down;
      if (!full) {
        s.debts.push({ name: item.name + ' 按揭', amount: money(item.price - down), rate: 0.015 });
      }
      s.assets.push({
        id: item.id, name: item.name, value: item.price, income: item.income,
        dep: item.dep, risky: !!item.risky
      });
      s.mood = clamp(s.mood + (item.mood || 0), 0, 100);
      s.fame = clamp(s.fame + (item.fame || 0), 0, 100);
      useAp(s);
      return done(s, '购置「' + item.name + '」，' + (full ? '全款' : '首付 ' + down.toLocaleString() + ' MOP，其余按揭') +
        (item.income ? '，每月租金 ' + item.income.toLocaleString() + ' MOP' : ''), 'in');
    }

    return fail('未知行动');
  }

  /* ---------------- 赌场：进入与每局回写 ---------------- */
  function gambleOpen() {
    var s = load();
    if (!s) return { ok: false, msg: '还没有人生存档' };
    if (s.ending) return { ok: false, msg: '这一世已经结束' };
    if (s.flags.banMonth === s.months) return { ok: false, msg: '本月被列入赌场观察名单，无法入场' };
    if (s.ap <= 0) return { ok: false, msg: '本月行动点已用完，先结束本月' };
    if (s.cash < 1000) return { ok: false, msg: '随身现金不足 1,000 MOP，无法入场' };
    useAp(s);
    s.casino.sessions++;
    s.session = {
      start: s.cash, bank: s.cash, rounds: 0, net: 0, byGame: {}, at: Date.now()
    };
    s.flags.gambleThisMonth = true;
    save(s);
    return { ok: true, bank: s.cash };
  }

  /* 每局结算后由 life-bridge 调用：bank 是游戏台面余额，net 是本局净输赢 */
  function recordGamble(game, bank, net, stake) {
    var s = load();
    if (!s || s.ending) return null;
    net = +net || 0;
    stake = +stake || 0;
    s.cash = money(+bank || 0);
    var c = s.casino;
    c.rounds++;
    c.net += net;
    var g = c.byGame[game] || (c.byGame[game] = { rounds: 0, net: 0, stake: 0 });
    g.rounds++; g.net += net; g.stake += stake;
    if (net > c.biggestWin) c.biggestWin = net;
    if (net < c.biggestLoss) c.biggestLoss = net;
    var o = origin(s);
    s.addiction = clamp(s.addiction + (0.12 + Math.min(0.6, stake / 30000) ) * (o.eff.addiction || 1), 0, 100);
    if (net > 0) {
      s.mood = clamp(s.mood + 1, 0, 100);
    } else if (net < 0) {
      s.mood = clamp(s.mood - 1.2 + (o.eff.loseMood || 0), 0, 100);
    }
    if (s.session) {
      s.session.rounds++;
      s.session.net += net;
      s.session.bank = s.cash;
      var sg = s.session.byGame[game] || (s.session.byGame[game] = { rounds: 0, net: 0 });
      sg.rounds++; sg.net += net;
    }
    save(s);
    return { cash: s.cash, session: s.session };
  }

  /* 游戏内「补充筹码」= 高利贷：现金与负债同步增长 */
  function borrow(amount, label) {
    var s = load();
    if (!s || s.ending) return { ok: false };
    amount = Math.max(0, Math.round(+amount || 0));
    var debt = Math.round(amount * 1.25);
    s.cash += amount;
    s.debts.push({ name: '高利贷 · ' + (label || '赌场补码'), amount: debt, rate: 0.03 });
    s.addiction = clamp(s.addiction + 2, 0, 100);
    log(s, '向赌场叠码仔借入 ' + amount.toLocaleString() + ' MOP，实际负债 ' + debt.toLocaleString() + ' MOP', 'out');
    if (s.session) s.session.bank = s.cash;
    save(s);
    return { ok: true, cash: s.cash, debt: debt };
  }

  function session() {
    var s = load();
    return s ? s.session : null;
  }

  /* ---------------- 月度事件 ---------------- */
  var EVENTS = [
    {
      id: 'bailiff', w: 3,
      when: function (s) { return debtTotal(s) > 300000 && s.cash < 60000; },
      run: function (s) {
        var bump = Math.round(debtTotal(s) * 0.05);
        s.debts.push({ name: '追债违约金', amount: bump, rate: 0.03 });
        s.health = clamp(s.health - 6, 0, 100);
        s.mood = clamp(s.mood - 10, 0, 100);
        return { title: '追债的人找上门', text: '对方加收了 ' + bump.toLocaleString() + ' MOP 违约金，健康与心情都受到影响。' };
      }
    },
    {
      id: 'family', w: 4,
      when: function (s) { return s.age >= 24 && Math.random() < 0.1; },
      run: function (s) {
        var cost = Math.min(Math.max(0, s.cash), 80000);
        var short = 80000 - cost;
        s.cash -= cost;
        if (short > 0) s.debts.push({ name: '家人医疗借款', amount: short, rate: 0.02 });
        s.mood = clamp(s.mood - 10, 0, 100);
        return { title: '家人突然住院', text: '医疗支出花掉 ' + cost.toLocaleString() + ' MOP' + (short > 0 ? '，另借 ' + short.toLocaleString() + ' MOP' : '') + '。' };
      }
    },
    {
      id: 'tip', w: 6,
      when: function (s) { return s.cash > 150000; },
      run: function (s) {
        var amt = Math.round(Math.min(s.cash * 0.25, 200000));
        var win = Math.random() < 0.52 + s.skills.invest * 0.02;
        var pl = Math.round(amt * (win ? rnd(0.08, 0.2) : -rnd(0.05, 0.15)));
        s.cash += pl;
        s.mood = clamp(s.mood + (win ? 5 : -5), 0, 100);
        return { title: win ? '朋友介绍的内幕机会' : '听信了不该听的消息', text: (win ? '赚了 ' : '亏了 ') + Math.abs(pl).toLocaleString() + ' MOP。' };
      }
    },
    {
      id: 'invite', w: 5,
      when: function (s) { return s.casino.rounds >= 40; },
      run: function (s) {
        s.cash += 30000;
        s.addiction = clamp(s.addiction + 4, 0, 100);
        s.fame = clamp(s.fame + 3, 0, 100);
        return { title: '赌场寄来邀请函', text: '一份 30,000 MOP 的泥码和一张“贵宾体验”邀请函。赌瘾上升了。' };
      }
    },
    {
      id: 'lottery', w: 1,
      when: function () { return Math.random() < 0.012; },
      run: function (s) {
        var win = irnd(300000, 3000000);
        s.cash += win;
        s.mood = clamp(s.mood + 20, 0, 100);
        return { title: '中了头奖', text: '税后 ' + win.toLocaleString() + ' MOP 直接打进账户。' };
      }
    },
    {
      id: 'romance', w: 4,
      when: function (s) { return s.age < 52 && s.fame > 30; },
      run: function (s) {
        s.mood = clamp(s.mood + 10, 0, 100);
        s.network = clamp(s.network + 4, 0, 100);
        return { title: '一段新的关系', text: '有人不介意你的过去，心情 +10，人脉 +4。' };
      }
    },
    {
      id: 'breakup', w: 3,
      when: function (s) { return s.addiction > 65; },
      run: function (s) {
        var lost = Math.round(s.cash * 0.15);
        s.cash -= lost;
        s.mood = clamp(s.mood - 15, 0, 100);
        return { title: '关系破裂', text: '对方带走了 ' + lost.toLocaleString() + ' MOP，也带走了你最后一点体面。' };
      }
    },
    {
      id: 'layoff', w: 4,
      when: function (s) { return s.income > 0; },
      run: function (s) {
        s.cash -= 20000;
        s.mood = clamp(s.mood - 6, 0, 100);
        return { title: '收入被削', text: '奖金取消、排班减少，本月额外损失 20,000 MOP。' };
      }
    },
    {
      id: 'health', w: 3,
      when: function (s) { return s.health < 35; },
      run: function (s) {
        var cost = Math.min(s.cash, 60000);
        s.cash -= cost;
        s.health = clamp(s.health + 18, 0, 100);
        s.mood = clamp(s.mood - 4, 0, 100);
        return { title: '身体报警', text: '住院花了 ' + Math.max(0, cost).toLocaleString() + ' MOP，健康回到 ' + Math.round(s.health) + '。' };
      }
    },
    {
      id: 'friend', w: 5,
      when: function (s) { return s.network > 55; },
      run: function (s) {
        var gain = irnd(20000, 80000);
        s.cash += gain;
        return { title: '老友拉你一把', text: '一份临时生意分成 ' + gain.toLocaleString() + ' MOP。' };
      }
    },
    {
      id: 'scam', w: 4,
      when: function (s) { return s.cash > 120000; },
      run: function (s) {
        if (Math.random() > 0.45) return { title: '可疑电话', text: '你识破了骗局，什么也没发生。' };
        var lost = Math.round(s.cash * rnd(0.08, 0.18));
        s.cash -= lost;
        s.mood = clamp(s.mood - 8, 0, 100);
        return { title: '被骗了', text: '一笔“稳赚”的投资骗走 ' + lost.toLocaleString() + ' MOP。' };
      }
    },
    {
      id: 'property', w: 4,
      when: function (s) { return s.assets.length > 0; },
      run: function (s) {
        var pct = rnd(-0.06, 0.08);
        s.assets.forEach(function (a) { a.value = Math.max(0, Math.round(a.value * (1 + pct))); });
        return { title: '资产重估', text: '名下资产整体' + (pct >= 0 ? '升值 ' : '贬值 ') + Math.abs(pct * 100).toFixed(1) + '%。' };
      }
    },
    {
      id: 'typhoon', w: 5,
      when: function () { return true; },
      run: function (s) {
        var cost = irnd(10000, 40000);
        s.cash -= cost;
        return { title: '台风过境', text: '停业与修缮额外支出 ' + cost.toLocaleString() + ' MOP。' };
      }
    },
    {
      id: 'blacklist', w: 2,
      when: function (s) { return s.casino.rounds > 260; },
      run: function (s) {
        s.flags.banMonth = s.months + 1;
        s.addiction = clamp(s.addiction - 10, 0, 100);
        s.mood = clamp(s.mood - 8, 0, 100);
        return { title: '被列入观察名单', text: '下个月禁止入场。强制冷静，赌瘾反而下降。' };
      }
    },
    {
      id: 'charity', w: 3,
      when: function (s) { return s.fame > 60 && s.cash > 200000; },
      run: function (s) {
        s.cash -= 50000;
        s.fame = clamp(s.fame + 8, 0, 100);
        s.network = clamp(s.network + 8, 0, 100);
        return { title: '慈善晚宴', text: '捐出 50,000 MOP，声望 +8，人脉 +8。' };
      }
    },
    {
      id: 'raid', w: 4,
      when: function (s) { return origin(s).eff.raid && Math.random() < 0.14; },
      run: function (s) {
        var fine = 30000;
        var pay = Math.min(s.cash, fine);
        s.cash -= pay;
        if (fine - pay > 0) s.debts.push({ name: '罚款欠款', amount: fine - pay, rate: 0.02 });
        s.mood = clamp(s.mood - 8, 0, 100);
        return { title: '黑工稽查', text: '罚款 ' + fine.toLocaleString() + ' MOP，没交完的部分转为欠款。' };
      }
    }
  ];

  function rollEvent(s) {
    var pool = EVENTS.filter(function (e) { return !e.when || e.when(s); });
    if (!pool.length) return null;
    if (Math.random() > 0.62) return null;
    var total = pool.reduce(function (n, e) { return n + e.w; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) return pool[i].run(s);
    }
    return pool[pool.length - 1].run(s);
  }

  /* ---------------- 月度结算 ---------------- */
  function endMonth() {
    var s = load();
    if (!s || s.ending) return null;
    var o = origin(s);
    var rep = {
      period: monthLabel(s), lines: [], income: 0, expense: 0, interest: 0,
      event: null, ending: null
    };

    var salary = Math.round(s.income * (1 + s.skills.work * 0.06) *
      (o.eff.fragile && s.health < 40 ? 0.5 : 1));
    s.cash += salary;
    rep.income += salary;
    rep.lines.push({ k: 'in', txt: '工资 / 固定收入', val: salary });

    s.assets.forEach(function (a) {
      if (a.risky) {
        var r = Math.random();
        var pl = 0;
        if (r < 0.45) pl = Math.round(a.value * rnd(0.01, 0.04));
        else if (r < 0.7) pl = -Math.round(a.value * rnd(0.01, 0.03));
        s.cash += pl;
        if (pl) {
          if (pl > 0) rep.income += pl; else rep.expense += -pl;
          rep.lines.push({ k: pl > 0 ? 'in' : 'out', txt: a.name + (pl > 0 ? ' 分红' : ' 亏损'), val: pl });
        }
      } else if (a.income) {
        s.cash += a.income;
        rep.income += a.income;
        rep.lines.push({ k: 'in', txt: a.name + ' 租金', val: a.income });
      }
      if (a.dep) a.value = Math.max(0, Math.round(a.value * (1 - a.dep)));
    });

    var living = Math.round(o.expense * ((o.eff.expense || 1) + s.assets.length * 0.06));
    s.cash -= living;
    rep.expense += living;
    rep.lines.push({ k: 'out', txt: '生活开销', val: -living });

    s.debts.forEach(function (d) {
      var interest = Math.round(d.amount * d.rate);
      d.amount += interest;
      s.cash -= interest;
      rep.interest += interest;
      rep.lines.push({ k: 'out', txt: d.name + ' 利息', val: -interest });
    });

    var hLoss = 2 + (s.addiction > 60 ? 2 : 0) + (s.age > 50 ? 1 : 0);
    s.health = clamp(s.health - hLoss, 0, 100);
    s.addiction = clamp(s.addiction + 1 * (o.eff.addiction || 1), 0, 100);
    rep.lines.push({ k: 'up', txt: '健康自然消耗', val: -hLoss });

    var ev = rollEvent(s);
    if (ev) { rep.event = ev; rep.lines.push({ k: 'event', txt: ev.title, val: 0 }); }

    /* 事件也可能把现金打成负数，统一在月末转成透支卡债 */
    if (s.cash < 0) {
      var cc = null;
      for (var ci = 0; ci < s.debts.length; ci++) if (s.debts[ci].name === '信用卡透支') cc = s.debts[ci];
      if (cc) cc.amount += -s.cash;
      else s.debts.push({ name: '信用卡透支', amount: -s.cash, rate: 0.025 });
      rep.lines.push({ k: 'out', txt: '现金透支转为卡债', val: s.cash });
      s.cash = 0;
    }

    s.months++;
    s.month++;
    if (s.month > 12) { s.month = 1; s.year++; s.age++; }
    s.ap = AP_PER_MONTH;
    s.session = null;
    s.flags.gambleThisMonth = false;

    var end = endingOf(s);
    if (end) {
      s.ending = end;
      rep.ending = end;
      addDex({
        id: end.id, name: end.name, at: Date.now(), origin: o.name,
        netWorth: netWorth(s), months: s.months, age: s.age, kind: end.kind
      });
    }
    rep.lines.push({ k: 'balance', txt: '月末现金', val: Math.round(s.cash) });
    save(s);
    return rep;
  }

  /* ---------------- 结局 ---------------- */
  var ENDINGS = {
    bankrupt: { id: 'bankrupt', name: '破产清算', kind: 'bad', desc: '债务吞掉最后一枚筹码，法院封了你的门。' },
    addict: { id: 'addict', name: '赌徒末路', kind: 'bad', desc: '健康与理智同时见底，牌桌成了唯一的家。' },
    legend: { id: 'legend', name: '赌王传奇', kind: 'best', desc: '你的名字被写进贵宾厅的传说，连庄家都记得你的下注方式。' },
    tycoon: { id: 'tycoon', name: '商业帝国', kind: 'good', desc: '赌场只是起点，你把筹码换成了整座城市的股份。' },
    richRetire: { id: 'richRetire', name: '富足退休', kind: 'good', desc: '在还能体面的时候离场，海景房的阳台正对南湾。' },
    stable: { id: 'stable', name: '安稳一生', kind: 'good', desc: '没有暴富，也没有崩塌。你把日子过成了自己的。' },
    poor: { id: 'poor', name: '清贫晚年', kind: 'meh', desc: '钱不多，但每天早上还能自己煮一杯咖啡。' },
    debtRetire: { id: 'debtRetire', name: '负债余生', kind: 'bad', desc: '你停下来了，但账单没有。' }
  };
  function endingOf(s) {
    var nw = netWorth(s);
    if (nw <= -2000000) return ENDINGS.bankrupt;
    if (s.addiction >= 96 && s.health <= 15) return ENDINGS.addict;
    if (nw >= 100000000) return ENDINGS.legend;
    if (nw >= 30000000) return ENDINGS.tycoon;
    if (s.age >= 65) {
      if (nw >= 10000000) return ENDINGS.richRetire;
      if (nw >= 1000000) return ENDINGS.stable;
      if (nw >= 0) return ENDINGS.poor;
      return ENDINGS.debtRetire;
    }
    return null;
  }
  /* 主动收手：提前退休 */
  function finish() {
    var s = load();
    if (!s || s.ending) return null;
    var nw = netWorth(s);
    var end = nw >= 10000000 ? ENDINGS.richRetire : nw >= 1000000 ? ENDINGS.stable
      : nw >= 0 ? ENDINGS.poor : ENDINGS.debtRetire;
    s.ending = end;
    addDex({
      id: end.id, name: end.name, at: Date.now(), origin: origin(s).name,
      netWorth: nw, months: s.months, age: s.age, kind: end.kind
    });
    save(s);
    return end;
  }
  function allEndings() { return Object.keys(ENDINGS).map(function (k) { return ENDINGS[k]; }); }

  window.BJLife = {
    VERSION: VERSION, ORIGINS: ORIGINS, ASSETS: ASSETS, ENDINGS: ENDINGS,
    user: user, key: key, dexKey: dexKey,
    load: load, save: save, hasSave: hasSave, create: create, reset: reset,
    dex: dex, allEndings: allEndings,
    origin: origin, netWorth: netWorth, debtTotal: debtTotal, assetTotal: assetTotal,
    monthLabel: monthLabel, act: act, gambleOpen: gambleOpen, recordGamble: recordGamble,
    borrow: borrow, session: session, endMonth: endMonth, finish: finish
  };
})();