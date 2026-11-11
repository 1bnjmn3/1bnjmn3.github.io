(() => {
  document.documentElement.classList.add('js');
  /* ---------- copy email ---------- */
  const btn = document.getElementById('copyBtn');
  const email = document.getElementById('email');
  if (btn && email) {
    btn.addEventListener('click', () => {
      const done = () => { btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy'), 1600); };
      const fallback = () => {
        const r = document.createRange(); r.selectNodeContents(email);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        btn.textContent = 'Selected';
        setTimeout(() => (btn.textContent = 'Copy'), 1600);
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(email.textContent.trim()).then(done, fallback);
        } else fallback();
      } catch (e) { fallback(); }
    });
  }

  /* ---------- nav: mark the section in view ---------- */
  const navLinks = new Map([...document.querySelectorAll('.nav ul a')].map(a => {
    const href = a.getAttribute('href') || '';
    const id = href.includes('#') ? href.slice(href.indexOf('#') + 1) : '';
    return [id, a];
  }).filter(([id]) => id));
  const currentNav = document.body.dataset.nav;
  if (currentNav && navLinks.get(currentNav)) {
    navLinks.get(currentNav).setAttribute('aria-current', 'true');
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      navLinks.forEach(a => a.removeAttribute('aria-current'));
      const a = navLinks.get(e.target.id); if (a) a.setAttribute('aria-current', 'true');
    }), { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(sec => io.observe(sec));
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- reveal-on-scroll ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    const show = el => el.classList.add('in');
    if (reduce || !('IntersectionObserver' in window)) {
      reveals.forEach(show);
    } else {
      const rio = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { show(e.target); rio.unobserve(e.target); }
      }), { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
      reveals.forEach(el => rio.observe(el));
      // failsafe: never leave copy hidden if IO does not fire
      setTimeout(() => reveals.forEach(show), 700);
    }
  }

  /* ---------- count-up of real stats already on the page ---------- */
  document.querySelectorAll('[data-count]').forEach(el => {
    const raw = el.getAttribute('data-count');
    if (reduce) return;
    const suffix = el.getAttribute('data-suffix') || '';
    const prefix = el.getAttribute('data-prefix') || '';
    const decimals = Number(el.getAttribute('data-decimals') || 0);
    const target = Number(raw);
    if (!Number.isFinite(target)) return;
    const startVal = 0;
    const dur = 900;
    let start = 0;
    const step = (ts) => {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = startVal + (target - startVal) * eased;
      el.textContent = prefix + val.toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window) {
      const cio = new IntersectionObserver(es => {
        if (es[0].isIntersecting) { cio.disconnect(); requestAnimationFrame(step); }
      }, { threshold: 0.4 });
      cio.observe(el);
    } else requestAnimationFrame(step);
  });

  /* ---------- TCP pacing diagram: illustrative moving packets ---------- */
  const host = document.getElementById('pace-anim');
  if (!host) return;
  const svg = host.querySelector('svg');
  if (!svg) return;
  if (reduce) return;

  const NS = 'http://www.w3.org/2000/svg';
  function makePkt(y) {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('y', String(y));
    r.setAttribute('width', '3');
    r.setAttribute('height', '16');
    r.setAttribute('rx', '0.5');
    return r;
  }

  const burstLayer = svg.querySelector('[data-pkts="burst"]');
  const pacedLayer = svg.querySelector('[data-pkts="paced"]');
  if (!burstLayer || !pacedLayer) return;
  svg.querySelectorAll('[data-static]').forEach(g => g.setAttribute('visibility', 'hidden'));

  const burstY = 48, pacedY = 108;
  const x0 = 8, x1 = 300;
  const burstPkts = [];
  const pacedPkts = [];

  // six-packet clusters, three on the line
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < 6; i++) {
      const r = makePkt(burstY);
      r.setAttribute('fill', 'currentColor');
      r.style.color = 'var(--fg-2)';
      r.setAttribute('opacity', '0.7');
      burstLayer.appendChild(r);
      burstPkts.push({ el: r, cluster: c, i });
    }
  }
  for (let i = 0; i < 18; i++) {
    const r = makePkt(pacedY);
    r.setAttribute('fill', 'currentColor');
    r.style.color = 'var(--accent)';
    pacedLayer.appendChild(r);
    pacedPkts.push({ el: r, i });
  }

  let raf = 0, start = 0, visible = true, running = false;
  function pos(t, span) {
    let x = (t % 1) * span;
    if (x < 0) x += span;
    return x0 + x;
  }
  function frame(ts) {
    if (!start) start = ts;
    const t = (ts - start) / 1000;
    const span = x1 - x0;
    const clusterGap = span / 3;
    burstPkts.forEach(p => {
      const x = pos((t * 0.22) + p.cluster / 3, span) + p.i * 5;
      const wrapped = x0 + ((x - x0) % span + span) % span;
      p.el.setAttribute('x', wrapped.toFixed(2));
    });
    pacedPkts.forEach(p => {
      const x = pos((t * 0.22) + p.i / 18, span);
      p.el.setAttribute('x', x.toFixed(2));
    });
    raf = requestAnimationFrame(frame);
  }
  function startAnim() { if (running) return; running = true; start = 0; raf = requestAnimationFrame(frame); }
  function stopAnim() { running = false; cancelAnimationFrame(raf); }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      visible && !document.hidden ? startAnim() : stopAnim();
    }).observe(host);
  }
  document.addEventListener('visibilitychange', () => { document.hidden ? stopAnim() : (visible && startAnim()); });
  startAnim();
})();

  /* ---------- 3D pointer tilt (shared) ---------- */
  (function bindTilt() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = [...document.querySelectorAll('[data-tilt]')];
    if (!els.length) return;
    if (reduce) {
      els.forEach(el => {
        el.style.setProperty('--tilt-rx', '0deg');
        el.style.setProperty('--tilt-ry', '0deg');
        el.style.setProperty('--glare-o', '0');
      });
      return;
    }

    const state = new Map();
    els.forEach(el => state.set(el, { tx: 0, ty: 0, cx: 0, cy: 0, gx: 0.5, gy: 0.5, go: 0, inside: false }));

    function point(e, el) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      const s = state.get(el);
      s.tx = x * 2 - 1;
      s.ty = y * 2 - 1;
      s.gx = x;
      s.gy = y;
      s.inside = true;
    }

    els.forEach(el => {
      el.addEventListener('pointermove', e => point(e, el));
      el.addEventListener('pointerenter', e => point(e, el));
      el.addEventListener('pointerleave', () => { state.get(el).inside = false; });
    });

    function tick() {
      els.forEach(el => {
        const s = state.get(el);
        const max = Number(el.getAttribute('data-tilt-max') || 9);
        if (!s.inside) { s.tx = 0; s.ty = 0; }
        s.cx += (s.tx - s.cx) * 0.14;
        s.cy += (s.ty - s.cy) * 0.14;
        s.go += ((s.inside ? 1 : 0) - s.go) * 0.16;
        el.style.setProperty('--tilt-rx', (-s.cy * max).toFixed(3) + 'deg');
        el.style.setProperty('--tilt-ry', (s.cx * max).toFixed(3) + 'deg');
        el.style.setProperty('--glare-x', (s.gx * 100).toFixed(2) + '%');
        el.style.setProperty('--glare-y', (s.gy * 100).toFixed(2) + '%');
        el.style.setProperty('--glare-o', s.go.toFixed(3));
      });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();
