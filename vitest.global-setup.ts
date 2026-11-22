// Builds the test database's snapshot once, before the workers start, so they don't each build it
// (testDbSnapshot in lib/db.test-helpers.ts).
import { testDbSnapshot } from "./lib/db.test-helpers";

export default async function setup(): Promise<void> {
  await testDbSnapshot();
}
