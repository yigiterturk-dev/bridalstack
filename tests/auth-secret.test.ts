import assert from "node:assert/strict";
import test from "node:test";
import { getAuthSecret } from "../lib/auth-secret.ts";

/** Üretimde sır yoksa fail-closed; derleme aşamasında ise build engellenmez. */
function withEnv<T>(values: Record<string, string | undefined>, run: () => T): T {
  const before = { ...process.env };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return run();
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
}

test("explicit secret wins", () => {
  withEnv({ NEXTAUTH_SECRET: "real-secret", NODE_ENV: "production", NEXT_PHASE: undefined }, () => {
    assert.equal(getAuthSecret(), "real-secret");
  });
});

test("production without a secret fails closed", () => {
  withEnv({ NEXTAUTH_SECRET: undefined, NODE_ENV: "production", NEXT_PHASE: undefined }, () => {
    assert.throws(() => getAuthSecret(), /NEXTAUTH_SECRET is not set/);
  });
});

test("the build phase may run without a secret", () => {
  withEnv({ NEXTAUTH_SECRET: undefined, NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }, () => {
    assert.equal(getAuthSecret(), "build-only-insecure-secret");
  });
});

test("development keeps its local fallback", () => {
  withEnv({ NEXTAUTH_SECRET: undefined, NODE_ENV: "development", NEXT_PHASE: undefined }, () => {
    assert.equal(getAuthSecret(), "dev-only-insecure-secret");
  });
});
