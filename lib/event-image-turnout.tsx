// The End picture's turnout block (#276): the alliances with the most members who gained kills, each a
// bar and its figure, then the highest top 5's share of kills. Alliance tags and numbers only.
import { KillsMark } from "./brand/components/MoverMarks";
import { copy } from "./copy";
import { shareText } from "./discord-format";
import { Colors, label, ROW, Section, SECTION, u } from "./event-image-parts";
import type { AllianceTurnout, TurnoutLists } from "./queries";

/** The bars: the first alliances by members with kills gained. */
const TURNOUT_ROWS = 4;

/** One row: the tag, a bar of the share on a track, and the figure as text: `54 % · 54/100`. */
function TurnoutRow({ c, t }: { c: Colors; t: AllianceTurnout }) {
  const { tag, name } = label(t);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: u(8),
        height: u(ROW),
        fontFamily: "Source Sans 3",
        fontSize: u(19),
        color: c.ink,
        borderBottom: `${u(1)}px solid ${c.rule}`,
      }}
    >
      <span
        style={{
          width: u(50),
          flexShrink: 0,
          fontWeight: 600,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {tag || name}
      </span>
      <div style={{ display: "flex", flex: 1, height: u(14), background: c.rule }}>
        <div style={{ width: `${(t.gainers / t.n) * 100}%`, height: "100%", background: c.yarn }} />
      </div>
      <span
        style={{ width: u(138), justifyContent: "flex-end", flexShrink: 0, whiteSpace: "nowrap" }}
      >
        {`${shareText(t.gainers, t.n)} · ${t.gainers}/${t.n}`}
      </span>
    </div>
  );
}

/** The section's elements and the height they take. */
export function turnoutBlock(lists: TurnoutLists, c: Colors) {
  const t = copy.discord.image;
  const top = lists.withKills.slice(0, TURNOUT_ROWS);
  const parts = [
    <Section key="t" c={c} icon={KillsMark({})} color={c.yarn} text={t.turnout} />,
    ...top.map((a) => <TurnoutRow key={`t${a.unionId}`} c={c} t={a} />),
  ];
  let height = SECTION + top.length * ROW;
  const lead = lists.topShare[0];
  if (lead) {
    const { tag, name } = label(lead);
    parts.push(
      <div
        key="s"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: u(ROW),
          fontFamily: "Source Sans 3",
          fontSize: u(17),
          color: c.ink,
        }}
      >
        <span>{t.topShare}</span>
        <span style={{ fontWeight: 600 }}>
          {`${tag || name} ${shareText(lead.top, lead.gained)}`}
        </span>
      </div>,
    );
    height += ROW;
  }
  return { parts, height };
}
