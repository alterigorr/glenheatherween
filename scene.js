// Halloween scene: bats flying across the sky, figures in the windows, and a werewolf
// that rises against the moon when it's tapped. Purely decorative.
// Motion only runs while the scene is on screen, and not at all for reduced-motion users.
(() => {
  const scene = document.querySelector('.scene');
  if (!scene) return;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = scene.querySelector('.skyline');
  const batLayer = scene.querySelector('.bats');
  const burstLayer = scene.querySelector('.burst');
  const moon = scene.querySelector('.moon');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const wait = ms => new Promise(r => setTimeout(r, ms));

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

  // Bats scattering out of the moon toward the viewer.
  function burstFromMoon() {
    const s = scene.getBoundingClientRect();
    const m = moon.getBoundingClientRect();
    const cx = m.left - s.left + m.width / 2, cy = m.top - s.top + m.height / 2;
    const count = 5;
    for (let i = 0; i < count; i++) {
      const el = makeBat(1);
      burstLayer.append(el);
      const half = el.offsetWidth / 2;
      const angle = (-160 + (i / (count - 1)) * 140 + rand(-12, 12)) * Math.PI / 180;
      const dist = rand(260, 420);
      const tx = cx + Math.cos(angle) * dist, ty = cy + Math.sin(angle) * dist * .45 + rand(-10, 30);
      const mx = cx + Math.cos(angle) * dist * .4, my = cy + Math.sin(angle) * dist * .2 - rand(10, 30);
      el.animate([
        { transform: `translate(${cx - half}px, ${cy - 10}px) scale(.15)`, opacity: 0 },
        { transform: `translate(${mx - half}px, ${my}px) scale(.7)`, opacity: 1, offset: .35 },
        { transform: `translate(${tx - half}px, ${ty}px) scale(1.25)`, opacity: .95 }
      ], { duration: rand(1500, 2200), delay: i * 90, easing: 'cubic-bezier(.3, .1, .6, 1)', fill: 'backwards' })
        .finished.then(() => el.remove());
    }
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

  /* -------------------------------------------------------------- werewolf */

  let howling = false;
  moon.addEventListener('click', async () => {
    if (howling) return;
    howling = true;
    moon.classList.add('howl');
    if (!reduce.matches) setTimeout(burstFromMoon, 1300);
    await wait(4600);
    moon.classList.remove('howl');
    await wait(1100);
    howling = false;
  });

  /* ------------------------------------------------------------- schedule */

  // ?demo runs everything more often so the effects are quick to review.
  const demo = new URLSearchParams(location.search).has('demo');
  const often = demo ? .3 : 1;
  every(7000 * often, 15000 * often, flock, 1800);
  every(9000 * often, 18000 * often, () => (Math.random() < .2 ? atticEyes() : peek()), demo ? 2500 : 5000);
})();
