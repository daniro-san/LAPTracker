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

ITEMS = {"seal": seal, "yarn-corner": yarn_corner, "lace": lace, "lace-alt-dot": lace_b,
         "icon-running": icon_running, "icon-done": icon_done, "icon-partial": icon_partial}
