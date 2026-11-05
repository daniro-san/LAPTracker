// "Exact numbers": switches every number on the page between 3.94B-style and 3,938,123,456 with CSS
// only (globals.css), so it works on touch and without JavaScript. A compact framed toggle that sits
// beside the page title.
import { CheckField } from "@/lib/brand/components/CheckField";
import { copy } from "@/lib/copy";

export function ExactToggle() {
  return <CheckField variant="chip" id="full-numbers" label={copy.site.exactNumbers} />;
}
