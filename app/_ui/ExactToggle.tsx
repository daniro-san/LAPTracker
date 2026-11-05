// "Show exact numbers": switches every number on the page between 3.94B-style and 3,938,123,456
// with CSS only (globals.css), so it works on touch and without JavaScript.
export function ExactToggle() {
  return (
    <label className="mb-3 flex min-h-11 cursor-pointer items-center gap-3">
      <input id="full-numbers" type="checkbox" className="size-5 accent-plum" />
      <span>
        Show exact numbers
        <span className="block text-sm text-ink/70">Off: 3.94B. On: 3,938,123,456.</span>
      </span>
    </label>
  );
}
