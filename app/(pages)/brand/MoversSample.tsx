// The `movers` card on /brand with made-up figures: two gains, one loss, an empty Kills list.
import { Movers } from "@/app/_ui/Movers";
import { copy } from "@/lib/copy";

const t = copy.brand.components.movers;

const item = (label: string, rank: number, delta: number, base: number) => ({
  key: label,
  href: "#components",
  rank,
  label,
  badgeId: null,
  delta,
  base,
  mark: delta < 0,
});

const MOVERS_SAMPLE = {
  key: "sample",
  title: null,
  lists: {
    mightGains: t.gains.map((g, i) => item(g, i + 1, 85_800_000 - i * 6_600_000, 4.2e9)),
    mightLosses: [item(t.loss, 1, -71_300_000, 3.7e9)],
    killsGains: [],
  },
};

export function MoversSample() {
  return (
    <div className="w-full">
      <Movers scopes={[MOVERS_SAMPLE]} />
    </div>
  );
}
