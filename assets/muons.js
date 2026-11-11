(() => {
  /* ---------- muon telescope simulation ---------- */
  const canvas = document.getElementById('muons');
  if (!canvas) return;
  const fig = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const countEl = document.getElementById('coinc');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1;
  const BINS = 13, TMAX = 1.15;               // zenith range ±66°
  const hist = new Array(BINS).fill(0);
  let coincidences = 0;
  const flash = [0, 0, 0];
  const tracks = [];

  function geom() {
    const x0 = W * 0.12, x1 = W * (W < 480 ? 0.80 : 0.86);
    const ys = [H * 0.16, H * 0.33, H * 0.50];
    const th = Math.max(7, H * 0.028);
    return { x0, x1, ys, th, end: H * 0.62, hx0: W * 0.10, hx1: W * 0.90, hy0: H * 0.67, hy1: H * 0.855 };
  }

  function sampleTheta() {
    // rejection sample I(θ) ∝ cos²θ
    for (;;) {
      const t = (Math.random() * 2 - 1) * TMAX;
      if (Math.random() < Math.cos(t) ** 2) return t;
    }
  }

  function makeTrack(g) {
    const theta = sampleTheta();
    const xm = W * (0.02 + Math.random() * 0.96);       // x where it crosses the middle panel
    const slope = Math.tan(theta);
    const xAt = y => xm + slope * (y - g.ys[1]);
    const hits = g.ys.map(y => { const x = xAt(y); return x >= g.x0 && x <= g.x1; });
    return { theta, xAt, hits, y: -20, passed: [false, false, false], dead: 0, triple: hits.every(Boolean) };
  }

  function addCoincidence(theta) {
    coincidences++;
    const b = Math.min(BINS - 1, Math.max(0, Math.floor((theta + TMAX) / (2 * TMAX) * BINS)));
    hist[b]++;
    countEl.textContent = coincidences.toLocaleString('en-GB');
  }

  // seed so the first frame already shows a filled histogram
  function seed() {
    const g = geom();
    let n = 0;
    while (n < 140) {
      const t = makeTrack(g);
      if (t.triple) { addCoincidence(t.theta); n++; }
    }
  }

  function resize() {
    const r = fig.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) draw(0);
  }

  function draw(dt) {
    const g = geom();
    ctx.clearRect(0, 0, W, H);

    // faint grid
    ctx.strokeStyle = 'rgba(140,170,255,0.06)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, g.end); ctx.stroke(); }

    // panels
    g.ys.forEach((y, i) => {
      const f = flash[i];
      ctx.fillStyle = `rgba(108,155,255,${0.10 + f * 0.55})`;
      ctx.strokeStyle = `rgba(150,185,255,${0.35 + f * 0.6})`;
      if (f > 0.02) { ctx.shadowColor = 'rgba(108,155,255,0.9)'; ctx.shadowBlur = 24 * f; }
      roundRect(g.x0, y - g.th / 2, g.x1 - g.x0, g.th, 3); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(139,149,173,0.9)';
      ctx.font = '10px ui-monospace, "SF Mono", monospace';
      ctx.fillText('PMT ' + (i + 1), g.x1 + 8, y + 3.5);
    });

    // tracks
    for (const t of tracks) {
      const yHead = Math.min(t.y, g.end);
      const yTail = Math.max(-20, yHead - H * 0.55);
      const alpha = t.dead ? Math.max(0, 1 - t.dead / 0.7) : 1;
      if (alpha <= 0) continue;
      const grad = ctx.createLinearGradient(t.xAt(yTail), yTail, t.xAt(yHead), yHead);
      const col = t.triple ? '200,220,255' : '139,149,173';
      grad.addColorStop(0, `rgba(${col},0)`);
      grad.addColorStop(1, `rgba(${col},${(t.triple ? 0.95 : 0.45) * alpha})`);
      ctx.strokeStyle = grad; ctx.lineWidth = t.triple ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(t.xAt(yTail), yTail); ctx.lineTo(t.xAt(yHead), yHead); ctx.stroke();
      if (!t.dead && t.y < g.end) {
        ctx.fillStyle = `rgba(${col},1)`;
        ctx.beginPath(); ctx.arc(t.xAt(yHead), yHead, t.triple ? 2.2 : 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // histogram
    const max = Math.max(...hist, 1);
    const bw = (g.hx1 - g.hx0) / BINS;
    ctx.strokeStyle = 'rgba(140,170,255,0.18)';
    ctx.beginPath(); ctx.moveTo(g.hx0, g.hy1 + 0.5); ctx.lineTo(g.hx1, g.hy1 + 0.5); ctx.stroke();
    for (let i = 0; i < BINS; i++) {
      const h = (hist[i] / max) * (g.hy1 - g.hy0);
      ctx.fillStyle = 'rgba(108,155,255,0.55)';
      roundRect(g.hx0 + i * bw + 2, g.hy1 - h, bw - 4, h, 2); ctx.fill();
    }
    // cos² reference, scaled to the tallest bin
    ctx.strokeStyle = 'rgba(231,236,247,0.85)'; ctx.lineWidth = 1.25; ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let k = 0; k <= 60; k++) {
      const t = -TMAX + (2 * TMAX) * k / 60;
      const x = g.hx0 + (t + TMAX) / (2 * TMAX) * (g.hx1 - g.hx0);
      const y = g.hy1 - Math.cos(t) ** 2 * (g.hy1 - g.hy0);
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(139,149,173,0.9)';
    ctx.font = '10px ui-monospace, "SF Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('−60°', g.hx0 + (-1.047 + TMAX) / (2 * TMAX) * (g.hx1 - g.hx0), g.hy1 + 14);
    ctx.fillText('0°', (g.hx0 + g.hx1) / 2, g.hy1 + 14);
    ctx.fillText('+60°', g.hx0 + (1.047 + TMAX) / (2 * TMAX) * (g.hx1 - g.hx0), g.hy1 + 14);
    ctx.textAlign = 'start';
    ctx.fillText('zenith angle θ', g.hx0, g.hy0 - 6);
    ctx.textAlign = 'end';
    ctx.fillStyle = 'rgba(231,236,247,0.85)';
    ctx.fillText('- - cos²θ', g.hx1, g.hy0 - 6);
    ctx.textAlign = 'start';
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  let last = 0, spawnAcc = 0, running = false, visible = true, raf = 0;
  function step(ts) {
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    const g = geom();
    spawnAcc += dt;
    if (spawnAcc > 0.42) { spawnAcc = Math.random() * 0.2; tracks.push(makeTrack(g)); }
    const v = H * 1.5;
    for (const t of tracks) {
      if (t.dead) { t.dead += dt; continue; }
      t.y += v * dt;
      g.ys.forEach((y, i) => {
        if (!t.passed[i] && t.y >= y) {
          t.passed[i] = true;
          if (t.hits[i]) flash[i] = 1;
          if (i === 2 && t.triple) addCoincidence(t.theta);
        }
      });
      if (t.y >= g.end) t.dead = 0.0001;
    }
    for (let i = tracks.length - 1; i >= 0; i--) if (tracks[i].dead > 0.7) tracks.splice(i, 1);
    for (let i = 0; i < 3; i++) flash[i] = Math.max(0, flash[i] - dt * 3.2);
    draw(dt);
    raf = requestAnimationFrame(step);
  }
  function start() { if (running || reduce) return; running = true; last = 0; raf = requestAnimationFrame(step); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  seed();
  new ResizeObserver(resize).observe(fig);
  resize();

  if (reduce) {
    // a still frame with a few frozen tracks
    const g = geom();
    for (let k = 0; k < 5; k++) { const t = makeTrack(g); t.y = g.end * (0.7 + Math.random() * 0.3); tracks.push(t); }
    draw(0);
  } else {
    new IntersectionObserver(es => { visible = es[0].isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(fig);
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : (visible && start()); });
    start();
  }
})();
