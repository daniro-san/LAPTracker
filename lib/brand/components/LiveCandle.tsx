// The /admin live mark (DESIGN.md `live-indicator`): grandma's lit chamberstick, a 16 px filled cut
// (generator: docs/brand/drawing/examples/ornaments.py icon_live). While a run is in progress the flame
// sways from the wick and the glow ticks flicker (`.live-on` in app/globals.css); idle, the ticks are
// hidden and the colour is dimmed by the caller. Nothing moves under reduced motion. The state's word is
// always in the text beside it.
export function LiveCandle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.7 9.3c.2-.2 1-.4 1.3-.4c.3 0 .5.5.7.6c.2.1.6 0 .8-.1c.2-.1.7-.6.9-.6c.2 0 .8 0 .9.4c.1.4-.2 2-.2 2.6c0 .6.5 1.7.2 2c-.3.3-1.7.3-2.3.3c-.6 0-1.9 0-2.2-.2c-.3-.2.2-1.3.1-1.6c-.1-.3-.5-.3-.6-.6c-.1-.3-.2-1-.1-1.3c.1-.3.3-.9.5-1.1zm-3 5.4c.8 0 3.1.1 4.7.1c1.6-.1 4.2-.2 5.1-.3l0 .8c-.8.1-3.5.7-5.1.7c-1.6.1-3.9-.4-4.7-.5zm12.5-1.1c0 .4-.4 1.1-.8 1.3c-.4.2-1.2.1-1.6-.1c-.4-.2-.8-.8-.8-1.2c0-.4.4-1 .8-1.2c.4-.2 1.2-.2 1.6 0c.4.2.8.8.8 1.2zm-1.2-.6c-.2-.2-.6-.2-.9-.1c-.2.1-.5.5-.5.7c0 .2.3.5.6.6c.2.2.7.3.9.1c.2-.1.4-.5.4-.7c0-.2-.3-.5-.5-.6zm-6.1-3.7c0-.1-.1-.7-.2-.9c0-.3-.1-.6-.1-.7l.4-.2c0 .2.2.5.3.7c0 .3 0 .9 0 1.1z"
      />
      <path
        fillRule="evenodd"
        data-anim="flame"
        style={{ transformOrigin: "8px 7.4px" }}
        d="M8.9.8c.2 0 .2 1 .4 1.4c.2.4.6 1 .7 1.4c.1.4.1 1.3 0 1.7c-.1.4-.6 1.1-.9 1.3c-.3.2-.9.4-1.2.4c-.3 0-.9-.2-1.1-.5c-.2-.3-.5-.9-.5-1.3c0-.4.3-1.3.5-1.7c.2-.4.9-.8 1.2-1.2c.3-.4.7-1.5.9-1.5zm-.6 4.1c.1 0 .4.5.4.7c0 .2-.3.6-.4.6c-.1 0-.4-.2-.5-.3c-.1-.1 0-.5.1-.6c.1-.1.3-.4.4-.4z"
      />
      <path
        data-anim="glow"
        d="M4.7 3.7c-.1-.1-.7-.4-1-.6c-.2-.2-.5-.6-.7-.7l.2-.2c.1.1.8.1 1.1.3c.2.2.5.9.6 1zm6.6-.3c.1-.1.4-.8.7-1c.2-.2.9-.1 1.1-.2l0 .2c-.1.1-.4.4-.7.6c-.2.2-.8.5-.9.6zm-7 2.7c-.2 0-.7.1-1 .1c-.4 0-.8-.2-1-.2l0-.2c.2 0 .7-.4 1-.4c.4 0 .9.4 1 .5zm7.6-.2c.1-.1.6-.5 1-.5c.3 0 .8.4 1 .4l0 .2c-.2 0-.6.2-1 .2c-.3 0-.8-.1-1-.1z"
      />
    </svg>
  );
}
