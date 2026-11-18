/* 共用自绘下拉：把系统 <select> 换成触发器 + 浮层列表（牌桌设置 / 商城工具条共用） */
(function(){
  'use strict';
  const CHEV = '<svg class="ls-chev" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">' +
               '<path d="M1 1.6 6 6.4 11 1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function enhance(sel){
    if (!sel || sel.dataset.luxsel || sel.closest('.luxsel')) return;
    sel.dataset.luxsel = '1';

    const wrap = document.createElement('div');
    wrap.className = 'luxsel';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'luxsel-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="ls-label"></span>' + CHEV;

    const pop = document.createElement('div');
    pop.className = 'luxsel-pop';
    pop.hidden = true;
    pop.setAttribute('role', 'listbox');

    wrap.appendChild(btn);
    wrap.appendChild(pop);
    const label = btn.querySelector('.ls-label');

    let opened = false;

    const curText = () => {
      const o = sel.options[sel.selectedIndex];
      return o ? o.text : '';
    };

    function sync(){
      const t = curText();
      label.textContent = t;
      btn.title = t;
      const dis = !!sel.disabled;
      btn.disabled = dis;
      btn.setAttribute('aria-disabled', String(dis));
      if (dis) close();
    }

    function build(){
      const frag = document.createDocumentFragment();

      function add(o){
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ls-item' + (o.selected ? ' on' : '');
        b.disabled = o.disabled || (o.parentNode.tagName === 'OPTGROUP' && o.parentNode.disabled);
        b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', o.selected ? 'true' : 'false');
        b.dataset.v = o.value;
        b.title = o.text;

        const s = document.createElement('span');
        s.className = 'ls-t';
        s.textContent = o.text;
        const k = document.createElement('i');
        k.className = 'ls-ok';
        k.textContent = '✓';

        b.appendChild(s);
        b.appendChild(k);
        b.addEventListener('click', () => {
          if (b.disabled) return;
          sel.value = b.dataset.v;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          sync();
          close();
        });
        frag.appendChild(b);
      }

      [...sel.children].forEach(node => {
        if (node.tagName === 'OPTGROUP'){
          const g = document.createElement('div');
          g.className = 'ls-group';
          g.textContent = node.label;
          frag.appendChild(g);
          [...node.children].forEach(add);
        } else if (node.tagName === 'OPTION'){
          add(node);
        }
      });
      pop.replaceChildren(frag);
    }

    function open(){
      if (sel.disabled || btn.disabled) return;
      build();
      pop.hidden = false;
      wrap.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');

      /* 空间不足时向上展开 */
      const br = btn.getBoundingClientRect();
      const est = Math.min(pop.offsetHeight, 272);
      const below = window.innerHeight - br.bottom - 14;
      const above = br.top - 14;
      wrap.classList.toggle('up', below < est && above > below);

      const on = pop.querySelector('.ls-item.on');
      if (on) pop.scrollTop = Math.max(0, on.offsetTop - pop.clientHeight / 2 + on.offsetHeight / 2);

      document.addEventListener('click', onDoc, true);
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('resize', close, true);
      opened = true;
      if (on) on.focus({ preventScroll: true });
    }

    function close(){
      if (!opened) return;
      opened = false;
      pop.hidden = true;
      wrap.classList.remove('open', 'up');
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', onDoc, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', close, true);
    }

    function onDoc(e){
      if (!wrap.contains(e.target)) close();
    }

    function onKey(e){
      if (e.key === 'Escape'){
        e.preventDefault();
        close();
        btn.focus({ preventScroll: true });
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
        e.preventDefault();
        const items = [...pop.querySelectorAll('.ls-item:not(:disabled)')];
        if (!items.length) return;
        const i = items.indexOf(document.activeElement);
        const n = e.key === 'ArrowDown'
          ? (i < 0 ? 0 : Math.min(items.length - 1, i + 1))
          : (i < 0 ? items.length - 1 : Math.max(0, i - 1));
        items[n].focus({ preventScroll: true });
        items[n].scrollIntoView({ block: 'nearest' });
      }
    }

    btn.addEventListener('click', () => { opened ? close() : open(); });
    sel.addEventListener('change', sync);

    const mo = new MutationObserver(() => {
      sync();
      if (opened) build();
    });
    mo.observe(sel, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['disabled', 'label']
    });

    wrap.classList.add('ready');
    sync();
  }

  function init(){
    document.querySelectorAll('.setrow select, .mallbar select, .malltools select').forEach(sel => {
      try { enhance(sel); } catch (err) { console.warn('[luxsel]', err); }
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
  } else {
    setTimeout(init, 0);
  }
})();