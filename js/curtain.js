/* 001kmh — curtain.js: přechod mezi stránkami (barevný kruh z místa kliknutí).
   Vlož do <head> KAŽDÉ stránky: <script src="/js/curtain.js"></script> */
(() => {
    'use strict';
    const d = document, root = d.documentElement;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const KEY = 'kmh-t';
    const EASE = 'cubic-bezier(0.76, 0, 0.24, 1)';
    const OUT = 'cubic-bezier(0.2, 0.9, 0.1, 1)';
    let info = { c: '#0d0d0d', on: '#f5f5f3', n: '' };
    let arriving = false;
    try {
        const s = sessionStorage.getItem(KEY);
        if (s) {
            sessionStorage.removeItem(KEY);
            try { Object.assign(info, JSON.parse(s)); } catch (_) {}
            arriving = true;
            root.classList.add('kmh-arriving', 'hold');
            setTimeout(() => root.classList.remove('kmh-arriving', 'hold'), 4000);
        }
    } catch (_) {}

    const st = d.createElement('style');
    st.textContent = `
html.kmh-arriving::before{content:'';position:fixed;inset:0;z-index:2147483000;background:${info.c}}
.kmh-c{position:fixed;inset:0;z-index:2147483001;display:grid;place-items:center;visibility:hidden;pointer-events:none;clip-path:circle(0 at 50% 50%)}
.kmh-c.is-on{visibility:visible;pointer-events:auto}
.kmh-c span{display:block;overflow:hidden;padding:.06em .04em}
.kmh-c b{display:block;font:800 clamp(3rem,15vw,12rem)/1 'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:-.05em}`;
    d.head.appendChild(st);

    let el, txt, leaving = false;
    const R = (x, y) => Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    function build(c) {
        if (!el) {
            el = d.createElement('div');
            el.className = 'kmh-c';
            el.setAttribute('aria-hidden', 'true');
            el.innerHTML = '<span><b></b></span>';
            txt = el.querySelector('b');
            d.body.appendChild(el);
        }
        el.style.background = c.c;
        el.style.color = c.on;
        txt.textContent = c.n;
    }
    function reset() {
        if (!el) return;
        el.classList.remove('is-on');
        [el, txt].forEach((n) => n.getAnimations().forEach((a) => a.cancel()));
        el.style.clipPath = '';
        leaving = false;
    }

    function cover(x, y, c) {
        build(c);
        el.classList.add('is-on');
        el.animate(
            [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${R(x, y)}px at ${x}px ${y}px)` }],
            { duration: 700, easing: EASE, fill: 'forwards' }
        );
        txt.animate([{ transform: 'translateY(115%)' }, { transform: 'none' }], { duration: 600, delay: 380, easing: OUT, fill: 'both' });
        return 950;
    }

    function arrive() {
        build(info);
        el.classList.add('is-on');
        el.style.clipPath = `circle(${R(innerWidth / 2, innerHeight / 2)}px at 50% 50%)`;
        root.classList.remove('kmh-arriving');
        txt.animate([{ transform: 'none' }, { transform: 'translateY(-115%)' }], { duration: 500, delay: 160, easing: OUT, fill: 'forwards' });
        el.animate(
            [{ clipPath: `circle(${R(innerWidth / 2, innerHeight / 2)}px at 50% 50%)` }, { clipPath: 'circle(0px at 50% 50%)' }],
            { duration: 800, delay: 420, easing: EASE, fill: 'forwards' }
        );
        setTimeout(() => root.classList.remove('hold'), 520);
        setTimeout(reset, 1300);
    }

    if (arriving) {
        const ready = new Promise((r) => {
            if (d.readyState !== 'loading') r(); else d.addEventListener('DOMContentLoaded', r, { once: true });
        });
        const fonts = Promise.race([d.fonts ? d.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 600))]);
        Promise.all([ready, fonts]).then(arrive);
    }

    d.addEventListener('click', (e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = e.target.closest && e.target.closest('a[href]');
        if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
        let u;
        try { u = new URL(a.href, location.href); } catch (_) { return; }
        if (u.origin !== location.origin) return;
        if (u.pathname === location.pathname && u.search === location.search) return;
        e.preventDefault();
        if (leaving) return;
        leaving = true;
        const b = a.getBoundingClientRect();
        const x = e.detail === 0 ? b.left + b.width / 2 : e.clientX;
        const y = e.detail === 0 ? b.top + b.height / 2 : e.clientY;
        const c = { c: a.dataset.c || '#0d0d0d', on: a.dataset.on || '#f5f5f3', n: a.dataset.name || '' };
        try { sessionStorage.setItem(KEY, JSON.stringify(c)); sessionStorage.setItem('kmh-seen', '1'); } catch (_) {}
        const t = cover(x, y, c);
        setTimeout(() => { location.href = u.href; }, t);
    });

    addEventListener('pageshow', (e) => { if (e.persisted) { root.classList.remove('kmh-arriving', 'hold'); reset(); } });
})();
