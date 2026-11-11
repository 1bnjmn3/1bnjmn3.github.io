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
