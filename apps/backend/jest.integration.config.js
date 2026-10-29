/**
 * Integration tests: real resolvers + services against a real Postgres (see tests/README.md).
 * Files share one database, so they run serially (maxWorkers: 1) and each test starts from
 * empty tables (TRUNCATE in beforeEach).
 */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests/integration"],
  testMatch: ["**/*.test.ts"],
  setupFiles: ["<rootDir>/tests/helpers/setup-env.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/helpers/setup-integration.ts"],
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json", diagnostics: { ignoreCodes: [151002] } }] },
  maxWorkers: 1,
  testTimeout: 30000,
};
