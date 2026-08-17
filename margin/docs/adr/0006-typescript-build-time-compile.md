# TypeScript source, build-time compile, zero runtime dependencies preserved

Margin's source is **TypeScript**, compiled with `tsc` (the sole devDependency) before run/publish; the installed package executes the compiled output. This supersedes the implicit "plain Node = vanilla JS" reading of ticket #2 — the original grilling pinned down the *runtime* (Node, zero runtime dependencies) but never decided the *source language*, and the first implementation was written in vanilla JS before the oversight was caught.

The zero-runtime-dependency stance is deliberately kept and scoped: what `npx margin` installs stays stdlib-only (`node:http`, `fs.watch`, `crypto`); devDependencies are allowed. The stance is a distribution choice (ambient availability for any agent, no supply-chain surface), not a technical necessity — relax per-case if a future need arises.

Considered and rejected: running `.ts` directly via Node 22's `--experimental-strip-types` (experimental flag; bin-shim fragility across environments) and JSDoc + `checkJs` (not the full TypeScript the user asked for).
