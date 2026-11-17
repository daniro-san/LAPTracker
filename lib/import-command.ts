// The Discord message command of the screenshot import (D96), as registered in each workspace's server and
// as the interactions route checks it: one definition for both. Type 3 is a message command ("Apps" on a
// message); its name may have capitals and spaces.
export const IMPORT_COMMAND = { name: "Send to LAPTracker", type: 3 } as const;
