(() => {
  const host = document.getElementById('decoder-viz');
  const plot = document.getElementById('decoder-plot');
  if (!host && !plot) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Audited d=7 logical error rate per round, from results/ler_sweep.csv
     as published in the repo README table (ratios there are rounded). */
  const LER = [
    { label: '0', p: 0, s: 4.38e-5, a: 4.38e-5, r: 1.0 },
    { label: '10⁻³', p: 1e-3, s: 5.10e-5, a: 3.79e-5, r: 1.3 },
    { label: '5×10⁻³', p: 5e-3, s: 1.59e-4, a: 5.50e-5, r: 2.9 },
    { label: '10⁻²', p: 1e-2, s: 4.45e-4, a: 6.81e-5, r: 6.5 },
    { label: '2×10⁻²', p: 2e-2, s: 1.70e-3, a: 1.06e-4, r: 16.0 }
  ];

  function cssColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  if (plot) {
    const accent = cssColor('--accent', '#2d62e6');
    const fg2 = cssColor('--fg-2', '#6e6e76');
    const w = 640, h = 260, pad = { l: 58, r: 16, t: 16, b: 44 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const maxY = 2e-3;
    const xAt = i => pad.l + (i / (LER.length - 1)) * iw;
    const yAt = v => pad.t + (1 - Math.log10(v / 1e-5) / Math.log10(maxY / 1e-5)) * ih;
    const line = (key, dash) => LER.map((d, i) => `${i ? 'L' : 'M'} ${xAt(i).toFixed(1)} ${yAt(d[key]).toFixed(1)}`).join(' ');
    const ticks = [1e-5, 1e-4, 1e-3];
    plot.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="lerTitle">
        <title id="lerTitle">Logical error rate per round at d = 7, static versus adaptive PyMatching</title>
        ${ticks.map(t => {
          const y = yAt(t);
          const lab = t === 1e-5 ? '10⁻⁵' : t === 1e-4 ? '10⁻⁴' : '10⁻³';
          return `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${w-pad.r}" y2="${y.toFixed(1)}" stroke="currentColor" style="color:var(--line)" />
            <text x="${pad.l-8}" y="${y+3}" text-anchor="end" font-family="ui-monospace,monospace" font-size="10" fill="currentColor" style="color:var(--fg-2)">${lab}</text>`;
        }).join('')}
        <text x="14" y="${pad.t + ih/2}" font-family="ui-monospace,monospace" font-size="10" fill="currentColor" style="color:var(--fg-2)" transform="rotate(-90 14 ${pad.t + ih/2})" text-anchor="middle">logical error / round, d = 7</text>
        <path d="${line('s')}" fill="none" stroke="currentColor" style="color:var(--fg-2)" stroke-width="2"></path>
        <path d="${line('a')}" fill="none" stroke="currentColor" style="color:var(--accent)" stroke-width="2" stroke-dasharray="5 4"></path>
        ${LER.map((d,i) => `
          <circle cx="${xAt(i).toFixed(1)}" cy="${yAt(d.s).toFixed(1)}" r="3.2" fill="currentColor" style="color:var(--fg-2)"></circle>
          <circle cx="${xAt(i).toFixed(1)}" cy="${yAt(d.a).toFixed(1)}" r="3.2" fill="currentColor" style="color:var(--accent)"></circle>
          <text x="${xAt(i).toFixed(1)}" y="${h-16}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="10" fill="currentColor" style="color:var(--fg-2)">${d.label}</text>
        `).join('')}
        <text x="${w-pad.r}" y="${h-4}" text-anchor="end" font-family="ui-monospace,monospace" font-size="10" fill="currentColor" style="color:var(--fg-2)">heralded-erasure rate p_L</text>
        <text x="${pad.l}" y="12" font-family="ui-monospace,monospace" font-size="10" fill="currentColor" style="color:var(--fg-2)">solid static · dashed adaptive</text>
      </svg>`;
  }

  if (!host) return;

  const NS = 'http://www.w3.org/2000/svg';
  const interactive = !!host.querySelector('[data-decoder-tools]');
  let mode = host.getAttribute('data-mode') === 'auto' ? 'auto' : 'adaptive';
  let tick = 0, herald = 2; // data qubit index that is heralded
  // 5x5 data grid for an illustrative rotated patch (not a simulated shot)
  const N = 5;
  const cells = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.push({ r, c, i: r * N + c });
  herald = 12; // centre

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 280 280');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', 'latTitle');
  const title = document.createElementNS(NS, 'title');
  title.id = 'latTitle';
  title.textContent = 'Illustrative surface-code lattice. A heralded erasure is flagged; the animation is not a simulated shot.';
  svg.appendChild(title);

  const gap = 44, ox = 38, oy = 36;
  const faces = [];
  // stabilizer plaquettes
  for (let r = 0; r < N - 1; r++) {
    for (let c = 0; c < N - 1; c++) {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', String(ox + c * gap - 16));
      rect.setAttribute('y', String(oy + r * gap - 16));
      rect.setAttribute('width', '32');
      rect.setAttribute('height', '32');
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', 'currentColor');
      rect.style.color = 'var(--accent)';
      rect.setAttribute('opacity', '0.08');
      rect.dataset.face = `${r}-${c}`;
      svg.appendChild(rect);
      faces.push({ rect, r, c });
    }
  }
  const dots = cells.map(q => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(ox + q.c * gap));
    c.setAttribute('cy', String(oy + q.r * gap));
    c.setAttribute('r', '6');
    c.setAttribute('fill', 'currentColor');
    c.style.color = 'var(--fg)';
    svg.appendChild(c);
    return { ...q, el: c };
  });
  const flag = document.createElementNS(NS, 'circle');
  flag.setAttribute('r', '11');
  flag.setAttribute('fill', 'none');
  flag.setAttribute('stroke', 'currentColor');
  flag.setAttribute('stroke-width', '2');
  flag.style.color = 'var(--accent)';
  flag.setAttribute('opacity', '0');
  svg.appendChild(flag);

  const cap = document.createElementNS(NS, 'text');
  cap.setAttribute('x', '140');
  cap.setAttribute('y', '268');
  cap.setAttribute('text-anchor', 'middle');
  cap.setAttribute('font-family', 'ui-monospace, monospace');
  cap.setAttribute('font-size', '10');
  cap.setAttribute('fill', 'currentColor');
  cap.style.color = 'var(--fg-2)';
  cap.textContent = 'Illustrative lattice — not a simulated shot';
  svg.appendChild(cap);

  const existing = host.querySelector('svg');
  if (existing) existing.replaceWith(svg); else host.prepend(svg);

  const buttons = host.querySelectorAll('[data-mode-btn]');
  function setMode(m) {
    if (m !== 'auto') mode = m;
    buttons.forEach(b => b.setAttribute('aria-pressed', b.getAttribute('data-mode-btn') === mode ? 'true' : 'false'));
  }
  buttons.forEach(b => b.addEventListener('click', () => setMode(b.getAttribute('data-mode-btn'))));
  if (interactive) setMode('adaptive');

  let phase = 0, last = 0, raf = 0, running = false, visible = true;

  function paint(p) {
    // p: 0 idle, 0-1 herald appears, then static leak "spreads" vs adaptive holds
    const h = dots[herald];
    flag.setAttribute('cx', h.el.getAttribute('cx'));
    flag.setAttribute('cy', h.el.getAttribute('cy'));
    const show = Math.min(1, Math.max(0, p));
    flag.setAttribute('opacity', String(show));
    const current = mode === 'auto' ? (p > 1.15 && p < 2.15 ? 'static' : 'adaptive') : mode;
    const spread = current === 'static' ? Math.min(1, Math.max(0, p - 0.6)) : 0;
    const held = current === 'adaptive' ? Math.min(1, Math.max(0, p - 0.4)) : 0;
    dots.forEach(d => {
      const dist = Math.abs(d.r - h.r) + Math.abs(d.c - h.c);
      if (d.i === herald) {
        d.el.style.color = 'var(--accent)';
        d.el.setAttribute('r', show > 0.2 ? '7.5' : '6');
      } else if (spread > 0 && dist <= 2 && dist > 0) {
        const k = Math.max(0, spread - (dist - 1) * 0.45);
        d.el.style.color = k > 0.15 ? 'var(--fg-2)' : 'var(--fg)';
        d.el.setAttribute('opacity', String(0.35 + 0.65 * (1 - k)));
        d.el.setAttribute('r', String(6 + 1.2 * k));
      } else {
        d.el.style.color = 'var(--fg)';
        d.el.setAttribute('opacity', '1');
        d.el.setAttribute('r', '6');
      }
    });
    faces.forEach(f => {
      const near = Math.abs(f.r - (h.r - 0.5)) + Math.abs(f.c - (h.c - 0.5));
      if (held > 0 && near < 1.2) f.setAttribute('opacity', String(0.08 + 0.28 * held));
      else if (spread > 0 && near < 2) f.setAttribute('opacity', String(0.08 + 0.12 * spread));
      else f.setAttribute('opacity', '0.08');
    });
    cap.textContent = current === 'static'
      ? 'Static matching ignores the herald (illustrative)'
      : 'Adaptive matching uses the herald (illustrative)';
    if (p < 0.15) cap.textContent = 'Illustrative lattice — not a simulated shot';
  }

  function frame(ts) {
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    phase += dt;
    const cycle = 3.6;
    const p = phase % cycle;
    paint(p);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  if (reduce) {
    paint(1);
    cap.textContent = 'Illustrative lattice — a heralded erasure on the centre qubit';
  } else {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { visible = es[0].isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(host);
    }
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : (visible && start()); });
    start();
  }
})();
