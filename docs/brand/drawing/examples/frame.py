# Drawn frame for buttons, chips and fields: a nine-slice tile (slice 12, viewBox 48x48), fill black
# because it is used as a CSS mask. frame(horizontal_half_width, vertical_half_width).
import math
from lib import Path, stroke, arc, _ss

# Nine-slice frame, viewBox 48, slice 12. Drawn as a quick box in two strokes:
#   1. top + right: pen down left of the top-left corner, turns the top-right corner, runs out below
#   2. left + bottom: lands above the top-left corner, turns the bottom-left corner, runs out right
# Points at 12/24/36 on every side are collinear, so the 12..36 runs are straight bands of
# constant width; all the character (tails, turns, pressure) lives inside the 12-unit corners.
A, B = 6.0, 42.0                       # line positions: top/left, bottom/right
MID = (12, 24, 36)

def widths(pts, hw_h, hw_v, la, lb, e0, e1):
    """Half-width per point: horizontal/vertical nib weight, smooth tapers over la/lb units."""
    L = [0.0]
    for i in range(1, len(pts)):
        L.append(L[-1] + math.dist(pts[i-1], pts[i]))
    out = []
    for i, p in enumerate(pts):
        q0, q1 = pts[max(i-1, 0)], pts[min(i+1, len(pts)-1)]
        dx, dy = q1[0]-q0[0], q1[1]-q0[1]; d = math.hypot(dx, dy) or 1
        w = hw_h*(dx/d)**2 + hw_v*(dy/d)**2
        f0 = e0 + (1-e0)*_ss(L[i]/la) if la else 1
        f1 = e1 + (1-e1)*_ss((L[-1]-L[i])/lb) if lb else 1
        out.append(w*min(f0, f1))
    return out

def turn(cx, cy, r, a0, a1, n):
    """Points of a quarter turn; both end points lie on the straight runs, so 12..36 stays exact."""
    return arc(cx, cy, r, r, a0, a1, n)

def tail(p0, c, p1, n):
    """Quadratic tail: leaves p0 toward c (along the line), ends at the pen lift p1."""
    return [((1-t)**2*p0[0] + 2*t*(1-t)*c[0] + t*t*p1[0], (1-t)**2*p0[1] + 2*t*(1-t)*c[1] + t*t*p1[1])
            for t in (i/(n-1) for i in range(n))]

def frame(hw_h, hw_v):
    p = Path()
    # stroke 1: top then right. Pen down just left of the left line, round turn at top-right,
    # runs out below the bottom line with an outward flick.
    s1 = (tail((1.4, 7.0), (3.4, 6.0), (7.0, 6.0), 4) + [(x, A) for x in MID] +
          turn(38.0, 10.0, 4.0, -90, 0, 6) + [(B, y) for y in MID] +
          tail((42.0, 39.0), (42.0, 44.2), (44.0, 47.6), 7))
    stroke(p, s1, ws=widths(s1, hw_h, hw_v, 2.8, 4.8, .42, .05))
    # stroke 2: left then bottom. Lands above the top line leaning in, round turn at bottom-left,
    # runs out past the right line lifting off upward.
    s2 = (tail((7.6, .4), (6.0, 3.0), (6.0, 7.0), 7) + [(A, y) for y in MID] +
          turn(10.3, 37.7, 4.3, 180, 90, 6) + [(x, B) for x in MID] +
          tail((39.0, 42.0), (44.0, 42.0), (47.7, 40.0), 7))
    stroke(p, s2, ws=widths(s2, hw_h, hw_v, 4.4, 4.8, .05, .05))
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">'
            '<path fill="black" d="%s"/></svg>\n' % p.d)
