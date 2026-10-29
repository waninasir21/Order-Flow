/** Unit tests: pure logic, no database. Fast; run on every change. */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests/unit"],
  testMatch: ["**/*.test.ts"],
  setupFiles: ["<rootDir>/tests/helpers/setup-env.ts"],
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json", diagnostics: { ignoreCodes: [151002] } }] },
};
