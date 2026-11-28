// D162: where a premium feature would be in Alliance settings → Features, on a plan that leaves it out: its
// name, a "Premium" tag and one calm line, with a link to the Plans page (44 px). Officers only; nothing on
// hover. People first (D75): it says what the plan covers, never what the alliance lacks.
import { Tag } from "@/lib/brand/components/Tag";
import { TextLink } from "@/lib/brand/components/TextLink";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

export function PremiumNote(props: { slug: string; name: string; t: WorkspaceDictionary }) {
  const { t } = props;
  return (
    <div className="py-1">
      <p className="flex flex-wrap items-baseline gap-x-2 font-semibold">
        <span>{props.name}</span>
        <Tag>{t["plans.premium"]}</Tag>
      </p>
      <p className="text-body-sm">
        {t["plans.note"]}{" "}
        <TextLink
          href={`/w/${props.slug}/settings/plans`}
          className="inline-flex min-h-11 items-center"
        >
          {t["plans.see"]}
        </TextLink>
      </p>
    </div>
  );
}
