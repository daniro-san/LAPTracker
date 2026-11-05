// "Exact numbers": switches every number on the page between 3.94B-style and 3,938,123,456 with CSS
// only (globals.css), so it works on touch and without JavaScript. A compact framed toggle that sits
// beside the page title.
import { copy } from "@/lib/copy";

export function ExactToggle() {
  return (
    <label className="drawn-frame-soft inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 px-3 text-body-sm font-medium text-plum transition-colors duration-150 hover:bg-plum/10 motion-reduce:transition-none">
      <input id="full-numbers" type="checkbox" className="drawn-check size-[18px]" />
      {copy.site.exactNumbers}
    </label>
  );
}
