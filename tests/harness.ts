/**
 * A ~60 line test harness.
 *
 * The engine is plain TypeScript with no React Native imports, so it can be
 * compiled with tsc and run on node directly. That keeps `npm test` fast and
 * avoids pulling a mobile test runner into a personal project.
 */

type TestFn = () => void | Promise<void>;

interface RegisteredTest {
  suite: string;
  name: string;
  fn: TestFn;
}

const registry: RegisteredTest[] = [];
let currentSuite = "general";

export const suite = (name: string, body: () => void): void => {
  const previous = currentSuite;
  currentSuite = name;
  body();
  currentSuite = previous;
};

export const test = (name: string, fn: TestFn): void => {
  registry.push({ suite: currentSuite, name, fn });
};

export class AssertionError extends Error {}

const show = (value: unknown): string =>
  typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value) ?? String(value);

export const assertTrue = (value: boolean, message: string): void => {
  if (!value) {
    throw new AssertionError(message);
  }
};

export const assertFalse = (value: boolean, message: string): void => {
  assertTrue(!value, message);
};

export const assertEqual = <T>(actual: T, expected: T, message = ""): void => {
  if (actual !== expected) {
    throw new AssertionError(
      `${message || "values differ"}\n    expected: ${show(expected)}\n    actual:   ${show(actual)}`
    );
  }
};

export const assertClose = (actual: number, expected: number, message = "", tolerance = 1e-9): void => {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new AssertionError(
      `${message || "numbers differ"}\n    expected: ${expected}\n    actual:   ${actual}`
    );
  }
};

export const assertIncludes = (haystack: string, needle: string, message = ""): void => {
  if (!haystack.includes(needle)) {
    throw new AssertionError(
      `${message || "substring missing"}\n    expected to contain: ${show(needle)}\n    actual: ${show(haystack)}`
    );
  }
};

export const runAll = async (): Promise<number> => {
  let passed = 0;
  const failures: { test: RegisteredTest; error: unknown }[] = [];
  let lastSuite = "";

  for (const entry of registry) {
    if (entry.suite !== lastSuite) {
      console.log(`\n${entry.suite}`);
      lastSuite = entry.suite;
    }
    try {
      await entry.fn();
      passed += 1;
      console.log(`  PASS  ${entry.name}`);
    } catch (error) {
      failures.push({ test: entry, error });
      console.log(`  FAIL  ${entry.name}`);
    }
  }

  if (failures.length > 0) {
    console.log(`\n${failures.length} failure(s):`);
    for (const failure of failures) {
      const message = failure.error instanceof Error ? failure.error.message : String(failure.error);
      console.log(`\n  ${failure.test.suite} > ${failure.test.name}\n    ${message}`);
    }
  }

  console.log(`\n${passed} passed, ${failures.length} failed, ${registry.length} total`);
  return failures.length;
};
