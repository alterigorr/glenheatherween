"""Generates the decorative SVG snippets used in index.html (cobweb, pumpkin patch).
Run: python3 icons-src/make-halloween-art.py  -> prints the snippets."""
import math, random

def cobweb(size=160, spokes=7, rings=(20, 40, 62, 86, 112, 140), seed=4):
    rnd = random.Random(seed)
    angles = [math.radians(2 + i * (86 / (spokes - 1)) + rnd.uniform(-3, 3)) for i in range(spokes)]
    d = []
    for a in angles:
        L = size * rnd.uniform(.92, 1.0)
        d.append(f"M0 0L{L*math.cos(a):.1f} {L*math.sin(a):.1f}")
    for r in rings:
        r = r * size / 160
        pts = [(r * rnd.uniform(.94, 1.04) * math.cos(a), r * rnd.uniform(.94, 1.04) * math.sin(a)) for a in angles]
        seg = f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"
        for (x0, y0), (x1, y1), a0, a1 in zip(pts, pts[1:], angles, angles[1:]):
            mid = (a0 + a1) / 2
            sag = r * .8  # threads droop toward the corner
            seg += f"Q{sag*math.cos(mid):.1f} {sag*math.sin(mid):.1f} {x1:.1f} {y1:.1f}"
        d.append(seg)
    return "".join(d)

def pumpkin(cx, r, face):
    ry = r * .8
    cy = 138 - ry
    out = [
        f'<g class="pk">',
        f'<ellipse cx="{cx - r*.42:.1f}" cy="{cy:.1f}" rx="{r*.6:.1f}" ry="{ry:.1f}" fill="#D9571A"/>',
        f'<ellipse cx="{cx + r*.42:.1f}" cy="{cy:.1f}" rx="{r*.6:.1f}" ry="{ry:.1f}" fill="#D9571A"/>',
        f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{r*.62:.1f}" ry="{ry*1.02:.1f}" fill="#F07A1F"/>',
        f'<rect x="{cx - r*.1:.1f}" y="{cy - ry - r*.3:.1f}" width="{r*.2:.1f}" height="{r*.42:.1f}" rx="1" fill="#3E4A1E"/>',
    ]
    e, m = cy - r * .12, cy + r * .28
    if face == 'grin':
        f = (f"M{cx-.55*r:.1f} {e:.1f}l{.2*r:.1f} {-.32*r:.1f}l{.2*r:.1f} {.32*r:.1f}z"
             f"M{cx+.15*r:.1f} {e:.1f}l{.2*r:.1f} {-.32*r:.1f}l{.2*r:.1f} {.32*r:.1f}z"
             f"M{cx-.58*r:.1f} {m-.08*r:.1f}Q{cx:.1f} {m+.55*r:.1f} {cx+.58*r:.1f} {m-.08*r:.1f}"
             f"l{-.16*r:.1f} {.1*r:.1f}l{-.1*r:.1f} {-.12*r:.1f}l{-.13*r:.1f} {.14*r:.1f}l{-.12*r:.1f} {-.14*r:.1f}"
             f"l{-.13*r:.1f} {.14*r:.1f}l{-.1*r:.1f} {-.12*r:.1f}z")
    elif face == 'oh':
        f = (f"M{cx-.32*r:.1f} {e-.08*r:.1f}m{-.13*r:.1f} 0a{.13*r:.1f} {.15*r:.1f} 0 1 0 {.26*r:.1f} 0a{.13*r:.1f} {.15*r:.1f} 0 1 0 {-.26*r:.1f} 0"
             f"M{cx+.32*r:.1f} {e-.08*r:.1f}m{-.13*r:.1f} 0a{.13*r:.1f} {.15*r:.1f} 0 1 0 {.26*r:.1f} 0a{.13*r:.1f} {.15*r:.1f} 0 1 0 {-.26*r:.1f} 0"
             f"M{cx:.1f} {m:.1f}m{-.15*r:.1f} 0a{.15*r:.1f} {.2*r:.1f} 0 1 0 {.3*r:.1f} 0a{.15*r:.1f} {.2*r:.1f} 0 1 0 {-.3*r:.1f} 0")
    else:  # 'mean'
        f = (f"M{cx-.58*r:.1f} {e-.28*r:.1f}l{.42*r:.1f} {.18*r:.1f}l{-.08*r:.1f} {.2*r:.1f}z"
             f"M{cx+.58*r:.1f} {e-.28*r:.1f}l{-.42*r:.1f} {.18*r:.1f}l{.08*r:.1f} {.2*r:.1f}z"
             f"M{cx-.52*r:.1f} {m-.05*r:.1f}h{1.04*r:.1f}l{-.12*r:.1f} {.28*r:.1f}l{-.14*r:.1f} {-.12*r:.1f}"
             f"l{-.12*r:.1f} {.16*r:.1f}l{-.12*r:.1f} {-.16*r:.1f}l{-.12*r:.1f} {.16*r:.1f}l{-.14*r:.1f} {-.12*r:.1f}z")
    out.append(f'<path class="face" d="{f}"/>')
    out.append('</g>')
    return "".join(out)

if __name__ == '__main__':
    print("WEB:", cobweb())
    patch = [(96, 15, 'grin'), (262, 12, 'oh'), (402, 11, 'mean'), (888, 13, 'grin'), (1058, 12, 'oh')]
    print("PATCH:", "\n".join(pumpkin(*p) for p in patch))
