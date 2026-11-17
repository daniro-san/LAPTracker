// The phone's status bar, pure so the browser can drop it before sending a picture (prepare.ts drops it
// on the server).
/**
 * A phone's status bar (clock, battery) is the top 5.5 % of a full-screen capture, one at least
 * STATUS_BAR_ASPECT times taller than wide (measured on 923 x 2000 iPhone prints: its text ends at
 * 4.8 %, the game's header starts at 6.8 %). Its "71" battery was read as a ranking row.
 */
export const STATUS_BAR_SHARE = 0.055;
export const STATUS_BAR_ASPECT = 1.9;
