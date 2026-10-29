import path from "node:path";
import dotenv from "dotenv";

// Loaded before any test file imports app code (src/config.ts reads JWT_SECRET at import time).
// `.env.test` holds throwaway local values; real environment variables (CI) take precedence.
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });
process.env.JWT_SECRET ??= "test-secret-do-not-use-anywhere-else";
// Pin the analytics zone so the day-boundary tests do not depend on the machine's settings.
process.env.ANALYTICS_TIME_ZONE = "Asia/Kolkata";
