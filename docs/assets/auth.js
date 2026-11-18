/* ============================================================
   auth.js — 本地账号与会话门禁（全站共用）
   账号与会话只存在本机浏览器 localStorage，不连接任何网络：
     bj.auth.users.v1    { 用户名小写: { name, salt, hash, created } }
     bj.auth.session.v1  { u, name, remember, exp }
   需要登录的页面在 <html> 上加 data-auth="required"，
   并在 <head> 引入本文件：未登录立即跳转 login.html?next=当前页。
   登录后导航自动出现「用户名 + 退出」，未登录的公开页出现「登录」。
   ============================================================ */
(function () {
  var UKEY = 'bj.auth.users.v1';
  var SKEY = 'bj.auth.session.v1';
  var page = location.pathname.split('/').pop() || 'index.html';

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } }
  function users() { return readJSON(UKEY) || {}; }
  function session() {
    var s = readJSON(SKEY);
    if (!s || !s.u || !(s.exp > Date.now())) return null;
    if (!users()[s.u]) return null;
    return s;
  }

  /* ---------- 密码散列：优先 SHA-256，非安全上下文退化为迭代串散列 ---------- */
  function randSalt() {
    try {
      var a = new Uint8Array(8); crypto.getRandomValues(a), out = '';
      for (var i = 0; i < a.length; i++) out += ('0' + a[i].toString(16)).slice(-2);
      return out;
    } catch (e) { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  }
  function fallbackHash(str) {
    var h1 = 0x811c9dc5, h2 = 0x9e3779b9;
    for (var r = 0; r < 600; r++) {
      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i) + r;
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
        h2 = (h2 ^ (h2 >>> 13)) >>> 0;
      }
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  }
  function hash(pw, salt) {
    var input = salt + ':' + pw;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)).then(function (buf) {
        var a = new Uint8Array(buf), out = '';
        for (var i = 0; i < a.length; i++) out += ('0' + a[i].toString(16)).slice(-2);
        return out;
      });
    }
    return Promise.resolve(fallbackHash(input));
  }

  /* ---------- 注册 / 登录 / 退出 ---------- */
  function register(name, pw) {
    name = String(name || '').trim();
    if (!/^[\w\u4e00-\u9fa5-]{2,20}$/.test(name)) return Promise.reject('用户名需 2–20 位，可用中文、字母、数字、下划线');
    if (String(pw).length < 6) return Promise.reject('密码至少 6 位');
    var key = name.toLowerCase();
    if (users()[key]) return Promise.reject('该用户名已被注册');
    var salt = randSalt();
    return hash(pw, salt).then(function (h) {
      var all = users();
      all[key] = { name: name, salt: salt, hash: h, created: Date.now() };
      try { localStorage.setItem(UKEY, JSON.stringify(all)); } catch (e) { return Promise.reject('浏览器存储不可用，无法注册'); }
      return login(name, pw, true);
    });
  }
  function login(name, pw, remember) {
    var key = String(name || '').trim().toLowerCase();
    var u = users()[key];
    if (!u) return Promise.reject('账号不存在，请先注册');
    return hash(pw, u.salt).then(function (h) {
      if (h !== u.hash) return Promise.reject('密码不正确');
      var s = { u: key, name: u.name, remember: !!remember, exp: Date.now() + (remember ? 30 * 864e5 : 12 * 36e5) };
      try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { return Promise.reject('浏览器存储不可用，无法登录'); }
      return s;
    });
  }
  function logout() { try { localStorage.removeItem(SKEY); } catch (e) {} }

  /* next 只允许本站页面，防开放重定向 */
  function safeNext() {
    var n = 'blackjack.html';
    try { n = new URLSearchParams(location.search).get('next') || n; } catch (e) {}
    return /^(index|blackjack|blackjack-mall|baccarat|slots)\.html([?#].*)?$/.test(n) && n.indexOf('//') < 0 ? n : 'blackjack.html';
  }

  /* ---------- 门禁：在 <head> 同步执行，未登录直接跳走 ---------- */
  var required = document.documentElement.getAttribute('data-auth') === 'required';
  if (required && !session()) {
    document.documentElement.style.visibility = 'hidden';
    location.replace('login.html?next=' + encodeURIComponent(page + location.search));
    return;
  }

  /* ---------- 导航：用户名 + 退出 / 登录入口 ---------- */
  function injectStyle() {
    if (document.getElementById('auth-style')) return;
    var s = document.createElement('style');
    s.id = 'auth-style';
    s.textContent = [
      '.auth-chip{display:inline-flex;align-items:center;gap:6px;flex:0 1 auto;min-width:0;max-width:120px;',
      'font-size:11.5px;letter-spacing:.04em;color:rgba(243,238,228,.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.auth-chip:before{content:"";width:5px;height:5px;border-radius:50%;background:#C9A227;flex:none}',
      '.auth-out{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;height:30px;margin-left:10px;',
      'padding:0 13px;border-radius:999px;border:1px solid rgba(201,162,39,.32);background:transparent;',
      'color:rgba(243,238,228,.72);font:inherit;font-size:11.5px;font-weight:500;letter-spacing:.08em;cursor:pointer;',
      'transition:background .18s,border-color .18s,color .18s;line-height:1}',
      '.auth-out:hover{background:rgba(201,162,39,.12);border-color:rgba(201,162,39,.65);color:#EBD9A4}',
      '.auth-in{color:#EBD9A4!important}',
      '.auth-in:hover{color:#fff!important}',
      '@media(max-width:760px){.auth-chip{max-width:64px}.auth-out{margin-left:6px;padding:0 10px;height:28px;font-size:11px}}'
    ].join('');
    document.head.appendChild(s);
  }
  function injectNav() {
    if (/login\.html$/.test(page)) return;
    var host = document.querySelector('.nav-links');
    if (!host || host.querySelector('.auth-chip,.auth-in')) return;
    injectStyle();
    var s = session();
    if (s) {
      var chip = document.createElement('span');
      chip.className = 'auth-chip';
      chip.textContent = s.name;
      chip.title = '已登录 · 账号仅保存在本机';
      var out = document.createElement('button');
      out.type = 'button';
      out.className = 'auth-out';
      out.textContent = '退出';
      out.addEventListener('click', function () {
        logout();
        if (required) location.replace('login.html');
        else location.reload();
      });
      host.appendChild(chip);
      host.appendChild(out);
    } else {
      var a = document.createElement('a');
      a.className = 'auth-in';
      a.href = 'login.html';
      a.textContent = '登录';
      host.appendChild(a);
    }
  }

  function boot() {
    if (window.I18N && I18N.extend) {
      I18N.extend({ dict: {
        '退出': 'Sign out', '登录': 'Sign in',
        '已登录 · 账号仅保存在本机': 'Signed in · account stored on this device only'
      } });
    }
    injectNav();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.BJAuth = { session: session, login: login, register: register, logout: logout, safeNext: safeNext };
})();