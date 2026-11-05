# The logo mark in two cuts: line() for 96 px and up, small() for 16-32 px. viewBox 64x64.
import math
from lib import *

def hole(path, pts, k=1.0):
    """Closed shape wound opposite to blob(), so it cuts a hole under nonzero fill."""
    area = sum(pts[i][0]*pts[(i+1) % len(pts)][1] - pts[(i+1) % len(pts)][0]*pts[i][1] for i in range(len(pts)))
    if area > 0: pts = list(reversed(pts))
    segs = catmull(pts, closed=True, k=k)
    path.M(segs[0][0])
    for s in segs: path.C(s[1], s[2], s[3])
    path.Z()

def ramp(pts, w, f0, f1, a=.1, b=.1, e=.12):
    """Taper widths, then lean them from f0 at the start to f1 at the end, like a nib changing pressure."""
    ws = widths(pts, w, a, b, e)
    n = len(ws) - 1
    return [max(e, x*(f0 + (f1-f0)*i/n)) for i, x in enumerate(ws)]

def dot(path, x, y, r):
    blob(path, arc(x, y, r, r*.9, 0, 300, 5))

def out(parts, eo=()):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="currentColor">' + "".join('<path d="%s"/>' % p.d for p in parts) + "".join('<path fill-rule="evenodd" d="%s"/>' % p.d for p in eo) + "</svg>\n"

BX, BY, BR = 45.5, 12, 6.4   # yarn ball

def line():
    p = Path()
    # crown: left side up, over the top, into the ball
    C = [(21.4, 18.4), (21.6, 14), (22.6, 10.4), (25, 8.6), (30, 8.1), (35, 8.5), (39.2, 8.2)]
    stroke(p, C, ws=ramp(C, 1.05, 1.15, .75, a=.06, b=.06))
    # hatband: one loaded stroke
    blob(p, [(21.2, 18), (25, 18.6), (31, 18.4), (36, 18.7), (41.4, 17.8), (42, 20), (41.6, 22.2), (31, 22.3), (20.4, 22.6)], k=.75)
    # brim: underside sweep heavy, top edge light
    B = [(3.4, 25.3), (12, 26.6), (28, 26.8), (46, 25), (60.6, 22.6)]
    stroke(p, B, ws=ramp(B, 1.3, 1.1, .8, a=.12, b=.14))
    stroke(p, [(4, 25.2), (11, 23.6), (24, 22.8), (42, 22.3), (60.2, 22.8)], .6, a=.15, b=.15)
    # yarn ball: contour, two wraps across, one short cap wrap
    stroke(p, arc(BX, BY, BR, BR, 125, 445, 9, wob=[0, .02, -.01, -.02, .01, .02, 0, -.02, 0]), .85, a=.1, b=.18)
    P = lambda a: (BX + BR*.93*math.cos(math.radians(a)), BY + BR*.93*math.sin(math.radians(a)))
    for a0, a1 in ((-50, 150), (-25, 128)):
        stroke(p, quad(P(a0), P(a1), .08, 4, side=-1), .42, a=.2, b=.2)
    stroke(p, arc(BX, BY, BR*.72, BR*.72, 5, 62, 3), .36, a=.3, b=.3)
    # needles
    stroke(p, [(49.8, 7.4), (55.4, 2.8)], .5, a=.05, b=.05, e=.42)
    dot(p, 56, 2.5, 1.25)
    stroke(p, [(51.8, 10.3), (59.4, 8.4)], .5, a=.05, b=.05, e=.42)
    dot(p, 60.2, 8.2, 1.25)
    # mask: forehead and upper beak, hooking down at the tip
    stroke(p, [(25, 28.4), (24.5, 31.2), (21.6, 34.2), (11.4, 40), (6.2, 44.8), (3.3, 49.8), (3.7, 53.2), (4.8, 54.2)], 1.05, a=.06, b=.1)
    # back of mask, then beak underside to the tip
    U = [(40.2, 28), (41.8, 32.6), (41, 38.2), (37.6, 42.2), (30, 44.2), (18, 46), (10.4, 48.6), (5.2, 51.6)]
    stroke(p, U, ws=ramp(U, 1.1, .85, 1.2, a=.06, b=.1))
    # beak seam and rivets
    stroke(p, [(23.2, 33.8), (25.8, 38.8), (26.4, 44)], .48, a=.25, b=.25)
    for x, y in ((19.4, 39.4), (14.4, 42.2), (9.8, 45.4)):
        dot(p, x, y, .62)
    # goggle and strap
    stroke(p, arc(31.5, 33.2, 3.7, 3.7, 150, 480, 7, wob=[0, .02, 0, -.02, .03, 0, -.02]), .72, a=.12, b=.2)
    dot(p, 31.4, 33.3, 1.5)
    # cowl: back sweep, front falling from under the beak, hem, two folds
    K = [(42.4, 26.7), (48, 27.8), (51.6, 31.6), (53, 40), (54.6, 49.6), (58.2, 60.6)]
    stroke(p, K, ws=ramp(K, 1.2, .7, 1.25, a=.08, b=.08))
    stroke(p, [(31, 43.4), (26.4, 48.6), (22.6, 54.6), (20.4, 60.8)], 1.1, a=.12, b=.08)
    stroke(p, [(18.6, 61.2), (38, 61.6), (59.6, 60.8)], .7, a=.12, b=.12)
    stroke(p, [(41, 44.6), (38.6, 51), (36.4, 58.8)], .42, a=.3, b=.35)
    stroke(p, [(47.8, 36), (48.6, 46.4), (47.6, 57)], .42, a=.35, b=.35)
    return out([p])

def small():
    p = Path()
    # crown, band, brim as filled shapes with drawn edges
    blob(p, [(21.3, 16.8), (21.7, 12), (22.6, 9.2), (25, 7.8), (31, 7.4), (37.2, 7.7), (36.8, 10.6), (37, 13.6), (38.4, 16.8), (30, 17)], k=.7)
    blob(p, [(20.8, 18.4), (31, 18.8), (38.6, 18.8), (41.8, 19.6), (42.2, 21), (41.8, 22.6), (31, 22.8), (20.4, 23)], k=.6)
    blob(p, [(3, 25.4), (12, 23.2), (30, 21.8), (48, 21.6), (61, 22.6), (52, 25.4), (34, 27.4), (14, 27.4)])
    # yarn ball filled, two wraps cut out of it (evenodd, own path)
    y = Path()
    blob(y, arc(BX, BY, BR+.2, BR+.2, 0, 330, 8, wob=[0, .02, -.02, .01, .03, -.01, .02, -.02]))
    P = lambda a: (BX + (BR+.5)*.82*math.cos(math.radians(a)), BY + (BR+.5)*.82*math.sin(math.radians(a)))
    stroke(y, quad(P(-58), P(150), .07, 4, side=-1), .55, a=.2, b=.2)
    stroke(y, quad(P(-18), P(118), .08, 4, side=-1), .5, a=.2, b=.2)
    # needles
    stroke(p, [(49.6, 7.6), (55.4, 2.8)], .95, a=.05, b=.05, e=.85)
    dot(p, 56, 2.6, 1.9)
    stroke(p, [(51.6, 10.4), (59.4, 8.4)], .95, a=.05, b=.05, e=.85)
    dot(p, 60, 8.2, 1.9)
    # mask and beak filled, hooked tip; goggle as a hole with its pupil
    blob(p, [(24.6, 28.2), (40.4, 27.6), (42.2, 32.6), (41.4, 38), (37.8, 42.4), (30, 44.2), (20, 45.8), (11, 48.6), (5, 52.4), (3.4, 54), (2.8, 50.2), (6.2, 44.6), (12, 39.8), (18, 36.2), (23, 33.4)], k=.9)
    hole(p, arc(31.5, 33.2, 4, 4, 0, 315, 8))
    dot(p, 31.4, 33.3, 1.9)
    # cowl filled, kept off the mask by a gap
    blob(p, [(43.8, 26.8), (48.4, 27.8), (51.8, 31), (53, 38), (54, 45.6), (56, 53), (58.6, 61), (39, 61.6), (20.2, 61.2), (22.4, 54.6), (25.6, 49.6), (29.6, 46.2), (39, 44.8), (43.2, 39.4), (44, 32.4)], k=.9)
    return out([p], [y])
