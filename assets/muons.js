(() => {
  const fig = document.querySelector('.detector');
  if (!fig) return;
  const scene = fig.querySelector('.telescope-scene');
  const histCanvas = document.getElementById('muons-hist') || document.getElementById('muons');
  const countEl = document.getElementById('coinc');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!histCanvas) return;

  const ctx = histCanvas.getContext('2d');
  const BINS = 13, TMAX = 1.15;
  const hist = new Array(BINS).fill(0);
  let coincidences = 0;
  const plates = [...fig.querySelectorAll('.sc-plate')];
  const flash = [0, 0, 0];
  const tracks = [];

  function sampleTheta() {
    for (;;) {
      const t = (Math.random() * 2 - 1) * TMAX;
      if (Math.random() < Math.cos(t) ** 2) return t;
    }
  }

  function addCoincidence(theta) {
    coincidences++;
    const b = Math.min(BINS - 1, Math.max(0, Math.floor((theta + TMAX) / (2 * TMAX) * BINS)));
    hist[b]++;
    if (countEl) countEl.textContent = coincidences.toLocaleString('en-GB');
  }

  function seed() {
    let n = 0;
    while (n < 140) {
      const theta = sampleTheta();
      // approximate geometric acceptance of a three-panel stack
      const x = 0.18 + Math.random() * 0.64;
      const slope = Math.tan(theta) * 0.22;
      const hits = [0, 1, 2].every(i => {
        const xi = x + slope * (i - 1);
        return xi >= 0.14 && xi <= 0.86;
      });
      if (hits) { addCoincidence(theta); n++; }
    }
  }

  function resize() {
    const r = histCanvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    histCanvas.width = Math.round(r.width * dpr);
    histCanvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawHist();
  }

  function roundRect(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
  }

  function drawHist() {
    const W = histCanvas.getBoundingClientRect().width;
    const H = histCanvas.getBoundingClientRect().height;
    ctx.clearRect(0, 0, W, H);
    const hx0 = W * 0.10, hx1 = W * 0.90, hy0 = H * 0.18, hy1 = H * 0.62;
    const max = Math.max(...hist, 1);
    const bw = (hx1 - hx0) / BINS;
    ctx.strokeStyle = 'rgba(140,170,255,0.18)';
    ctx.beginPath(); ctx.moveTo(hx0, hy1 + 0.5); ctx.lineTo(hx1, hy1 + 0.5); ctx.stroke();
    for (let i = 0; i < BINS; i++) {
      const h = (hist[i] / max) * (hy1 - hy0);
      ctx.fillStyle = 'rgba(108,155,255,0.55)';
      roundRect(hx0 + i * bw + 2, hy1 - h, bw - 4, h, 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(231,236,247,0.85)'; ctx.lineWidth = 1.25; ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let k = 0; k <= 60; k++) {
      const t = -TMAX + (2 * TMAX) * k / 60;
      const x = hx0 + (t + TMAX) / (2 * TMAX) * (hx1 - hx0);
      const y = hy1 - Math.cos(t) ** 2 * (hy1 - hy0);
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(139,149,173,0.9)';
    ctx.font = '10px ui-monospace, "SF Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('−60°', hx0 + (-1.047 + TMAX) / (2 * TMAX) * (hx1 - hx0), hy1 + 14);
    ctx.fillText('0°', (hx0 + hx1) / 2, hy1 + 14);
    ctx.fillText('+60°', hx0 + (1.047 + TMAX) / (2 * TMAX) * (hx1 - hx0), hy1 + 14);
    ctx.textAlign = 'start';
    ctx.fillText('zenith angle θ', hx0, hy0 - 4);
    ctx.textAlign = 'end';
    ctx.fillStyle = 'rgba(231,236,247,0.85)';
    ctx.fillText('- - cos²θ', hx1, hy0 - 4);
    ctx.textAlign = 'start';
  }

  function spawnTrack() {
    if (!scene) return;
    const theta = sampleTheta();
    const x = 0.18 + Math.random() * 0.64;
    const slope = Math.tan(theta) * 0.22;
    const hits = [0, 1, 2].map(i => {
      const xi = x + slope * (i - 1);
      return xi >= 0.14 && xi <= 0.86;
    });
    const el = document.createElement('div');
    el.className = 'muon-track' + (hits.every(Boolean) ? '' : ' miss');
    el.style.left = (x * 100).toFixed(2) + '%';
    el.style.transform = `rotateZ(${(theta * 18).toFixed(2)}deg)`;
    scene.appendChild(el);
    tracks.push({ el, theta, hits, passed: [false, false, false], y: -0.2, dead: 0, triple: hits.every(Boolean) });
  }

  let last = 0, spawnAcc = 0, running = false, visible = true, raf = 0;

  function step(ts) {
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
    spawnAcc += dt;
    if (spawnAcc > 0.42) { spawnAcc = Math.random() * 0.2; spawnTrack(); }
    for (const t of tracks) {
      if (t.dead) { t.dead += dt; t.el.style.opacity = String(Math.max(0, 1 - t.dead / 0.7)); continue; }
      t.y += dt * 1.15;
      t.el.style.top = (t.y * 100).toFixed(2) + '%';
      [0.12, 0.34, 0.56].forEach((yHit, i) => {
        if (!t.passed[i] && t.y >= yHit) {
          t.passed[i] = true;
          if (t.hits[i]) flash[i] = 1;
          if (i === 2 && t.triple) addCoincidence(t.theta);
        }
      });
      if (t.y >= 1.05) t.dead = 0.0001;
    }
    for (let i = tracks.length - 1; i >= 0; i--) {
      if (tracks[i].dead > 0.7) { tracks[i].el.remove(); tracks.splice(i, 1); }
    }
    plates.forEach((p, i) => {
      flash[i] = Math.max(0, flash[i] - dt * 3.2);
      p.classList.toggle('on', flash[i] > 0.08);
    });
    drawHist();
    raf = requestAnimationFrame(step);
  }
  function start() { if (running || reduce) return; running = true; last = 0; raf = requestAnimationFrame(step); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  seed();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(histCanvas);
  else window.addEventListener('resize', resize);
  resize();

  if (reduce) {
    if (scene) {
      for (let k = 0; k < 4; k++) {
        const theta = sampleTheta();
        const el = document.createElement('div');
        el.className = 'muon-track';
        el.style.left = (20 + k * 18) + '%';
        el.style.top = (8 + k * 10) + '%';
        el.style.transform = `rotateZ(${(theta * 18).toFixed(2)}deg)`;
        scene.appendChild(el);
      }
    }
    drawHist();
  } else {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { visible = es[0].isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(fig);
    }
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : (visible && start()); });
    start();
  }
})();
