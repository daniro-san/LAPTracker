"""Write a preview sheet for one hand-drawn SVG, beside the approved yarn vignette for comparison.

    python3 -I .claude/skills/hand-drawn-svg/preview.py <drawing.svg> <smallest-px> <out.html>

Rows: paper (light theme) and dark, each at 3x the smallest size, the smallest size itself and 2x;
the yarn ball (docs/brand/drawing) is drawn at the same widths. Colours are the DESIGN.md light and
dark paper/plum values, so what you see is what the page will show.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path[:0] = [os.path.join(REPO, "docs", "brand", "drawing"), os.path.join(REPO, "docs", "brand", "drawing", "examples")]

import objects  # noqa: E402

THEMES = (("paper", "#efe6d3", "#3b2436"), ("dark", "#1a1418", "#b48ba6"))


def sized(svg, width):
    return svg.replace("<svg ", '<svg style="width:%dpx;height:auto;display:block" ' % width, 1)


def main():
    drawing_path, smallest, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    drawing = open(drawing_path).read()
    yarn = objects.yarn()
    widths = (smallest * 3, smallest * 2, smallest)
    rows = []
    for name, bg, ink in THEMES:
        cells = "".join('<div class="cell">%s<span>%d px</span></div>' % (sized(drawing, w), w) for w in widths)
        ref = "".join('<div class="cell">%s<span>yarn %d px</span></div>' % (sized(yarn, w), w) for w in widths[:2])
        rows.append('<section style="background:%s;color:%s"><h2>%s</h2><div class="row">%s%s</div></section>' % (bg, ink, name, cells, ref))
    css = (
        "body{margin:0;font:13px sans-serif}section{padding:16px 20px}h2{margin:0 0 8px;font-size:13px;opacity:.7}"
        ".row{display:flex;align-items:flex-end;gap:28px;flex-wrap:wrap}.cell{display:flex;flex-direction:column;gap:4px;align-items:center}"
        "span{opacity:.6}"
    )
    with open(out, "w") as fh:
        fh.write('<!doctype html><meta charset="utf-8"><style>%s</style>%s' % (css, "".join(rows)))
    print(out)


if __name__ == "__main__":
    main()
