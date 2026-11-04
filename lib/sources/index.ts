// The two adapters, one output type (plan Phase 2). No source switch (plan §3.5).
import * as internalSource from "./internal";
import type { InternalSource, V1Source } from "./types";
import * as v1Source from "./v1";

export const v1: V1Source = v1Source;
export const internal: InternalSource = internalSource;
