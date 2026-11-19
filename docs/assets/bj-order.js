/* ============================================================
   bj-order.js — 礼遇兑换订单：订单号 / 票据凭证 / 出票与核销仪式
   商城与会员中心共用；落库由调用方同步完成，本模块只做凭证与演出
   ============================================================ */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const fmt = n => Math.round(n).toLocaleString('zh-CN');
  const pad = n => String(n).padStart(2, '0');

  function tsText(ts) {
    const t = new Date(ts || Date.now());
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
  }

  /* 订单号：MC-日期-时间尾+随机，钱包内查重 */
  function makeNo() {
    const t = new Date();
    const ymd = `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}`;
    let orders = [];
    try { orders = (window.BJWallet ? window.BJWallet.load() : {}).orders || []; } catch (e) {}
    for (let i = 0; i < 8; i++) {
      const tail = (Date.now().toString(36).slice(-3) + Math.random().toString(36).slice(2, 5)).toUpperCase();
      const no = `MC-${ymd}-${tail}`;
      if (!orders.some(o => o.no === no)) return no;
    }
    return `MC-${ymd}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  function catLabel(cat, EN) {
    const c = (window.BJ_MALL ? window.BJ_MALL.CATS : []).find(x => x.id === cat);
    return c ? (EN ? c.en : c.zh) : (EN ? 'Benefit' : '礼遇');
  }

  /* 票据凭证 HTML：抬头 / 订单号 / 商品 / 账目 / 条码 / 状态章 */
  function receiptHTML(o, prog, EN) {
    const used = o.status === 'used';
    const rows = [
      [EN ? 'Benefit value' : '礼遇价值', `MOP ${fmt(o.value || 0)}`],
      [EN ? 'Points paid' : '实付积分', `${fmt(o.price || 0)} ${EN ? 'pts' : '分'}`]
    ];
    if (o.disc) rows.push([EN ? 'Member discount' : '会员折扣', `−${o.disc}%`]);
    rows.push([EN ? 'Programme' : '卡系', prog ? prog.brand : (o.venue || '—')]);
    rows.push([EN ? 'Venue' : '场馆', o.venue || '—']);
    rows.push([EN ? 'Issued at' : '出票时间', tsText(o.ts)]);
    if (used) rows.push([EN ? 'Redeemed at' : '核销时间', tsText(o.usedTs)]);
    return `
      <div class="receipt${used ? ' used' : ''}">
        <div class="rc-head">
          <b>${prog ? prog.brand : 'MACAU CASINO SIMULATOR'}</b>
          <span>${EN ? 'REDEMPTION VOUCHER' : '礼遇兑换凭证'}</span>
        </div>
        <div class="rc-no">${EN ? 'ORDER' : '订单号'} <b>${o.no || (EN ? 'legacy' : '旧单')}</b></div>
        <div class="rc-item">
          <b>${o.name || '—'}</b>
          <small>${catLabel(o.cat, EN)} · ${EN ? 'SIMULATED' : '模拟权益'}</small>
        </div>
        <div class="rc-rows">${rows.map(r => `<span>${r[0]}</span><b>${r[1]}</b>`).join('')}</div>
        <div class="rc-bar" aria-hidden="true"></div>
        <div class="rc-foot">
          <span>${EN ? 'Present this voucher at the venue desk.' : '凭此券至场馆礼宾台核销使用。'}</span>
          <span class="rc-stamp ${used ? 'used' : 'issued'}">${used ? (EN ? 'USED' : '已核销') : (EN ? 'ISSUED' : '已出票')}</span>
        </div>
      </div>`;
  }

  /* ---------------- 仪式遮罩 ---------------- */
  let busy = false;
  function veil() {
    let v = $('.ord-veil');
    if (!v) {
      v = document.createElement('div');
      v.className = 'ord-veil';
      document.body.appendChild(v);
    }
    return v;
  }
  function drop(v) { if (v && v.parentNode) v.parentNode.removeChild(v); busy = false; }
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function stepsHTML(EN) {
    const s = EN ? ['Request accepted', 'Points deducted', 'Voucher issued']
                 : ['受理兑换申请', '扣减会员积分', '礼遇凭证出票'];
    return `<div class="ord-steps">${s.map(x => `<div><i>✓</i><span>${x}</span></div>`).join('')}</div>`;
  }

  function runShow(v, order, prog, EN, opts) {
    const o = opts || {};
    const sealText = o.seal || (EN ? 'ISSUED' : '已出票');
    v.innerHTML = `
      <div class="ord-box">
        ${o.steps === false ? '' : stepsHTML(EN)}
        <div class="ord-print">${receiptHTML(order, prog, EN)}</div>
        ${o.noSeal ? '' : `<div class="ord-seal${o.sealClass ? ' ' + o.sealClass : ''}">${sealText}</div>`}
        <button class="ord-done" type="button">${EN ? 'Done' : '完 成'}</button>
      </div>`;
    const steps = Array.from(v.querySelectorAll('.ord-steps > div'));
    const print = $('.ord-print', v);
    const seal = $('.ord-seal', v);
    const done = $('.ord-done', v);
    const finish = () => { drop(v); if (o.onDone) o.onDone(); };
    done.addEventListener('click', finish);
    if (reduced() || o.noSeal) {
      steps.forEach(x => x.classList.add('ok'));
      print.classList.add('print');
      if (seal) seal.classList.add('hit');
      done.classList.add('show');
      return;
    }
    steps.forEach((x, i) => setTimeout(() => x.classList.add('ok'), 150 + i * 450));
    setTimeout(() => print.classList.add('print'), o.steps === false ? 100 : 1200);
    setTimeout(() => { seal.classList.add('hit'); v.classList.add('thud'); }, o.steps === false ? 700 : 1950);
    setTimeout(() => done.classList.add('show'), o.steps === false ? 1000 : 2350);
  }

  /* 出票仪式：调用方须先同步落库（扣积分 + orders.unshift + save） */
  function ceremony(order, opts) {
    if (busy) return false;
    busy = true;
    const o = opts || {};
    const EN = !!o.en;
    runShow(veil(), order, o.prog, EN, o);
    return true;
  }

  /* 核销盖章：调用方须先写 status:'used' / usedTs 并 save */
  function stampUsed(order, opts) {
    if (busy) return false;
    busy = true;
    const o = opts || {};
    const EN = !!o.en;
    runShow(veil(), order, o.prog, EN, Object.assign({}, o, {
      steps: false,
      seal: EN ? 'USED' : '已核销',
      sealClass: 'used'
    }));
    return true;
  }

  /* 凭证查看：静态票据 + 完成按钮，无仪式动画 */
  function view(order, opts) {
    if (busy) return false;
    busy = true;
    const o = opts || {};
    runShow(veil(), order, o.prog, !!o.en, Object.assign({}, o, { steps: false, noSeal: true }));
    return true;
  }

  window.BJOrder = { makeNo, receiptHTML, ceremony, stampUsed, view, tsText };
})();