// The calendar's clock lives in lib/calendar-time.ts (pure), so the tick's Raid prep fill (D137) can use it
// outside lib/private; the workspace's modules keep importing it from here.
export * from "../calendar-time";
