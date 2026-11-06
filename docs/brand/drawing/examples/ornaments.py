# Ornaments: wax seal, yarn corner, lace (lace() is the one in use), status icons.
import math
from lib import Path, stroke, blob, ring, arc, quad, rot, catmull

def svg(vb, body):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" fill="currentColor">%s</svg>\n' % (vb, body)

def el(p, extra=""):
    return '<path%s d="%s"/>' % (extra, p.d)

def along(poly, s0, s1, n=5):
    """Points between arc-lengths s0..s1 along a polyline."""
    segs = [(poly[i], poly[i+1], math.dist(poly[i], poly[i+1])) for i in range(len(poly)-1)]
    def at(s):
        for a, b, l in segs:
            if s <= l:
                t = s / l
                return (a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t)
            s -= l
        return poly[-1]
    return [at(s0 + (s1-s0)*i/(n-1)) for i in range(n)]

# ---------------- seal ----------------
def seal():
    cx, cy = 50, 47.5
    P = lambda a, r: (cx + r*math.cos(math.radians(a)), cy + r*math.sin(math.radians(a)))
    # lumpy wax edge every ~20 degrees, with drips pushed out along the lower right
    lumps = [(-90, 44.6), (-70, 45.6), (-50, 44.4), (-30, 45.8), (-10, 44.8), (10, 45.6), (30, 44.6)]
    def drip(a, r, L, wd):
        return [(a-wd*1.9, r), (a-wd*.75, r+L*.4), (a-wd*1.05, r+L*.78), (a-wd*.5, r+L), (a+wd*.5, r+L), (a+wd*1.05, r+L*.78), (a+wd*.75, r+L*.4), (a+wd*1.9, r)]
    E = lumps + drip(50, 45, 5.4, 2.6) + [(68, 45.4)] + drip(86, 45.6, 3.4, 2.4) + [(106, 45.2), (126, 45.9)] + drip(142, 45, 2.2, 2) + [
         (166, 45.6), (186, 44.4), (206, 45.8), (226, 44.6), (248, 45.6)]
    w = Path()
    blob(w, [P(a, r) for a, r in E])
    # pressed ring, cut out: one sweep with a lift near the top
    stroke(w, arc(cx, cy, 38.4, 38, -68, 266, 16, wob=[0, .005, -.004, .006, 0, -.005, .004, .005,
                                                      -.004, .004, 0, -.005, .004, 0, .005, 0]), .8, a=.06, b=.1, e=.3)
    # light on the rolled lip, cut out
    stroke(w, arc(cx, cy, 42.2, 42.2, 200, 236, 5), .55, a=.45, b=.45)
    stroke(w, arc(cx, cy, 42.4, 42.4, -30, -10, 4), .45, a=.45, b=.45)
    d = Path()
    blob(d, arc(*P(70, 51.4), 1.3, 1.5, 0, 300, 5))
    return svg("0 0 100 100", el(w, ' fill-rule="evenodd"') + el(d))

# ---------------- yarn corner ----------------
def yarn_corner():
    cx, cy, r = 30, 39, 19.5
    P = lambda a, k=.97: (cx + r*k*math.cos(math.radians(a)), cy + r*k*math.sin(math.radians(a)))
    g = Path()
    stroke(g, arc(cx, cy, r, r, 235, 505, 10, wob=[0, .015, -.005, -.018, .004, .02, -.004, -.016, .006, 0]), 1.55, a=.12, b=.2)
    stroke(g, arc(cx, cy, r+.7, r+.7, 122, 250, 5), .7, a=.35, b=.4)
    M = [quad(P(a0), P(a1), .1, 21, side=1) for a0, a1 in ((-62, 152), (-42, 132))]
    for m in M:
        stroke(g, m[::4], .85, a=.2, b=.2)
    for a, t in ((194, 14), (228, 7)):
        stroke(g, quad(P(a), M[0][t], .1, 4, side=-1), .72, a=.3, b=.15)
    for a, t in ((-6, 8), (24, 13), (56, 18)):
        stroke(g, quad(P(a), M[1][t], .1, 4, side=1), .72, a=.3, b=.15)
    stroke(g, [(44, 54), (56, 58.5), (70, 59.2), (83, 56.2), (89.5, 48.8), (84.5, 43.6), (78, 47.6), (82, 56),
               (96, 59.8), (114, 59.6), (130, 57.4), (145, 58.4), (158, 56.6)], .82, a=.05, b=.18, e=.3)
    stroke(g, [(3, 59.8), (14, 59.4), (24, 59.9)], .6, a=.4, b=.3)
    return svg("0 0 160 64", el(g))

# ---------------- lace tile ----------------
def lace():
    p = Path()
    # the header's fabric: a band whose lower edge swells into each scallop
    blob(p, [(-1, -1), (25, -1), (25, 2.7), (24, 2.9), (12, 2.8), (0, 2.9), (-1, 2.7)], k=.5)
    stroke(p, [(0, 2.2), (2.6, 7.4), (7, 10.3), (12, 10.9), (17, 10.3), (21.4, 7.4), (24, 2.2)], 1.1, a=.25, b=.25, e=.4)
    # eyelet: a small ring with a nib swell
    # eyelet: closed ring, heavier at the bottom like a nib swell (evenodd hole)
    e = Path()
    blob(e, arc(12, 5.3, 2.55, 2.45, 0, 330, 8))
    blob(e, arc(12.2, 4.95, 1.45, 1.4, 0, 330, 8))
    # picot where scallops meet (half on each edge so tiles join)
    blob(p, arc(0, 4.6, 1.3, 1.5, 0, 300, 6))
    blob(p, arc(24, 4.6, 1.3, 1.5, 0, 300, 6))
    return svg("0 0 24 12", el(p) + el(e, ' fill-rule="evenodd"'))

def lace_b():
    """Line scallop, eyelet as a solid dot."""
    p = Path()
    blob(p, [(-1, -1), (25, -1), (25, 2.7), (24, 2.9), (12, 2.8), (0, 2.9), (-1, 2.7)], k=.5)
    stroke(p, [(0, 2.2), (2.6, 7.4), (7, 10.3), (12, 10.9), (17, 10.3), (21.4, 7.4), (24, 2.2)], 1.1, a=.25, b=.25, e=.4)
    blob(p, [(12, 3.9), (13.3, 4.8), (13.1, 6.3), (12, 6.9), (10.8, 6.3), (10.7, 4.8)])
    blob(p, arc(0, 4.6, 1.3, 1.5, 0, 300, 6))
    blob(p, arc(24, 4.6, 1.3, 1.5, 0, 300, 6))
    return svg("0 0 24 12", el(p))

def lace_c():
    """Crochet shell: tall stitches fanning out of an eyelet, closed by the edge."""
    p = Path()
    blob(p, [(-1, -1), (25, -1), (25, 2.4), (12, 2.9), (-1, 2.4)], k=.6)
    for a in (45, 90, 135):
        c, s_ = math.cos(math.radians(a)), math.sin(math.radians(a))
        stroke(p, [(12 + 2.1*c, 4.1 + 2.1*s_), (12 + 3.9*c, 4.1 + 3.9*s_), (12 + 5.4*c, 4.1 + 5.4*s_)], .78, a=.15, b=.55, e=.35)
    stroke(p, [(0, 2.6), (3, 7.6), (7.4, 10.6), (12, 11.2), (16.6, 10.6), (21, 7.6), (24, 2.6)], .75, a=.3, b=.3, e=.35)
    blob(p, arc(0, 4.4, 1.2, 1.4, 0, 300, 6))
    blob(p, arc(24, 4.4, 1.2, 1.4, 0, 300, 6))
    return svg("0 0 24 12", el(p))

# ---------------- icons ----------------
def icon_running():
    p = Path()
    stroke(p, [(2.8, 2), (8, 1.6), (13.2, 2)], 1.0, a=.15, b=.15, e=.6)
    stroke(p, [(2.8, 14), (8, 14.4), (13.2, 14)], 1.0, a=.15, b=.15, e=.6)
    stroke(p, [(4.7, 2.3), (5.3, 5.2), (7.1, 7.6), (7.1, 8.4), (5.3, 10.8), (4.7, 13.7)], .8, a=.15, b=.15, e=.55)
    stroke(p, [(11.3, 2.3), (10.7, 5.2), (8.9, 7.6), (8.9, 8.4), (10.7, 10.8), (11.3, 13.7)], .8, a=.15, b=.15, e=.55)
    blob(p, [(5.6, 13.6), (7, 12), (8, 11.4), (9, 12), (10.4, 13.6)])
    stroke(p, [(8, 8.6), (8.1, 10), (8, 11.4)], .35, a=.3, b=.3, e=.2)
    return svg("0 0 16 16", el(p))

def icon_done():
    p = Path()
    poly = [(2.3, 8.4), (6.2, 12.2), (13.9, 3.4)]
    L = math.dist(poly[0], poly[1]) + math.dist(poly[1], poly[2])
    for s0, s1 in ((0, 5.0), (6.2, 11.1), (12.4, L)):
        stroke(p, along(poly, s0, s1, 4), 1.3, a=.35, b=.35, e=.55)
    return svg("0 0 16 16", el(p))

def icon_partial():
    p = Path()
    for x in (3.4, 12.6):
        for y in (1.6, 6.3, 11):
            stroke(p, [(x-2.1, y), (x-1.1, y+1.9), (x, y+3)], .78, a=.35, b=.5, e=.5)
            stroke(p, [(x+2.1, y), (x+1.1, y+1.9), (x, y+3)], .78, a=.35, b=.5, e=.5)
    for y in (3.4, 8.1, 12.8):
        stroke(p, [(6.3, y), (8, y+.4), (9.7, y)], .62, a=.3, b=.3, e=.45)
    return svg("0 0 16 16", el(p))

def icon_crown():
    """The alliance leader's mark: three points over a band, a bead on each tip (small cut, 16 px)."""
    p = Path()
    blob(p, [(2.1, 12.2), (1.7, 8.6), (1.3, 4.9), (3.6, 7.0), (5.7, 8.6), (8, 3.3), (10.3, 8.6), (12.4, 7.0), (14.7, 4.9), (14.3, 8.6), (13.9, 12.2), (8, 12.9)], k=.3)
    stroke(p, [(2.4, 14.4), (8, 14.8), (13.6, 14.4)], .75, a=.15, b=.15, e=.45)
    blob(p, arc(1.6, 4.1, .95, .9, 0, 300, 6))
    blob(p, arc(8, 2.2, 1.05, 1.0, 0, 300, 6))
    blob(p, arc(14.4, 4.1, .95, .9, 0, 300, 6))
    return svg("0 0 16 16", el(p, ' fill-rule="evenodd"'))

def icon_officer():
    """A titled officer's mark: a four-point stitch star, smaller and plainer than the crown."""
    p = Path()
    blob(p, [(8, 1.6), (9.1, 6.2), (14.2, 8), (9.1, 9.8), (8, 14.4), (6.9, 9.8), (1.8, 8), (6.9, 6.2)], k=.28)
    return svg("0 0 16 16", el(p))

def hole(path, pts, k=1.0):
    """A cut-out: a closed shape wound clockwise, so under the default nonzero fill it subtracts from the
    counter-clockwise blobs and strokes it sits on (they still merge where they overlap)."""
    area = sum(pts[i][0]*pts[(i+1) % len(pts)][1] - pts[(i+1) % len(pts)][0]*pts[i][1] for i in range(len(pts)))
    if area > 0: pts = list(reversed(pts))
    segs = catmull(pts, closed=True, k=k)
    path.M(segs[0][0])
    for s in segs: path.C(s[1], s[2], s[3])
    path.Z()

# The four R4 title slots (DESIGN.md role-mark): same 16 px filled cut as the crown and the star.
def icon_diplomat():
    """Diplomat: a dove flying left, wing up, an olive leaf hanging from the beak."""
    p = Path()
    # body: beak, round head, breast, belly sweeping into a fanned tail
    blob(p, [(1.2, 7.4), (2.6, 6.0), (4.3, 5.7), (6.6, 7.2), (9.6, 7.6), (12.6, 7.0), (15.0, 6.2), (14.4, 8.0),
             (15.0, 9.6), (12.4, 9.8), (9.2, 11.2), (5.6, 11.0), (3.6, 9.2), (2.8, 7.9)], k=.75)
    # wing raised and swept back, its tip split into two feathers
    blob(p, [(5.6, 7.4), (6.4, 4.6), (8.2, 2.4), (10.6, 1.0), (10.0, 2.8), (12.6, 2.0), (11.6, 4.4), (10.0, 6.4), (8.2, 7.6)], k=.6)
    hole(p, arc(3.6, 6.9, .42, .42, 0, 300, 6))
    stroke(p, [(1.6, 7.9), (1.4, 9.6), (2.2, 11.6)], .55, a=.3, b=.45, e=.12)
    return svg("0 0 16 16", el(p))

def icon_recruiter():
    """Recruiter: a calling horn, mouthpiece up at the left, curving down and out to a bell open to the right."""
    p = Path()
    stroke(p, [(1.8, 2.0), (2.4, 6.0), (4.6, 9.6), (8.4, 11.2), (11.8, 10.0)], ws=[.35, .75, 1.25, 1.8, 2.4])
    blob(p, arc(13.2, 8.6, 1.9, 3.3, 0, 330, 8, rot=-38), k=.9)
    hole(p, arc(13.5, 8.3, .8, 2.1, 0, 330, 8, rot=-38), k=.9)
    # one band, cut as a slot, and the mouthpiece bead
    hole(p, [(5.9, 9.0), (6.6, 9.4), (5.9, 12.0), (5.1, 11.6)], k=.5)
    blob(p, arc(1.8, 1.6, .75, .7, 0, 300, 6))
    return svg("0 0 16 16", el(p))

def icon_militarist():
    """Militarist (God of War in game): two swords crossed, hilts down, guards and pommels."""
    p = Path()
    for s in (1, -1):
        X = lambda x: 8 + (x - 8) * s
        stroke(p, [(X(3.6), 12.4), (X(8.4), 7.6), (X(13.6), 2.0)], ws=[.85, .8, .25])
        stroke(p, [(X(1.4), 10.4), (X(3.4), 11.2), (X(4.8), 13.4)], .55, a=.2, b=.2, e=.4)
        stroke(p, [(X(3.0), 13.0), (X(2.1), 13.9)], .55, a=.1, b=.1, e=.5)
        blob(p, arc(X(1.6), 14.4, .85, .8, 0, 300, 6))
    return svg("0 0 16 16", el(p))

def icon_overseer():
    """Overseer (Goddess in game): an open eye, almond lids, the iris filled, three lashes."""
    p = Path()
    blob(p, [(.9, 8.6), (4.2, 5.2), (8, 4.2), (11.8, 5.2), (15.1, 8.6), (11.8, 11.6), (8, 12.6), (4.2, 11.6)], k=.85)
    hole(p, [(2.9, 8.6), (5.2, 6.6), (8, 6.0), (10.8, 6.6), (13.1, 8.6), (10.8, 10.4), (8, 10.9), (5.2, 10.4)], k=.85)
    blob(p, arc(8, 8.5, 2.0, 2.0, 0, 315, 8, wob=[0, .04, -.03, .05, 0, -.04, .03, 0]))
    for x0, x1, y1 in ((4.6, 3.6, 2.4), (8, 8, 1.4), (11.4, 12.4, 2.4)):
        stroke(p, [(x0, 5.0), ((x0 + x1) / 2, 3.6), (x1, y1)], .38, a=.2, b=.45, e=.12)
    return svg("0 0 16 16", el(p))

# The Movers tabs (DESIGN.md movers): the same 16 px filled cut, one per figure.
def icon_might():
    """Might: a boxing glove, the round mitt over a thumb at the left, a cuff below with a lace."""
    p = Path()
    blob(p, [(8.8, 0.7), (12.6, 1.6), (14.8, 4.4), (14.9, 7.8), (13.6, 10.6), (11.0, 11.5), (6.4, 11.5),
             (4.6, 10.6), (2.4, 9.6), (1.1, 7.4), (1.5, 5.0), (3.4, 4.6), (4.3, 2.6), (6.2, 1.1)], k=.85)
    hole(p, [(3.9, 5.4), (5.2, 7.4), (5.6, 9.6), (5.0, 9.8), (4.5, 7.6), (3.4, 5.8)], k=.6)
    blob(p, [(5.4, 12.3), (8.4, 12.1), (11.6, 12.3), (11.8, 15.3), (8.4, 15.6), (5.2, 15.3)], k=.5)
    hole(p, [(8.0, 12.9), (8.8, 12.9), (8.7, 15.0), (8.1, 15.0)], k=.4)
    return svg("0 0 16 16", el(p))

def icon_kills():
    """Kills: a skull, round cranium over a narrower jaw, two eyes, a nose and two tooth gaps."""
    p = Path()
    blob(p, arc(8, 7.2, 6.7, 6.4, 150, 390, 9, wob=[0, .02, -.02, .03, 0, -.03, .02, -.01, 0])
         + [(12.6, 11.8), (11.4, 12.4), (11.2, 14.8), (8, 15.4), (4.8, 14.8), (4.6, 12.4), (3.4, 11.8)], k=.8)
    hole(p, arc(5.5, 8.2, 1.7, 1.9, 0, 330, 7, wob=[0, .05, -.04, .06, 0, -.05, 0]))
    hole(p, arc(10.5, 8.2, 1.7, 1.9, 0, 330, 7, wob=[0, -.04, .05, -.03, .04, 0, 0]))
    hole(p, [(8, 10.2), (8.9, 11.9), (7.1, 11.9)], k=.4)
    for x in (6.8, 9.2):
        hole(p, [(x - .35, 13.0), (x + .35, 13.0), (x + .3, 15.6), (x - .3, 15.6)], k=.3)
    return svg("0 0 16 16", el(p))

def icon_rank():
    """Rank: a trophy cup with two handles, a short stem and a stepped base."""
    p = Path()
    blob(p, [(3.4, 1.4), (8, 1.1), (12.6, 1.4), (12.3, 5.4), (10.8, 8.2), (8, 9.4), (5.2, 8.2), (3.7, 5.4)], k=.8)
    for s in (1, -1):
        X = lambda x: 8 + (x - 8) * s
        stroke(p, [(X(3.6), 2.6), (X(1.2), 2.8), (X(1.0), 5.2), (X(2.6), 7.0), (X(5.0), 7.8)], ws=[.75, .8, .8, .7, .45])
    blob(p, [(7.1, 9.0), (8.9, 9.0), (8.7, 11.6), (9.6, 12.4), (6.4, 12.4), (7.3, 11.6)], k=.6)
    blob(p, [(4.2, 12.9), (8, 12.6), (11.8, 12.9), (12.4, 15.2), (8, 15.5), (3.6, 15.2)], k=.5)
    hole(p, [(5.0, 2.8), (6.0, 2.8), (6.0, 5.6), (5.4, 5.8)], k=.5)
    return svg("0 0 16 16", el(p))

def icon_live():
    """The /admin live mark: grandma's chamberstick, lit (small cut, 16-20 px). The flame and its glow
    ticks are two paths so CSS can sway the flame (pivot at the wick, 8 7.4) and flicker the ticks while a run
    is in progress."""
    p = Path()
    # wax body, melted down around the wick, a drip down the left
    blob(p, [(5.7, 9.3), (7.0, 8.9), (7.7, 9.5), (8.5, 9.4), (9.4, 8.8), (10.3, 9.2), (10.1, 11.8), (10.3, 13.8),
             (8, 14.1), (5.8, 13.9), (5.9, 12.3), (5.3, 11.7), (5.2, 10.4)], k=.8)
    # saucer, and its ring handle on the right (a hole cut by evenodd)
    stroke(p, [(2.7, 15.1), (7.4, 15.4), (12.5, 14.9)], .62, a=.12, b=.25, e=.42)
    ring(p, arc(13.6, 13.6, 1.25, 1.1, 0, 300, 6, wob=[0, .06, -.04, .05, 0, -.05]), .32)
    stroke(p, [(8.1, 9.3), (8.0, 8.3), (7.8, 7.6)], .3, a=.2, b=.4, e=.22)
    f = Path()
    # flame leaning a little, its tip curling, a small core cut out
    blob(f, [(8.9, 0.8), (9.3, 2.2), (10.0, 3.6), (10.0, 5.3), (9.1, 6.6), (7.9, 7.0), (6.8, 6.5), (6.3, 5.2),
             (6.8, 3.5), (8.0, 2.3)], k=.85)
    blob(f, [(8.3, 4.9), (8.7, 5.6), (8.3, 6.2), (7.8, 5.9), (7.9, 5.3)], k=.8)
    # glow ticks, their own path: they flicker while the flame sways
    g = Path()
    stroke(g, [(4.8, 3.6), (4.0, 2.8), (3.1, 2.3)], .42, a=.3, b=.5, e=.12)
    stroke(g, [(11.4, 3.5), (12.2, 2.7), (13.1, 2.3)], .42, a=.3, b=.5, e=.12)
    stroke(g, [(4.3, 6.0), (3.3, 5.8), (2.3, 5.9)], .4, a=.3, b=.5, e=.12)
    stroke(g, [(11.9, 6.0), (12.9, 5.8), (13.9, 5.9)], .4, a=.3, b=.5, e=.12)
    return svg("0 0 16 16", el(p, ' fill-rule="evenodd"') + el(f, ' fill-rule="evenodd" data-anim="flame"')
               + el(g, ' data-anim="glow"'))

ITEMS = {"seal": seal, "yarn-corner": yarn_corner, "lace": lace, "lace-alt-dot": lace_b,
         "icon-running": icon_running, "icon-crown": icon_crown, "icon-officer": icon_officer, "icon-done": icon_done, "icon-partial": icon_partial}

# ---------------- placeholders (28-56 px: filled shapes, the small-cut rule) ----------------
def no_photo():
    """A player without a photo: the Granny Doctor in profile, facing left like the mark (no hat, so it
    never reads as the logo): bun with a knitting needle through it, beak mask with its seam, goggle and
    strap, shoulders kept off the head by a gap."""
    p = Path()
    blob(p, arc(23.8, 8.4, 2.7, 2.5, 0, 300, 6, wob=[0, .04, -.03, .03, 0, -.03]))
    stroke(p, [(20.6, 5), (24, 7.6), (28.2, 10.6)], .5, a=.05, b=.05, e=.42)
    blob(p, arc(28.6, 10.9, .9, .9, 0, 300, 5))
    blob(p, [(5.2, 30.8), (6.4, 26.8), (9.6, 23.6), (14, 21.8), (18, 21.4), (22.4, 22.4), (25.8, 25),
             (27.6, 30.8), (16, 31)], k=.9)
    blob(p, arc(14.7, 12.7, .8, .8, 0, 300, 5))
    # beak: hooked tip, kept off the goggle; its seam cut out (evenodd)
    b = Path()
    blob(b, [(13, 10.4), (9.6, 11.4), (6.2, 13.4), (3.6, 15.8), (2.9, 17.8), (4.2, 18.1), (5.6, 17),
             (9, 16.2), (12.6, 16.2)], k=.9)
    stroke(b, [(12.2, 13.4), (9, 14), (6.2, 15.4)], .32, a=.3, b=.4, e=.1)
    # head with the goggle and the strap cut out (evenodd)
    h = Path()
    blob(h, arc(18.2, 13.6, 6, 6.3, 0, 330, 8, wob=[0, .03, -.02, .02, .03, -.02, .02, -.03]))
    blob(h, arc(14.9, 12.6, 2, 1.9, 0, 300, 6, wob=[0, .05, -.03, .04, 0, -.04]))
    stroke(h, [(16.9, 12.2), (20, 11.6), (23.4, 12)], .4, a=.15, b=.3, e=.2)
    return svg("0 0 32 32", el(p) + el(b, ' fill-rule="evenodd"') + el(h, ' fill-rule="evenodd"'))

def no_badge():
    """An alliance without a badge: a crocheted banner on its rod, scalloped hem with eyelets and picots,
    a granny square where the emblem would be."""
    p = Path()
    stroke(p, [(3.6, 5.4), (16, 5), (28.4, 5.5)], 1.05, a=.06, b=.06, e=.7)
    blob(p, arc(3.2, 5.4, 1.7, 1.8, 0, 300, 6))
    blob(p, arc(28.8, 5.5, 1.7, 1.8, 0, 300, 6))
    for x in (12.9, 19.1):
        blob(p, arc(x, 25.1, .9, 1, 0, 300, 5))
    blob(p, arc(16, 14.1, 1.25, 1.2, 0, 300, 6))
    # cloth with the square's place cut out (evenodd, own path)
    c = Path()
    blob(c, [(7.6, 6.8), (16, 6.6), (24.4, 6.9), (24.2, 14), (24.5, 21.4), (16, 21.7), (7.5, 21.5), (7.8, 14)], k=.8)
    blob(c, [(12.4, 10.6), (16, 10.4), (19.6, 10.7), (19.7, 14), (19.5, 17.6), (16, 17.8), (12.5, 17.5), (12.3, 14)], k=.6)
    # hem: three scallops, each with its eyelet
    h = Path()
    for x in (10.2, 16, 21.8):
        blob(h, [(x - 3, 20.6), (x + 3, 20.6), (x + 3.1, 22.9), (x + 1.9, 25.2), (x, 25.9), (x - 1.9, 25.2), (x - 3.1, 22.9)], k=.9)
        blob(h, arc(x, 23, .95, .95, 0, 300, 5))
    return svg("0 0 32 32", el(p) + el(c, ' fill-rule="evenodd"') + el(h, ' fill-rule="evenodd"'))
