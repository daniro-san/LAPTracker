// D160: the place on the Plans page where a payment link goes once one exists. With no link it renders
// nothing: there is no payment method yet, so no button, price or empty box is shown.
import { buttonClass } from "@/lib/brand/components/Button";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

export function PlanPaymentSlot(props: { href: string | null; t: WorkspaceDictionary }) {
  if (!props.href) return null;
  return (
    <p className="mt-4">
      <a href={props.href} className={buttonClass("primary")}>
        {props.t["plans.payment"]}
      </a>
    </p>
  );
}
