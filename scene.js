// Halloween scene: bats and a witch flying across the sky, figures in the windows, a cat on the
// fence, and a spider that scurries up its thread when poked. Purely decorative.
// Motion only runs while the scene is on screen, and not at all for reduced-motion users.
(() => {
  const scene = document.querySelector('.scene');
  if (!scene) return;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = scene.querySelector('.skyline');
  const batLayer = scene.querySelector('.bats');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const rand = (a, b) => a + Math.random() * (b - a);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const pick = list => list[Math.floor(Math.random() * list.length)];

  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(scene);
  const canAnimate = () => onScreen && !document.hidden && !reduce.matches;

  // Run `fn` every so often (a random gap each time), skipping turns while it can't be seen.
  function every(minMs, maxMs, fn, firstMs) {
    const tick = async () => {
      if (canAnimate()) await fn();
      setTimeout(tick, rand(minMs, maxMs));
    };
    setTimeout(tick, firstMs ?? rand(minMs, maxMs));
  }

  /* ------------------------------------------------------------------ bats */

  // Front view: two wings hinged at the shoulders, so they can flap independently.
  const WING = 'M47 24C40 15 24 10 3 16C8 20 10 25 9 30C14 26 19 26 22 31C25 26 30 26 33 32C36 27 42 27 47 32Z';
  const BAT_SVG = `<svg viewBox="0 0 100 50">
    <g class="wl"><path d="${WING}"/></g>
    <g class="wr"><path d="${WING}" transform="matrix(-1 0 0 1 100 0)"/></g>
    <ellipse cx="50" cy="31" rx="4.6" ry="8.5"/><circle cx="50" cy="22.5" r="4.2"/>
    <path d="M46.6 21L45.2 13.2L48.8 19ZM53.4 21L54.8 13.2L51.2 19Z"/></svg>`;

  function makeBat(depth) {
    const el = document.createElement('div');
    el.className = 'flyer';
    el.innerHTML = BAT_SVG;
    // Farther bats beat their wings a touch slower; each one is out of phase with the rest.
    const flap = rand(.2, .26) + (1 - depth) * .06;
    el.style.setProperty('--flap', `${flap.toFixed(3)}s`);
    el.style.setProperty('--flap-delay', `${(-Math.random() * flap).toFixed(3)}s`);
    return el;
  }

  // A bat crossing the sky on a wavy path. depth 0 = far away (small, slow, faint), 1 = close.
  function flyAcross({ dir, y, depth, delay = 0 }) {
    const el = makeBat(depth);
    batLayer.append(el);
    const w = scene.clientWidth;
    const size = el.offsetWidth;
    const scale = .45 + depth * .55;
    const x0 = dir > 0 ? -size : w + size / 2;
    const x1 = dir > 0 ? w + size / 2 : -size * 1.5;
    const waves = rand(1.3, 2.6), amp = rand(7, 16) * scale, climb = rand(-28, 14);
    const frames = [];
    const N = 36;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = x0 + (x1 - x0) * t;
      const yy = y + climb * t + Math.sin(t * Math.PI * 2 * waves) * amp;
      // Bank gently into each rise and dip.
      const bank = Math.cos(t * Math.PI * 2 * waves) * 10 * dir;
      frames.push({ transform: `translate(${x.toFixed(1)}px, ${yy.toFixed(1)}px) rotate(${bank.toFixed(1)}deg) scale(${scale.toFixed(2)})` });
    }
    el.style.opacity = (.7 + depth * .3).toFixed(2);
    const px = Math.abs(x1 - x0);
    const speed = 70 + depth * 90; // px per second
    return el.animate(frames, { duration: (px / speed) * 1000, delay, easing: 'linear', fill: 'backwards' })
      .finished.then(() => el.remove());
  }

  function flock() {
    const dir = Math.random() < .5 ? 1 : -1;
    const count = pick([1, 1, 2, 2, 3]);
    const y = rand(18, 80);
    const depth = rand(.2, 1);
    const trips = [];
    for (let i = 0; i < count; i++) {
      trips.push(flyAcross({
        dir,
        y: y + rand(-14, 14),
        depth: Math.min(1, Math.max(0, depth + rand(-.15, .15))),
        delay: i * rand(220, 650)
      }));
    }
    return Promise.all(trips);
  }

  /* -------------------------------------------------------- window figures */

  // Figures drawn in a 20×20 box standing on the window sill (y = 20).
  const FIGURES = {
    person: '<circle cx="10" cy="8" r="3.6"/><path d="M2.5 21C3 14.5 6 12.6 10 12.6S17 14.5 17.5 21Z"/>',
    witch: '<path d="M3 21C3.5 15.5 6.5 13.8 10 13.8S16.5 15.5 17 21Z"/><circle cx="10" cy="10.6" r="3"/><path d="M3.6 8.8H16.4L12.3 7.5L14.2.4L8.1 7.5Z"/>',
    ghost: '<path d="M5 22V10.5C5 4.5 15 4.5 15 10.5V22L13.3 20L11.7 22L10 20L8.3 22L6.7 20Z"/><ellipse class="hole" cx="8.3" cy="10.8" rx="1.15" ry="1.7"/><ellipse class="hole" cx="11.7" cy="10.8" rx="1.15" ry="1.7"/>',
    hand: '<path d="M6.2 22V12.4C6.2 11.2 7.8 11.2 7.8 12.4V5.8C7.8 4.6 9.4 4.6 9.4 5.8V4.4C9.4 3.2 11 3.2 11 4.4V5.8C11 4.6 12.6 4.6 12.6 5.8V12.6L13.9 10.6C14.6 9.6 16.2 10.3 15.5 11.5L13 17.2V22Z"/>',
    cat: '<path d="M6.2 21C5.6 17.4 6.6 14.6 8.2 13.4L7.6 8.6L9.7 10.7H11.7L13.8 8.6L13.2 13.4C14.8 14.6 15.8 17.4 15.2 21Z"/><path d="M15 20.4C17.5 20.4 18.4 18 17.6 16" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" class="tail"/>'
  };

  let defs = svg.querySelector('defs');
  if (!defs) { defs = document.createElementNS(NS, 'defs'); svg.prepend(defs); }
  let clipId = 0;

  const windows = Array.from(svg.querySelectorAll('rect.w'))
    .filter(r => +r.getAttribute('width') >= 14 && +r.getAttribute('height') >= 14);

  function flickerLight(node) {
    return node.animate([{ opacity: 1 }, { opacity: .35 }, { opacity: 1 }, { opacity: .55 }, { opacity: 1 }],
      { duration: 420, easing: 'steps(5, end)' }).finished;
  }

  async function peek() {
    const win = pick(windows);
    const x = +win.getAttribute('x'), y = +win.getAttribute('y');
    const w = +win.getAttribute('width'), h = +win.getAttribute('height');
    const kind = pick(['person', 'person', 'witch', 'ghost', 'hand', 'cat']);

    const clip = document.createElementNS(NS, 'clipPath');
    clip.id = `peek-${++clipId}`;
    const r = win.cloneNode();
    r.removeAttribute('class');
    clip.append(r);
    defs.append(clip);

    const k = Math.min(w, h) / 20;
    const outer = document.createElementNS(NS, 'g');
    outer.setAttribute('clip-path', `url(#${clip.id})`);
    const place = document.createElementNS(NS, 'g');
    place.setAttribute('transform', `translate(${x + (w - 20 * k) / 2} ${y + h - 20 * k}) scale(${k})`);
    const fig = document.createElementNS(NS, 'g');
    fig.setAttribute('class', 'fig');
    fig.innerHTML = FIGURES[kind];
    place.append(fig);
    outer.append(place);
    win.after(outer);

    await flickerLight(win);
    let motion;
    if (kind === 'ghost') {
      // Drifts across the window, bobbing.
      motion = fig.animate([
        { transform: 'translate(-24px, 2px)' }, { transform: 'translate(-8px, -1px)' },
        { transform: 'translate(8px, 1.5px)' }, { transform: 'translate(24px, -1px)' }
      ], { duration: 3400, easing: 'ease-in-out' });
    } else if (kind === 'hand') {
      // Slaps against the glass, lingers, slides down.
      motion = fig.animate([
        { transform: 'translateY(0) scale(1.25)', opacity: 0 },
        { transform: 'translateY(0) scale(1)', opacity: 1, offset: .06 },
        { transform: 'translateY(0) scale(1)', opacity: 1, offset: .6 },
        { transform: 'translateY(9px) scale(1)', opacity: 0 }
      ], { duration: 2400, easing: 'ease-in' });
    } else {
      // Rises into view from below the sill, pauses, sinks away.
      motion = fig.animate([
        { transform: 'translateY(22px)' }, { transform: 'translateY(0)', offset: .22 },
        { transform: 'translateY(0)', offset: .78 }, { transform: 'translateY(22px)' }
      ], { duration: 3600, easing: 'cubic-bezier(.4, 0, .2, 1)' });
    }
    await motion.finished;
    outer.remove();
    clip.remove();
  }

  // The round attic window goes dark and something blinks out of it.
  async function atticEyes() {
    const attic = svg.querySelector('#attic');
    if (!attic) return;
    const cx = +attic.getAttribute('cx'), cy = +attic.getAttribute('cy'), r = +attic.getAttribute('r');
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = `<circle class="fig" cx="${cx}" cy="${cy}" r="${r}"/>
      <g class="eyes" style="transform-box: fill-box; transform-origin: center">
        <ellipse cx="${cx - 2.6}" cy="${cy}" rx="1.6" ry="1.2"/><ellipse cx="${cx + 2.6}" cy="${cy}" rx="1.6" ry="1.2"/></g>`;
    attic.after(g);
    const dark = g.firstElementChild, eyes = g.querySelector('.eyes');
    dark.style.opacity = 0; eyes.style.opacity = 0;
    await dark.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'forwards' }).finished;
    await eyes.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'forwards' }).finished;
    await eyes.animate([
      { transform: 'scaleY(1)' }, { transform: 'scaleY(.1)', offset: .1 }, { transform: 'scaleY(1)', offset: .2 },
      { transform: 'scaleY(1)', offset: .7 }, { transform: 'scaleY(.1)', offset: .78 }, { transform: 'scaleY(1)', offset: .86 },
      { transform: 'scaleY(1)' }
    ], { duration: 2400 }).finished;
    await g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).finished;
    g.remove();
  }

  /* ----------------------------------------------------------------- witch */

  // A witch on her broom (facing right), cape and hair streaming behind, a black cat riding along.
  const WITCH_SVG = `<svg viewBox="-8 -10 128 76">
    <path d="M14 50Q60 44 116 40L116 42.4Q60 46.6 14 52.4Z"/>
    <path d="M16 49C10 46 4 42-3 40C1 45 0 50-5 55C1 55 9 54 16 53Z"/>
    <path class="cape" d="M60 26C50 29 38 34 22 35C30 37 36 38 42 41C36 42 30 44 24 47C36 47 48 45 58 42Z"/>
    <path d="M53 45C51 49 47 52 41 54C44 56 49 56 53 55C57 54 61 51 64 48L66 45Z"/>
    <path d="M56 45L63 26C65 21 72 21 73 26L70 45Z"/>
    <path d="M66 30L83 40.5L82 43L64 34Z"/>
    <circle cx="70" cy="18" r="5"/>
    <path d="M74.6 17.6L81 20.4L74.6 21.2Z"/>
    <path class="hair" d="M66 17C60 19 53 22 46 21C52 25 60 25 67 22Z"/>
    <path d="M57 14.5C65 11 80 11 87 14C79 16 66 16.6 57 14.5Z"/>
    <path d="M63.5 13.5C63 7 60 1 51-6C60-4 68 3 74 12Z"/>
    <path d="M66 45L78 49L85 47L86.6 49.4L78 52L64 48Z"/>
    <path d="M33 48C32 44 33 41 35 40L34.5 36.5L36.6 38.6H38.6L40.6 36.5L40.2 40C42 41 43 44 42 48Z"/>
    <path class="wcat-tail" d="M33.5 47C29 46 27 42 29 39C29.6 38 30.8 38.4 30.4 39.4C29.4 42 30.6 44.6 34 45.4Z"/></svg>`;

  // Smooth curve through waypoints (Catmull-Rom), sampled evenly by distance so the speed is steady.
  function spline(pts, n) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < 40; k++) {
        const t = k / 40, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
      }
    }
    out.push(pts[pts.length - 1]);
    const len = [0];
    for (let i = 1; i < out.length; i++) len.push(len[i - 1] + Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y));
    const total = len[len.length - 1], res = [];
    for (let j = 0, i = 0; j <= n; j++) {
      const d = total * j / n;
      while (i < len.length - 2 && len[i + 1] < d) i++;
      const u = (d - len[i]) / ((len[i + 1] - len[i]) || 1);
      res.push({ x: out[i].x + (out[i + 1].x - out[i].x) * u, y: out[i].y + (out[i + 1].y - out[i].y) * u });
    }
    return { points: res, length: total };
  }

  // Swoops in low from the left, climbs across the face of the moon, and banks away up to the right.
  function witch() {
    const moon = scene.querySelector('.moon');
    if (!moon) return;
    const el = document.createElement('div');
    el.className = 'witch';
    el.innerHTML = WITCH_SVG;
    batLayer.append(el);
    const s = scene.getBoundingClientRect(), m = moon.getBoundingClientRect();
    const W = s.width, H = s.height, w = el.offsetWidth, h = el.offsetHeight;
    const mx = m.left - s.left + m.width / 2, my = m.top - s.top + m.height / 2;
    const { points, length } = spline([
      { x: -w, y: H * .46 }, { x: W * .28, y: H * .34 }, { x: mx - W * .12, y: my + H * .1 },
      { x: mx, y: my }, { x: W + w, y: Math.max(h * .3, my - H * .16) }
    ], 90);
    const frames = points.map((p, i) => {
      const q = points[Math.min(points.length - 1, i + 1)], o = points[Math.max(0, i - 1)];
      const bank = Math.max(-16, Math.min(16, Math.atan2(q.y - o.y, q.x - o.x) * 180 / Math.PI * .8));
      const bob = Math.sin(i / 90 * Math.PI * 9) * 2.2;
      return { transform: `translate(${(p.x - w / 2).toFixed(1)}px, ${(p.y - h / 2 + bob).toFixed(1)}px) rotate(${bank.toFixed(1)}deg)` };
    });
    return el.animate(frames, { duration: length / 150 * 1000, easing: 'ease-in-out' }).finished.then(() => el.remove());
  }

  /* ------------------------------------------------------------ fence cat */

  // A black cat walking the picket fence (fence runs x 470–620; picket tips at y 107).
  // Legs swing from the hips in a diagonal gait (CSS), the body bobs, the tail sways.
  function makeCat() {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'walk-cat');
    g.innerHTML = `
      <rect class="s leg a" x="5.2" y="-6.2" width="1.3" height="6.2" rx=".6"/>
      <rect class="s leg b" x="6.8" y="-6.2" width="1.3" height="6.2" rx=".6"/>
      <rect class="s leg b" x="14.6" y="-6.2" width="1.3" height="6.2" rx=".6"/>
      <rect class="s leg a" x="16.2" y="-6.2" width="1.3" height="6.2" rx=".6"/>
      <g class="torso">
        <path class="s ctail" d="M4.2-8.2C1.6-9.2.4-12.2.9-15.6C1.1-16.7 2.4-16.5 2.3-15.5C2-12.6 3-10.6 5.2-9.6Z"/>
        <path class="s" d="M3.6-7.8C3.2-10.2 5.6-11.4 8.6-11.2C11.2-11 13.4-11.6 15.6-11.2C17.4-10.9 18.4-9.6 18.2-8C18-6.4 16.8-5.6 15.2-5.6L6.4-5.6C4.8-5.6 3.8-6.4 3.6-7.8Z"/>
        <path class="s" d="M15.4-10.8L18.2-13.2L20.2-10.2L17.8-7.2Z"/>
        <path class="s" d="M17.2-11.2C17.2-13.4 18.8-14.6 20.4-14.6L21-16.8L22.1-14.3C23.6-13.6 24-12.2 23.4-11C22.8-9.8 21.4-9.2 20-9.4C18.6-9.6 17.2-10.2 17.2-11.2ZM18.9-14.2L19.1-16.8L20.4-14.6Z"/>
      </g>`;
    return g;
  }

  async function fenceCat() {
    const cat = makeCat();
    svg.append(cat);
    const at = x => ({ transform: `translate(${x}px, 107px)` });
    // Planted paw sweeps 2 × 6.2 × sin(18°) ≈ 3.8 units per 0.4 s, so walk 9.6 units/s to keep paws from sliding.
    const pace = 9.6;
    await cat.animate([at(466), at(588)], { duration: (588 - 466) / pace * 1000, easing: 'linear', fill: 'forwards' }).finished;
    cat.classList.add('stopped');               // pause and look out over the street
    await wait(2600);
    cat.classList.remove('stopped');
    await cat.animate([{ ...at(588), opacity: 1 }, { ...at(606), opacity: 0 }], { duration: 18 / pace * 1000, easing: 'linear', fill: 'forwards' }).finished;
    cat.remove();
  }

  /* --------------------------------------------------------------- spider */

  const spider = document.querySelector('.spider');
  if (spider) {
    spider.addEventListener('click', () => {
      if (spider.classList.contains('scurry')) return;
      spider.classList.add('scurry');
      setTimeout(() => spider.classList.remove('scurry'), 2600);
    });
  }

  /* ------------------------------------------------------------- schedule */

  // ?demo runs everything more often so the effects are quick to review.
  const demo = new URLSearchParams(location.search).has('demo');
  const often = demo ? .3 : 1;
  every(7000 * often, 15000 * often, flock, 1800);
  every(9000 * often, 18000 * often, () => (Math.random() < .2 ? atticEyes() : peek()), demo ? 2500 : 5000);
  every(45000 * often, 90000 * often, witch, demo ? 6000 : 20000);
  every(35000 * often, 70000 * often, fenceCat, demo ? 9000 : 30000);
})();
