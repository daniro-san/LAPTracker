# The Granny Doctor: standing() 160x200, tea() 160x120. Both poses share head().
import math
from lib import *
from lib import _nums, _fmt

def svgv(parts, h):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 %d" fill="currentColor">' % h + "".join(parts) + "</svg>\n"

def leaf(p, a, c, b, w):
    """Pointed-both-ends nib mark: centreline is the quadratic a-c-b, half-width w at the middle."""
    dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy) or 1
    nx, ny = -dy/L*2*w, dx/L*2*w
    u, v = (c[0]+nx, c[1]+ny), (c[0]-nx, c[1]-ny)
    if (u[0]-v[0])*dy - (u[1]-v[1])*dx > 0: u, v = v, u
    p.M(a)
    for q, e in ((u, b), (v, a)):
        q, e = p._r(q), p._r(e)
        p.d += "q" + _nums([q[0]-p.cx, q[1]-p.cy, e[0]-p.cx, e[1]-p.cy]); p.cx, p.cy = e
    p.d += "z"; p.cx, p.cy = p.sx, p.sy

def dot(p, x, y, r):
    leaf(p, (x-r, y+r*.3), (x, y), (x+r, y-r*.3), r*.62)

def line(d, w):
    return '<path fill="none" stroke="currentColor" stroke-width="%s" stroke-linecap="round" d="%s"/>' % (_fmt(w), d)

def head(p, T=None):
    """Hat, lace, beak mask, goggle; drawn into p (which may carry a scale T). Returns the needle d string."""
    S = lambda pts, w, a=.2, b=.2, e=.12, k=1.0: stroke(p, pts, w, a, b, e, k=k)
    F = lambda a, c, b, w=.45: leaf(p, a, c, b, w)
    # hat: crown, dent, band, one brim swoop that curls under at the front
    S([(65, 47), (67, 29), (84, 19.5), (101, 27), (104, 46)], 1.3, .1, .1)
    F((77, 22.5), (84, 27), (91, 22.5), .5)
    F((65.5, 41.5), (85, 45), (103.5, 40.5), .75)
    S([(138, 48), (100, 44.5), (58, 48.5), (30, 57.5), (40, 60.5), (84, 56)], 1.4, .06, .3)
    # yarn ball in the band
    S(arc(106, 37, 6, 6, 200, 500, 5), .8, .1, .15)
    F((101, 34), (107, 36), (110, 42), .4)
    # lace bonnet edge: scallops down the back of the head
    for i in range(3):
        y = 58 + i * 7.2
        F((99 - i * .8, y), (106 - i * 1.2, y + 3.6), (98.2 - i * 1.6, y + 7.2), .5)
    # beak (upper ridge to the hooked tip, back along the jaw) + rivets
    S([(75, 60), (55, 65.5), (40, 78), (36.5, 86), (47, 82), (65, 80), (80, 88)], 1.3, .08, .3, k=.9)
    for x, y in ((63, 66.5), (55.5, 69.5), (49, 74)):
        dot(p, x, y, .9)
    # goggle eye, stern brow, pupil
    S(arc(81, 68, 5, 5, 140, 490, 6), 1.0, .05, .05, .5)
    F((72.5, 62), (80, 59), (88.5, 63.5), .85)
    blob(p, arc(79.8, 68.6, 1.5, 1.5, 0, 288, 5))
    for x, y in ((121.5, 17.5), (127.5, 25.5)):
        dot(p, x, y, 1.7)
    q = Path(T)
    for a, b in (((108.5, 33.5), (121.5, 17.5)), ((110.5, 35.5), (127.5, 25.5))):
        q.M(a); q.L(b)
    return q.d

def standing():
    p = Path()
    S = lambda pts, w, a=.2, b=.2, e=.12, k=1.0: stroke(p, pts, w, a, b, e, k=k)
    F = lambda a, c, b, w=.45: leaf(p, a, c, b, w)
    nd = head(p)
    # shawl: one sweep from the nape over the hunched shoulder to the back point and forward along the hem
    S([(96, 80), (114, 85), (122, 100), (122.5, 118), (119.5, 131), (100, 122), (81, 115)], 1.3, .12, .12, k=.85)
    F((80, 89), (75, 103), (81, 115), 1.0)
    for x, y in ((117.5, 129.8), (112, 127.2), (106, 124.6), (100, 122.2)):
        F((x, y), (x - .2, y + 4), (x - 1.4, y + 8), .42)
    # front arm to the cane, gloved hand
    F((79, 101), (70, 104), (60, 107), .75)
    F((81, 112), (70, 113.5), (60, 114), .75)
    blob(p, [(55.5, 109), (59.5, 105), (62.5, 110), (58.5, 115)])
    # skirt: front, back, hem, one fold, hatching on the back
    S([(82, 116), (69, 150), (60, 184)], 1.2, .1, .05)
    S([(120.5, 131), (121, 152), (124.5, 171), (132, 185)], 1.2, .05, .05)
    S([(58, 184), (78, 187.5), (106, 185), (133, 185.5)], 1.25, .1, .1)
    F((97, 132), (93, 158), (95, 182), .55)
    for y in (160,):
        F((116, y + 2), (118, y), (120, y - 3), .4)
    # shoe toe and floor
    F((66, 187.3), (52, 186.5), (60, 190.5), 1.0)
    F((28, 192.2), (70, 191), (104, 192.2), .6)
    # back forearm, gloved hand, knitting pouch with needles
    F((120, 117), (126, 120), (132, 123), .7)
    blob(p, [(130, 123), (134, 119.5), (137, 124), (133, 128)])
    S([(130, 141), (131.5, 128), (139, 127), (147, 141)], .65, .2, .2)
    S([(129, 141), (125.5, 153), (132, 164), (146, 164.5), (152.5, 153), (149, 141)], 1.15, .1, .1)
    F((128, 141.5), (139, 138), (150, 141.5), .7)
    for x, y in ((152.5, 120), (157, 127.5)):
        dot(p, x, y, 1.7)
    d = "M143 142L152.5 120M146.5 143L157 127.5" + nd
    return svgv([el(p), line(d, 1.1), line("M62.5 113C63.5 101 51 99 51.5 110C50 135 46 165 42.5 188", 1.7)], 200)

def tea():
    T = (.85, 137, -70.5)
    h = Path(T)
    nd = head(h, T)
    p = Path()
    S = lambda pts, w, a=.2, b=.2, e=.12, k=1.0: stroke(p, pts, w, a, b, e, k=k)
    F = lambda a, c, b, w=.45: leaf(p, a, c, b, w)
    # shawl over the hunched shoulder, cropped by the frame
    S([(102, 57.5), (121, 62.5), (133, 77), (138, 98), (140, 120)], 1.15, .12, 0)
    F((88.5, 65), (82.5, 79), (85, 92), .9)
    F((87.5, 103), (87, 112), (90, 120), .8)
    for x, y in ((126.5, 80), (130, 91), (132.5, 102)):
        F((x - 5, y + 1), (x - 2, y + 4.5), (x - 1, y + 9), .4)
    # forearm and gloved hand under the saucer
    F((84.5, 91), (66, 91), (49, 94), .7)
    F((87.5, 103), (68, 101.5), (50, 100.5), .7)
    blob(p, [(42, 96.5), (48, 93.5), (52, 98), (47, 101.5)])
    # saucer, cup, handle
    S(arc(38, 94.5, 15, 3, 250, -70, 7), .9, .08, .08)
    S([(28.5, 81), (30, 88), (38, 92.5), (46, 88), (47.5, 81)], 1.05, .1, .1)
    S(arc(38, 81, 9.5, 2.3, 0, 180, 5), .55, .15, .15)
    F((28.5, 81), (38, 76.5), (47.5, 81), .4)
    S([(47, 83), (51.5, 82.5), (51, 87), (45.5, 89.5)], .7, .15, .2)
    # steam rising past the beak
    S([(34, 77), (31, 69.5), (36, 62), (33, 54)], .5, .35, .45)
    S([(40.5, 76), (43.5, 67), (38.5, 58), (42, 49), (47, 46)], .62, .3, .35)
    return svg([el(h), el(p), line(nd, 1.1 * .85)])

def ledger():
    """Loading vignette for the player search: bent over the open ledger, magnifier in hand.
    The magnifier (the data-anim path) tilts about the grip at (70, 101) so the lens runs down the rows."""
    T = (.85, 137, -70.5)
    h = Path(T)
    nd = head(h, T)
    p = Path()
    S = lambda pts, w, a=.2, b=.2, e=.12, k=1.0: stroke(p, pts, w, a, b, e, k=k)
    F = lambda a, c, b, w=.45: leaf(p, a, c, b, w)
    # shawl over the hunched shoulder, cropped by the frame
    S([(102, 57.5), (121, 62.5), (133, 77), (138, 98), (140, 120)], 1.15, .12, 0)
    F((88.5, 65), (84, 80), (88, 94), .9)
    F((89, 106), (88.5, 113), (91, 120), .8)
    # forearm to the grip
    F((88, 94), (80, 95.5), (72.5, 97.5), .85)
    F((89, 106), (80, 105.5), (72.5, 104), .85)
    # open ledger: page tops curling to the spine, side and front edges, spine, rows
    S([(10, 91), (25, 88), (41, 91.5), (57, 88), (72, 91)], 1.1, .08, .08)
    S([(10, 91), (6.5, 102), (3, 113)], 1.0, .1, .1)
    S([(72, 91), (75.5, 102), (79, 113)], 1.0, .1, .1)
    S([(3, 113), (22, 110.5), (41, 115), (60, 110.5), (79, 113)], 1.25, .08, .08)
    F((41, 92.5), (41.8, 104), (41.5, 114), .5)
    for i, y in enumerate((98, 104)):
        F((10 - i * 2, y), (24, y - 1.2), (37, y + .6), .32)
        F((46, y + .6), (59, y - 1.2), (72 + i * 2, y), .32)
    q = Path()
    # magnifier: lens rim, glint, handle, gloved hand round the grip
    ring(q, arc(36, 88, 10.5, 10, 0, 324, 10, wob=[0, .02, -.01, .015, 0, -.02, .01, 0, .02, -.01]), .8)
    leaf(q, (29.5, 87), (30.5, 82.5), (35, 80.5), .45)
    stroke(q, [(45.5, 93), (57, 97), (68, 100.5)], 1.5, .05, .1, .9)
    blob(q, [(63.5, 97.5), (69, 96), (73.5, 97.5), (74, 102.5), (69.5, 104.5), (64.5, 102)])
    leaf(q, (61, 99.5), (64, 96.5), (68, 96.5), .5)
    return svg([el(h), el(p), el(q, ' data-anim="scan"'), line(nd, 1.1 * .85)])
