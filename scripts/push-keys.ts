// `pnpm push:keys`: prints a fresh VAPID key pair for the officers' notifications (D148), for the owner to
// paste into Vercel's environment variables (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY; VAPID_SUBJECT is the
// owner's own contact). Generated here with node:crypto, printed once to this terminal, written nowhere.
// The private key is a secret: never commit it, paste it in chat or put it in a log. Replacing the pair
// later stops every device's notifications until its officer taps "Enable on this device" again.
import { newVapidKeys } from "../lib/web-push";

const { publicKey, privateKey } = newVapidKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:<an address you read>");
