# Discord webhook avatars, viewBox 100x100: the Granny Doctor's bust inside a centred circle of
# diameter 80 (Discord crops avatars round). scout(): leaning into a spyglass, scarf in the wind,
# for "KvK Scout"; admin(): chin up under a heavy lid, quill in the band, wax seal of office on a
# cord, for "LAP Tracker Admin". Everything is placed in granny.head()'s
# own coordinates and moved into the circle by A, so the props scale with the head.
import math
import lib
from lib import *
import granny
import mark

K, DEG, OX, OY, TX, TY = .62, 0, 84, 56, 50, 42   # scale, tilt, pivot in head units, where the pivot lands


class A(Path):
    """Path whose points are rotated by DEG and scaled by K about (OX, OY), then moved to (TX, TY)."""
    def _r(self, p):
        c, s = math.cos(math.radians(DEG)), math.sin(math.radians(DEG))
        x, y = p[0] - OX, p[1] - OY
        return (round(TX + K * (x * c - y * s), 1), round(TY + K * (x * s + y * c), 1))


def out(parts):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="currentColor">' + "".join(parts) + "</svg>\n"


G = 1.4   # nib gain: Discord shows these at 40 px, far below the vignettes' 96 px


def bust(skip=(), deg=0):
    """Head tilted by deg (beak up when positive), needles and the shawl's back sweep.
    Returns (path, pen S, leaf F, needle markup)."""
    global DEG
    DEG = deg
    lib.GAIN = G
    p = A()
    granny.head(p, skip=skip)
    q = A()
    for a, b in (((108.5, 33.5), (121.5, 17.5)), ((110.5, 35.5), (127.5, 25.5))):
        q.M(a); q.L(b)
    S = lambda pts, w, a=.2, b=.2, e=.12, k=1.0: stroke(p, pts, w, a, b, e, k=k)
    F = lambda a, c, b, w=.45: granny.leaf(p, a, c, b, w)
    # shawl: from the nape over the hunched shoulder, down to the circle
    S([(97, 80), (113, 86), (123, 101), (128, 118), (129, 128)], 1.3, .12, .25)
    for x, y in ((120, 96), (125.5, 108)):
        F((x - 5, y + 1), (x - 2, y + 4.5), (x - 1, y + 9), .4)
    return p, S, F, granny.line(q.d, 1.1 * K * G)


def done(parts):
    lib.GAIN = 1.0
    return out(parts)


def scout():
    # eager: leaning in, pupil wide and pressed to the glass, scarf tail in the wind
    p, S, F, nd = bust(skip=("brim", "beak", "brow", "pupil"), deg=8)
    blob(p, arc(78.4, 68, 2.3, 2.3, 0, 288, 5))
    # scarf knotted at the nape, two tails whipping back in the wind, wind marks trailing
    # (solid tails in their own path, so they do not cut holes where they cross the shawl)
    tl = A()
    granny.leaf(tl, (95, 83), (117, 71), (139, 63), 2.6)
    granny.leaf(tl, (97, 87), (120, 82), (141, 77), 2.0)
    for x, y, L in ((128, 89, 10), (134, 94, 7)):
        F((x, y), (x + L / 2, y - .8), (x + L, y - .6), .35)
    # spyglass raised from the goggle toward the horizon: eyepiece, draw tube, objective, lip
    a = math.radians(25)
    d, n = (-math.cos(a), -math.sin(a)), (math.sin(a), -math.cos(a))
    P = lambda t, s: (76.5 + d[0] * t + n[0] * s, 65 + d[1] * t + n[1] * s)
    for t0, t1, h in ((0, 8, 2.8), (8.5, 22, 3.6), (22.5, 38, 4.6)):
        for s in (h, -h):
            S([P(t0, s), P((t0 + t1) / 2, s * 1.04), P(t1, s)], 1.05, .1, .1)
    # brass bands at the eyepiece and the two joints
    for t, h in ((0, 2.8), (8.25, 3.6), (22.25, 4.6)):
        F(P(t, h + .7), P(t, 0), P(t, -h - .7), .8)
    S([P(38.5 + 1.8 * math.cos(math.radians(u)), 4.8 * math.sin(math.radians(u))) for u in range(95, 456, 60)], .95, .08, .08)
    # glint off the objective: something spotted
    gx, gy = P(49, 10)
    for u, L in ((20, 11), (110, 7.5), (200, 11), (290, 7.5)):
        c, s_ = math.cos(math.radians(u)), math.sin(math.radians(u))
        F((gx + c * 1.5, gy + s_ * 1.5), (gx + c * L * .55, gy + s_ * L * .55), (gx + c * L, gy + s_ * L), 1.0)
    # brim, lifted where the tube crosses it: back sweep, front curl, underside
    S([(138, 48), (100, 44.5), (70, 46.5), (58, 48.5), (52.5, 50.2)], 1.4, .06, .1)
    S([(44, 53), (32, 57), (38, 60), (46, 60)], 1.3, .25, .5)
    S([(67, 57.5), (75, 56.8), (84, 56)], .9, .3, .3)
    # beak below the tube: ridge from the tube's edge to the hooked tip, back along the jaw, rivets
    S([(65, 62.9), (55, 65.5), (40, 78), (36.5, 86), (47, 82), (65, 80), (80, 88)], 1.3, .1, .3, k=.9)
    for x, y in ((55.5, 69.5), (49, 74)):
        granny.dot(p, x, y, .9)
    # front of the shawl, falling from under the jaw
    S([(81, 91), (77, 103), (75.5, 115), (76, 124)], 1.2, .15, .3)
    return done([el(p), el(tl), nd])


def admin():
    # unimpressed: chin up, looking down the beak under a heavy lid and a frown
    p, S, F, nd = bust(skip=("brow", "pupil"), deg=11)
    F((71, 66.5), (78.5, 59.5), (90, 61), 1.2)
    blob(p, arc(80.2, 70.4, 1.5, 1.5, 0, 288, 5))
    # the lid and the quill overlap other strokes, so they get a path of their own (no winding holes)
    z = A()
    blob(z, arc(81, 68, 4.6, 4.6, 185, 355, 6) + [(85.4, 68.4), (81, 67.6), (76.6, 68.4)])
    # clerk's quill tucked in the hat band: vane, then the shaft down its spine into the band
    granny.leaf(z, (71, 39), (52, 27), (46, 8), 4.2)
    stroke(z, [(74, 47), (65, 36), (55, 24), (48, 12)], .6, .1, .2)
    # front of the shawl, falling from under the jaw, lifted behind the seal
    S([(81, 91), (79.5, 96.5), (78.5, 101)], 1.2, .15, .4)
    # the seal of office on a cord from the nape: lumpy wax with a drip, the pressed ring cut out
    S([(95, 82.5), (88, 94), (78.5, 102)], .6, .2, .15)
    F((92.5, 84), (85, 92.5), (75.5, 101), .3)
    w = A()
    cx, cy, R = 72, 112, 10
    E = [(u, R * (1 + .045 * math.sin(math.radians(u) * 5 + 1))) for u in range(-90, 270, 24)]
    E[6:7] = [(48, R * 1.04), (56, R * 1.32), (64, R * 1.04)]
    blob(w, [(cx + q * math.cos(math.radians(u)), cy + q * math.sin(math.radians(u))) for u, q in E])
    stroke(w, arc(cx, cy, R * .74, R * .72, -70, 255, 10), .42, .08, .12, .25)
    return done([el(p), el(z), el(w, ' fill-rule="evenodd"'), nd])
