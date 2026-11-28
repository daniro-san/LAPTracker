// /w/[slug]/settings/plans: Alliance settings → Plans (D162). What the alliance's plan is, what each plan
// covers (from PLAN_FEATURES, the one mapping) and why, and that changing plans deletes nothing. No price and
// no payment yet: PlanPaymentSlot renders nothing until a payment link exists. Officers only: a member's
// session goes to the board (refuse.ts), so members never see plan words.
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { PageHead } from "@/lib/brand/components/layout/PageHead";
import { TextLink } from "@/lib/brand/components/TextLink";
import { withPageDb } from "@/lib/page";
import { requireWorkspace } from "@/lib/private/access";
import { alliancePlanView } from "@/lib/private/alliance-features";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { toReviewCount } from "@/lib/private/import-view";
import { RENEW_MS } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { isPremium, PLAN_FEATURES, type Feature } from "@/lib/workspace-features";

import { SignedInFrame, workspaceWords } from "../../../../_ui/Frame";
import { PlanPaymentSlot } from "../../../../_ui/PlanPaymentSlot";
import { refuse } from "../../../../_ui/refuse";

/** No payment method yet (D162): the slot stays empty until this is a link. */
const PAYMENT_HREF: string | null = null;

function currentLine(
  view: Awaited<ReturnType<typeof alliancePlanView>>,
  t: WorkspaceDictionary,
): string {
  if (view.own) return t["plans.current.own"];
  if (view.grandfathered) return t["plans.current.grandfathered"];
  return t[`plans.current.${view.plan}`];
}

function PlanCard(props: {
  id: string;
  head: string;
  why: string;
  features: readonly Feature[];
  t: WorkspaceDictionary;
}) {
  return (
    <section aria-labelledby={props.id} className="drawn-card mt-6 max-w-2xl px-4 py-3">
      <h2 id={props.id} className="font-subhead text-display-sm">
        {props.head}
      </h2>
      <p className="mt-1">{props.why}</p>
      <ul className="mt-2 list-disc ps-5">
        {props.features.map((f) => (
          <li key={f}>{props.t[`switches.name.${f}`]}</li>
        ))}
      </ul>
    </section>
  );
}

export default async function PlansPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const jar = await cookies();
  const now = new Date();
  const { language, t } = await workspaceWords();
  // INVARIANT workspace.access-first: nothing private is read before this check.
  const { access, page } = await withPageDb(async (db) => {
    const access = await requireWorkspace(db, slug, jar, now, RENEW_MS);
    if (!access.ok) return { access, page: null };
    const [plan, waiting] = await Promise.all([
      alliancePlanView(db, access),
      toReviewCount(db, access, now),
    ]);
    return { access, page: { plan, waiting } };
  });
  if (!access.ok || !page) {
    if (!access.ok) refuse(slug, access.reason, `/w/${slug}/settings/plans`);
    notFound();
  }
  const { plan } = page;
  const free = !plan.own && !plan.grandfathered && plan.plan === "free";
  return (
    <SignedInFrame access={access} language={language} t={t} current={null} waiting={page.waiting}>
      <PageHead title={t["plans.title"]} />
      <p className="max-w-2xl font-semibold">{currentLine(plan, t)}</p>
      <p className="mt-2 max-w-2xl">{t["plans.lead"]}</p>
      <PlanCard
        id="plan-free"
        head={t["plans.free.head"]}
        why={t["plans.free.why"]}
        features={PLAN_FEATURES.free}
        t={t}
      />
      <PlanCard
        id="plan-premium"
        head={t["plans.premium.head"]}
        why={t["plans.premium.why"]}
        features={PLAN_FEATURES.premium.filter(isPremium)}
        t={t}
      />
      <p className="mt-6 max-w-2xl">{t["plans.nothingLost"]}</p>
      {free && <PlanPaymentSlot href={PAYMENT_HREF} t={t} />}
      <p className="mt-4">
        <TextLink href={`/w/${slug}/settings`} className="inline-flex min-h-11 items-center">
          {t["plans.back"]}
        </TextLink>
      </p>
    </SignedInFrame>
  );
}
