// The End picture's KvK block (D152, issue 306): the opponent's server, how many alliances each side counts,
// then each side's might change and kills gained from Start to End. Server numbers and sums only.
import { MightMark } from "./brand/components/MoverMarks";
import { copy } from "./copy";
import { compact, signedCompact } from "./discord-format";
import { Colors, ROW, Section, SECTION, u } from "./event-image-parts";
import { fill } from "./words";

/** One side's Start to End, as the matchup counts it. */
interface Sums {
  counted: number;
  might: number;
  kills: number;
}

export interface KvkLine {
  server: number;
  us: Sums;
  them: Sums;
}

function FigureRow({ c, label, value }: { c: Colors; label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: u(ROW),
        fontFamily: "Source Sans 3",
        fontSize: u(19),
        color: c.ink,
        borderBottom: `${u(1)}px solid ${c.rule}`,
      }}
    >
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** The block's elements and the height they take; none when either side counts no alliance. */
export function kvkBlock(k: KvkLine | null | undefined, c: Colors) {
  if (!k || k.us.counted === 0 || k.them.counted === 0) return { parts: [], height: 0 };
  const t = copy.discord.image;
  const sides = (us: string, them: string) => fill(t.kvkSides, { us, them });
  const parts = [
    <Section
      key="k"
      c={c}
      icon={MightMark({})}
      color={c.plum}
      text={fill(t.kvk, { server: k.server, a: k.us.counted, b: k.them.counted })}
    />,
    <FigureRow
      key="km"
      c={c}
      label={t.kvkMight}
      value={sides(signedCompact(k.us.might), signedCompact(k.them.might))}
    />,
    <FigureRow
      key="kk"
      c={c}
      label={t.kvkKills}
      value={sides(`+${compact(k.us.kills)}`, `+${compact(k.them.kills)}`)}
    />,
  ];
  return { parts, height: SECTION + 2 * ROW };
}
