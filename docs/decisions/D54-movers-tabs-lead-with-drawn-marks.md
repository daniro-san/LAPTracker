## D54 — Movers tabs lead with drawn marks (2026-11-06, owner, 08zzf, issue #70)

Amends DESIGN.md's language-light rule "no icons that need a culture to read (no skull for kills)" for one place. With the Rank tab the Movers card has four tabs, and at 360 px the game's words wrapped to a second line in ru and de. The owner asked for icons instead.

- **Marks.** A boxing glove for Might, a skull for Kills, a trophy for Rank: the brand's 16 px filled cut (`icon_might`, `icon_kills`, `icon_rank` in `docs/brand/drawing/examples/ornaments.py`; `lib/brand/components/MoverMarks.tsx`). A flexed arm was tried first and read as a sock at 16 px.
- **The word stays.** Below 640 px a tab shows its mark and arrow, with the word as screen-reader text; the open tab's `WORD ▲` heads its panel, so the word is one tap away. From 640 px the word shows beside the mark. Section headings, legend and every other label keep the game's word.
- **Only here.** Every other place still follows the no-culture-icon rule.
