import math

def _fmt(v):
    v = round(v, 1)
    if v == 0:
        return "0"
    s = ("%.1f" % v).rstrip("0").rstrip(".")
    if s.startswith("0."):
        s = s[1:]
    elif s.startswith("-0."):
        s = "-" + s[2:]
    return s

def _nums(vals):
    out = ""
    prev = None
    for v in vals:
        s = _fmt(v)
        if prev is None or s.startswith("-") or (s.startswith(".") and "." in prev):
            out += s
        else:
            out += " " + s
        prev = s
    return out

class Path:
    """Builds a compact path string from absolute commands, emitted relative."""
    def __init__(self, T=None):
        self.T = T  # (scale, ox, oy)
        self.d = ""
        self.cx = self.cy = 0.0
        self.sx = self.sy = 0.0

    def _r(self, p):
        if self.T:
            k, ox, oy = self.T
            p = (ox + (p[0]-ox)*k, oy + (p[1]-oy)*k)
        return (round(p[0], 1), round(p[1], 1))

    def M(self, p):
        p = self._r(p)
        if self.d == "":
            self.d += "M" + _nums([p[0], p[1]])
        else:
            self.d += "m" + _nums([p[0] - self.cx, p[1] - self.cy])
        self.cx, self.cy = p
        self.sx, self.sy = p

    def C(self, c1, c2, p):
        c1, c2, p = self._r(c1), self._r(c2), self._r(p)
        self.d += "c" + _nums([c1[0]-self.cx, c1[1]-self.cy, c2[0]-self.cx, c2[1]-self.cy, p[0]-self.cx, p[1]-self.cy])
        self.cx, self.cy = p

    def L(self, p):
        p = self._r(p)
        self.d += "l" + _nums([p[0]-self.cx, p[1]-self.cy])
        self.cx, self.cy = p

    def Z(self):
        self.d += "z"
        self.cx, self.cy = self.sx, self.sy


def catmull(pts, closed=False, k=1.0):
    n = len(pts)
    segs = []
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        if closed:
            p0, p1, p2, p3 = pts[(i-1) % n], pts[i], pts[(i+1) % n], pts[(i+2) % n]
        else:
            p0 = pts[max(i-1, 0)]; p1 = pts[i]; p2 = pts[i+1]; p3 = pts[min(i+2, n-1)]
        c1 = (p1[0] + (p2[0]-p0[0])/6*k, p1[1] + (p2[1]-p0[1])/6*k)
        c2 = (p2[0] - (p3[0]-p1[0])/6*k, p2[1] - (p3[1]-p1[1])/6*k)
        segs.append((p1, c1, c2, p2))
    return segs

def _ss(x):
    x = max(0.0, min(1.0, x))
    return x*x*(3-2*x)

def widths(pts, w, a=0.3, b=0.3, e=0.12, p=1.0):
    """Half-widths per point: rises over first a of length, falls over last b."""
    L = [0.0]
    for i in range(1, len(pts)):
        L.append(L[-1] + math.dist(pts[i-1], pts[i]))
    T = L[-1] or 1
    out = []
    for li in L:
        u = li / T
        f = 1.0
        if a > 0: f *= _ss(u / a) ** p
        if b > 0: f *= _ss((1-u) / b) ** p
        out.append(max(e, w * f))
    return out

def stroke(path, pts, w=1.0, a=0.3, b=0.3, e=0.12, ws=None, k=1.0):
    """Tapered filled stroke along a Catmull-Rom centreline."""
    n = len(pts)
    ws = ws or widths(pts, w, a, b, e)
    segs = catmull(pts, k=k)
    nrm = []
    for i in range(n):
        if i == 0:
            t = (segs[0][1][0]-pts[0][0], segs[0][1][1]-pts[0][1])
            if abs(t[0]) + abs(t[1]) < 1e-6: t = (pts[1][0]-pts[0][0], pts[1][1]-pts[0][1])
        elif i == n-1:
            t = (pts[-1][0]-segs[-1][2][0], pts[-1][1]-segs[-1][2][1])
            if abs(t[0]) + abs(t[1]) < 1e-6: t = (pts[-1][0]-pts[-2][0], pts[-1][1]-pts[-2][1])
        else:
            t = (pts[i+1][0]-pts[i-1][0], pts[i+1][1]-pts[i-1][1])
        l = math.hypot(*t) or 1
        nrm.append((-t[1]/l, t[0]/l))
    def off(p, i, s):
        return (p[0] + s*nrm[i][0]*ws[i], p[1] + s*nrm[i][1]*ws[i])
    left = [(off(s[0], i, 1), off(s[1], i, 1), off(s[2], i+1, 1), off(s[3], i+1, 1)) for i, s in enumerate(segs)]
    right = [(off(s[3], i+1, -1), off(s[2], i+1, -1), off(s[1], i, -1), off(s[0], i, -1)) for i, s in reversed(list(enumerate(segs)))]
    # orientation: keep all outlines counter-clockwise in screen coords so nonzero unions
    poly = [s[0] for s in left] + [left[-1][3]] + [s[0] for s in right] + [right[-1][3]]
    area = sum(poly[i][0]*poly[(i+1) % len(poly)][1] - poly[(i+1) % len(poly)][0]*poly[i][1] for i in range(len(poly)))
    if area < 0:
        left, right = [(s[3], s[2], s[1], s[0]) for s in reversed(right)], [(s[3], s[2], s[1], s[0]) for s in reversed(left)]
    path.M(left[0][0])
    for s in left: path.C(s[1], s[2], s[3])
    path.L(right[0][0])
    for s in right: path.C(s[1], s[2], s[3])
    path.Z()

def blob(path, pts, k=1.0):
    """Closed filled shape through points (counter-clockwise enforced)."""
    area = sum(pts[i][0]*pts[(i+1) % len(pts)][1] - pts[(i+1) % len(pts)][0]*pts[i][1] for i in range(len(pts)))
    if area < 0: pts = list(reversed(pts))
    segs = catmull(pts, closed=True, k=k)
    path.M(segs[0][0])
    for s in segs: path.C(s[1], s[2], s[3])
    path.Z()

def ring(path, pts, w, k=1.0):
    """Closed outline of even width: outer blob plus reversed inner (hole)."""
    cx = sum(p[0] for p in pts)/len(pts); cy = sum(p[1] for p in pts)/len(pts)
    def scale(s):
        out = []
        for p in pts:
            dx, dy = p[0]-cx, p[1]-cy; l = math.hypot(dx, dy) or 1
            out.append((p[0]+dx/l*s, p[1]+dy/l*s))
        return out
    blob(path, scale(w))
    inner = scale(-w)
    area = sum(inner[i][0]*inner[(i+1) % len(inner)][1] - inner[(i+1) % len(inner)][0]*inner[i][1] for i in range(len(inner)))
    if area > 0: inner = list(reversed(inner))
    segs = catmull(inner, closed=True, k=k)
    path.M(segs[0][0])
    for s in segs: path.C(s[1], s[2], s[3])
    path.Z()

def arc(cx, cy, rx, ry, a0, a1, n, rot=0.0, wob=None):
    pts = []
    cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    for i in range(n):
        a = math.radians(a0 + (a1-a0)*i/(n-1))
        f = 1 + (wob[i] if wob else 0)
        x, y = rx*f*math.cos(a), ry*f*math.sin(a)
        pts.append((cx + x*cr - y*sr, cy + x*sr + y*cr))
    return pts

def svg(parts):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" fill="currentColor">' + "".join(parts) + "</svg>\n"

def el(path, extra=""):
    return '<path%s d="%s"/>' % (extra, path.d)

def rot(pts, ox, oy, deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return [(ox + (x-ox)*c - (y-oy)*s, oy + (x-ox)*s + (y-oy)*c) for x, y in pts]

def quad(p0, p1, bow, n=5, side=1):
    """Bowed strand from p0 to p1: bow is fraction of chord, side picks the normal."""
    mx, my = (p0[0]+p1[0])/2, (p0[1]+p1[1])/2
    dx, dy = p1[0]-p0[0], p1[1]-p0[1]; L = math.hypot(dx, dy)
    c = (mx - dy/L*bow*L*side*2, my + dx/L*bow*L*side*2)
    out = []
    for i in range(n):
        t = i/(n-1)
        out.append(((1-t)**2*p0[0] + 2*t*(1-t)*c[0] + t*t*p1[0], (1-t)**2*p0[1] + 2*t*(1-t)*c[1] + t*t*p1[1]))
    return out
