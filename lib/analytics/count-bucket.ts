// How many people a drilldown opened, as a closed bucket (#678, shared with the public `drilldown_opened`,
// #690): never the exact count, so a number cannot point back at one set of people.
export type CountBucket = "0" | "1" | "2_4" | "5_9" | "10_plus";

export const countBucket = (n: number): CountBucket =>
  n <= 0 ? "0" : n === 1 ? "1" : n < 5 ? "2_4" : n < 10 ? "5_9" : "10_plus";
