import { prisma } from "../../src/prisma";
import { resetDb } from "./db";

// Safety net: these tests TRUNCATE every table. Refuse to run against anything that does not
// look like a test database, so a stray DATABASE_URL (e.g. your Neon dev database) is never wiped.
const url = process.env.DATABASE_URL ?? "";
const dbName = (() => {
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();
if (!/test/i.test(dbName)) {
  throw new Error(
    `Refusing to run integration tests: database name "${dbName}" does not contain "test". ` +
      "Point DATABASE_URL at a throwaway database (see tests/README.md)."
  );
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});
