import * as dotenv from "dotenv";
dotenv.config();

import { beforeAll, afterAll } from "vitest";

// Provide Mocha's global `before` and `after` aliases for Vitest
(globalThis as unknown as Record<string, unknown>).before = beforeAll;
(globalThis as unknown as Record<string, unknown>).after = afterAll;
