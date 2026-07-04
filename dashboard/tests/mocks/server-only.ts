// Vitest-only stand-in for the `server-only` package.
//
// `server-only`'s real implementation unconditionally throws on import; it
// relies on Next.js's build tooling to special-case and strip it. Outside
// that tooling (i.e. under Vitest) it would fail every test that imports
// server-side code, so we alias it to this no-op via vitest.config.ts.
export {};
