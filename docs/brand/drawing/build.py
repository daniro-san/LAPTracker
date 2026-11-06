"""Regenerate every hand-drawn SVG of the brand into one folder (method: ../DRAWING.md).

    python3 -I docs/brand/drawing/build.py <out-dir>

Each drawing is a Python function in examples/ that places centreline points by hand; lib.py turns
them into tapered, filled strokes. Standard library only. The output is plain SVG: one colour
(currentColor; black for the frame, which CSS uses as a mask), no ids. The shipped markup lives in
lib/brand/components/ and public/brand/; this script reproduces it byte for byte.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.join(HERE, "examples")]

import discord  # noqa: E402
import frame  # noqa: E402
import granny  # noqa: E402
import mark  # noqa: E402
import objects  # noqa: E402
import ornaments  # noqa: E402

# Frame weight as shipped: W for buttons and fields, W * K for chips (the "soft" frame).
W, K = 1.4, 0.72

DRAWINGS = {
    "yarn": objects.yarn,
    "bottle": objects.bottle,
    "tea": objects.tea,
    "mark-line": mark.line,
    "mark-small": mark.small,
    "seal": ornaments.seal,
    "yarn-corner": ornaments.yarn_corner,
    "lace": ornaments.lace,
    "lace-alt-dot": ornaments.lace_b,
    "icon-running": ornaments.icon_running,
    "icon-crown": ornaments.icon_crown,
    "icon-officer": ornaments.icon_officer,
    "icon-diplomat": ornaments.icon_diplomat,
    "icon-recruiter": ornaments.icon_recruiter,
    "icon-militarist": ornaments.icon_militarist,
    "icon-overseer": ornaments.icon_overseer,
    "icon-might": ornaments.icon_might,
    "icon-kills": ornaments.icon_kills,
    "icon-rank": ornaments.icon_rank,
    "icon-look": ornaments.icon_look,
    "icon-live": ornaments.icon_live,
    "icon-done": ornaments.icon_done,
    "icon-partial": ornaments.icon_partial,
    "no-photo": ornaments.no_photo,
    "no-badge": ornaments.no_badge,
    "granny-standing": granny.standing,
    "granny-tea": granny.tea,
    "granny-ledger": granny.ledger,
    "granny-empty": granny.empty,
    "discord-scout": discord.scout,
    "discord-admin": discord.admin,
    "frame": lambda: frame.frame(W * 0.9, W * 1.08),
    "frame-soft": lambda: frame.frame(W * K * 0.9, W * K * 1.08),
}

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, draw in DRAWINGS.items():
        with open(os.path.join(out, name + ".svg"), "w") as fh:
            fh.write(draw())
        print(name)
