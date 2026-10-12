/* 001kmh — main.js: horizontální posun s setrvačností, paralaxa, písmena reagující na kurzor, loader. Přechody: curtain.js */
(() => {
    'use strict';
    const root = document.documentElement;
    const $ = (id) => document.getElementById(id);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const rail = $('rail'), bar = $('bar');
    const pans = Array.from(document.querySelectorAll('.pan'));
    const rows = Array.from(document.querySelectorAll('.row'));

    /* titulky po písmenech (čtečky dostanou celé slovo) */
    document.querySelectorAll('.t').forEach((t) => {
        const text = t.textContent.trim();
        const sr = document.createElement('span');
        sr.className = 'vh';
        sr.textContent = text;
        const vis = document.createElement('span');
        vis.setAttribute('aria-hidden', 'true');
        Array.from(text).forEach((chr, k) => {
            const s = document.createElement('span');
            s.className = 'ch';
            s.style.setProperty('--c', k);
            s.textContent = chr;
            vis.appendChild(s);
        });
        t.textContent = '';
        t.append(sr, vis);
        const done = () => t.classList.add('is-set');
        if (vis.lastElementChild) vis.lastElementChild.addEventListener('animationend', done, { once: true });
        setTimeout(done, 6500);
    });
    const chs = Array.from(document.querySelectorAll('.ch'));

    /* loader: jen první návštěva v tabu */
    const loader = $('loader');
    if (loader && root.classList.contains('intro')) {
        let out = false, t1 = 0;
        const exit = () => {
            if (out) return;
            out = true;
            clearTimeout(t1);
            loader.classList.add('is-out');
            setTimeout(() => root.classList.remove('hold'), 350);
            setTimeout(() => { loader.remove(); root.classList.remove('intro'); }, 1100);
        };
        Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 900))]).then(() => {
            if (out) return;
            loader.classList.add('is-run');
            t1 = setTimeout(exit, 2200);
        });
        loader.addEventListener('pointerdown', exit);
        window.addEventListener('keydown', exit, { once: true });
    } else {
        root.classList.remove('intro');
    }

    /* posun do strany: kolečko myši → plynulá setrvačnost; dotyk a klávesy jedou nativně */
    let cur = rail.scrollLeft, target = cur, raf = 0;
    let px = -1, py = -1, rraf = 0;
    const max = () => Math.max(0, rail.scrollWidth - rail.clientWidth);
    const clamp = (v) => Math.max(0, Math.min(max(), v));

    function update() {
        const sl = rail.scrollLeft, m = max();
        bar.style.transform = `scaleX(${m ? (sl / m).toFixed(4) : 0})`;
        if (!reduce) {
            pans.forEach((p) => {
                const c = p.offsetLeft + p.offsetWidth / 2 - sl - innerWidth / 2;
                p.style.setProperty('--p', (c * -0.16).toFixed(1));
            });
        }
        scheduleReact();
    }
    function loop() {
        raf = 0;
        cur = reduce ? target : cur + (target - cur) * 0.085;
        rail.scrollLeft = cur;
        update();
        if (Math.abs(target - cur) > 0.4) raf = requestAnimationFrame(loop);
    }
    rail.addEventListener('wheel', (e) => {
        if (e.ctrlKey) return;
        e.preventDefault();
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        target = clamp(target + d * 1.15);
        if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: false });
    rail.addEventListener('scroll', () => {
        if (!raf) { cur = target = rail.scrollLeft; update(); }
    }, { passive: true });
    window.addEventListener('keydown', (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        target = clamp(target + dir * innerWidth * 0.8);
        if (!raf) raf = requestAnimationFrame(loop);
    });
    addEventListener('resize', () => { target = cur = clamp(rail.scrollLeft); update(); }, { passive: true });
    if (document.fonts) document.fonts.ready.then(update);
    update();

    /* písmena u kurzoru se zúží a zjemní */
    function react() {
        rraf = 0;
        if (px < 0 || reduce) return;
        const rects = chs.map((c) => c.getBoundingClientRect());
        chs.forEach((c, i) => {
            const b = rects[i];
            if (b.right < -50 || b.left > innerWidth + 50) return;
            const d = Math.hypot(px - (b.left + b.width / 2), py - (b.top + b.height / 2));
            const k = Math.max(0, 1 - d / 340);
            c.style.fontVariationSettings = `'wdth' ${(100 - 25 * k).toFixed(0)}, 'wght' ${(800 - 520 * k).toFixed(0)}`;
        });
    }
    function scheduleReact() { if (!rraf && px >= 0) rraf = requestAnimationFrame(react); }

    /* kurzor */
    const dotEl = $('cursor');
    let seen = false;
    addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        px = e.clientX; py = e.clientY;
        if (!seen) { seen = true; if (fine) root.classList.add('has-cursor'); }
        dotEl.style.transform = `translate3d(${px}px, ${py}px, 0)`;
        scheduleReact();
    }, { passive: true });
    rows.forEach((r) => {
        r.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') root.classList.add('cursor-hover'); });
        r.addEventListener('pointerleave', () => root.classList.remove('cursor-hover'));
    });
    root.addEventListener('mouseleave', () => root.classList.remove('cursor-hover'));
    addEventListener('pageshow', (e) => { if (e.persisted) root.classList.remove('cursor-hover'); });
})();
