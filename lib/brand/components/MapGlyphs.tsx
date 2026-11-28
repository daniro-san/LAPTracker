// The officers' KvK map's drawings (issue 817), from docs/brand/drawing (`map-house`, `map-castle`,
// `map-bubble`, `map-no-reading` in examples/ornaments.py): a member's house, the castle, the ring of a shield
// seen and the dashed ring of no reading. Each is a 16-unit cut placed as a <g> inside the map's own SVG at
// (cx, cy) and `size` plot units wide; colour is the token class the map sets (currentColor).
const HOUSE =
  "M.9 8.1c.1-.2 3.3-3.1 3.7-3.5c.4-.4 3-3.3 3.4-3.3c.4 0 3.3 3 3.5 3.1c.2.1-.2-1.8-.1-1.9c.1-.1 1.6-.3 1.7-.1c.1.2 0 3.3.1 3.6c.1.3 1.9 1.9 1.9 2c0 .1-1.6.4-2 .4c-.4 0-4.5-.4-5.1-.4c-.6 0-4.7.4-5.1.4c-.4 0-2.1-.1-2-.3zm2 .8c.5-.3 4.1-.3 5.1-.3c1 0 4.6-.1 5.1.3c.5.4.2 2.7.2 3.3c0 .6.2 2.6-.3 2.9c-.5.3-4 .3-5 .3c-1 0-4.5-.1-5-.4c-.5-.3-.3-2.4-.3-3c0-.6-.3-2.8.2-3.1zm6.5 6.4c.2-.3.1-3 0-3.4c-.1-.4-1.2-1-1.4-1c-.2 0-1.2.6-1.3 1c-.1.4-.3 3.1-.1 3.4c.2.3 2.6.3 2.8 0zm1-3.7c.1.1 1.3 0 1.4-.1c.1-.1.1-1.3 0-1.4c-.1-.1-1.3 0-1.4.1c-.1.1-.1 1.3 0 1.4z";

const CASTLE =
  "M.9 15.3c-.2-.2-.1-8-.1-8.3c0-.3.2-2.3.2-2.4c0-.1 1.2 0 1.2 0c0 0 .1 1.2.1 1.2c0 0 .9 0 .9 0c0 0 .1-1.3.1-1.3c0 0 1.2 0 1.2.1c0 .1.1 2.7.1 2.8c0 .1.8 0 .8-.1c0-.1-.1-3.6-.1-3.7c0-.1 1.3-.1 1.3-.1c0 0 .1 1.3.1 1.3c0 0 .9 0 .9 0c0 0-.1-2-.1-2c0 0 1 0 1 0c0 0-.1 2-.1 2c0 0 .9 0 .9 0c0 0 .1-1.3.1-1.3c0 0 1.3 0 1.3.1c0 .1-.1 3.6-.1 3.7c0 .1.8.2.8.1c0-.1.1-2.7.1-2.8c0-.1 1.2-.1 1.2-.1c0 0 .1 1.3.1 1.3c0 0 .9 0 .9 0c0 0 .1-1.2.1-1.2c0 0 1.2-.1 1.2 0c0 .1.2 2.1.2 2.4c0 .3.1 8.1-.1 8.3c-.2.2-6.7.3-7.1.3c-.4 0-6.9-.1-7.1-.3zm6.8-12.3c0-.2 0-.9 0-1.4c0-.4 0-1.1 0-1.3l.6 0c0 .2.1.9.1 1.3c0 .5-.1 1.2-.1 1.4zm.5-2.7c.2-.1 2.6.4 2.6.5c0 .1-2.4.9-2.6.9c-.2 0-.2-1.3 0-1.4zm1.5 15.2c.3-.4.1-3.6-.1-4.1c-.2-.5-1.3-1.6-1.6-1.6c-.3 0-1.4 1.1-1.6 1.6c-.2.5-.4 3.7-.1 4.1c.3.4 3.1.4 3.4 0zm-7.3-5c0 .1.9 0 .9-.1c0-.1 0-1.8 0-1.9c0-.1-.9 0-.9.1c0 .1 0 1.8 0 1.9zm10.3-.1c0 .1.9.2.9.1c0-.1 0-1.8 0-1.9c0-.1-.9-.2-.9-.1c0 .1 0 1.8 0 1.9z";

const BUBBLE =
  "M1.4 5.6c.3-.5.9-2.3 1.8-3c.8-.7 2.2-1.2 3.3-1.5c1.1-.2 2.7-.4 3.7-.1c1.1.3 2.4 1.3 3.1 2.1c.7.8 1.4 2.1 1.6 3.1c.3 1.1.6 2.6.3 3.6c-.3 1-1.2 2.2-2 3c-.8.8-1.9 1.8-3 2.1c-1 .4-2.6.3-3.7.1c-1.1-.3-2.2-1.1-3.1-1.9c-.8-.7-1.7-2.3-2-2.7l.2-.2c.4.5 1.2 1.9 2.1 2.6c.8.7 1.9 1.1 3 1.3c1.1.3 2.2.4 3.3 0c1-.3 1.8-1.1 2.6-1.9c.8-.8 1.5-1.6 1.8-2.6c.2-1 0-2.1-.3-3.1c-.3-1.1-.7-2-1.4-2.8c-.8-.9-1.7-1.5-2.7-1.9c-1.1-.3-2.2-.1-3.3.2c-1.1.2-2.2.4-3.1 1.1c-.8.7-1.6 2.2-2 2.7z";

const NO_READING =
  "M15 8.7c0 .2.2.6.1.9c-.1.2-.2.5-.2.7c-.1.3-.5.6-.6.7l-.2-.1c0-.1 0-.6.1-.8c.1-.3.1-.5.2-.7c0-.3.3-.6.3-.7zm-1.8 3.9c-.1.1-.2.5-.4.7c-.2.2-.4.4-.7.5c-.2.2-.7.2-.8.2l-.1-.2c.1-.1.3-.5.5-.6c.2-.1.4-.3.6-.5c.2-.1.6-.2.7-.3zm-3.7 2.1c-.2 0-.6.3-.8.3c-.3.1-.6.1-.9.1c-.2 0-.6-.3-.8-.3l.1-.3c.1 0 .5-.2.7-.2c.3 0 .5 0 .8 0c.3 0 .7.1.8.1zm-4.4-.4c-.1-.1-.6-.1-.8-.2c-.2-.1-.5-.3-.7-.5c-.2-.1-.4-.6-.5-.7l.2-.2c.1.1.5.2.7.3c.2.2.4.3.7.4c.2.2.4.5.6.6zm-3.2-2.9c-.1-.1-.5-.4-.6-.6c-.1-.2-.2-.5-.3-.8c0-.2.1-.7.1-.8l.3-.1c0 .2.3.5.3.7c.1.3.2.5.3.7c.1.2.1.7.2.8zm-.9-4.1c0-.2-.2-.6-.1-.9c.1-.2.2-.5.2-.7c.1-.3.5-.6.6-.7l.2.1c0 .1 0 .6-.1.8c-.1.3-.1.5-.2.7c0 .3-.3.6-.3.7zm1.8-3.9c.1-.1.2-.5.4-.7c.2-.2.4-.4.7-.5c.2-.2.7-.2.8-.2l.1.2c-.1.1-.3.5-.5.6c-.2.1-.4.3-.6.5c-.2.1-.6.2-.7.3zm3.7-2.1c.2 0 .6-.3.8-.3c.3-.1.6-.1.9-.1c.2 0 .6.3.8.3l-.1.3c-.1 0-.5.2-.7.2c-.3 0-.5 0-.8 0c-.3 0-.7-.1-.8-.1zm4.4.4c.1.1.6.1.8.2c.2.1.5.3.7.5c.2.1.4.6.5.7l-.2.2c-.1-.1-.5-.2-.7-.3c-.2-.2-.4-.3-.7-.4c-.2-.2-.4-.5-.6-.6zm3.2 2.9c.1.1.5.4.6.6c.1.2.2.5.3.8c0 .2-.1.7-.1.8l-.3.1c0-.2-.3-.5-.3-.7c-.1-.3-.2-.5-.3-.7c-.1-.2-.1-.7-.2-.8z";

type At = { cx: number; cy: number; size: number; className?: string };

function Cut({ d, cx, cy, size, className }: At & { d: string }) {
  const k = size / 16;
  return (
    <g transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${k})`} className={className}>
      <path d={d} fill="currentColor" />
    </g>
  );
}

/** A member's city: a pitched roof with a chimney over a squat body, a door and a window cut out. */
export const HouseGlyph = (p: At) => <Cut d={HOUSE} {...p} />;

/** The castle point: two crenellated towers either side of a taller keep, a pennant, an arched gate. */
export const CastleGlyph = (p: At) => <Cut d={CASTLE} {...p} />;

/** A shield seen: a light translucent disc under a drawn ring. */
export function ShieldBubble({ cx, cy, size, className }: At) {
  return (
    <g className={className}>
      <circle cx={cx} cy={cy} r={size * 0.43} fill="currentColor" fillOpacity={0.14} />
      <Cut d={BUBBLE} cx={cx} cy={cy} size={size} />
    </g>
  );
}

/** No shield reading: the same ring drawn as short pen dashes. */
export const NoReadingRing = (p: At) => <Cut d={NO_READING} {...p} />;
