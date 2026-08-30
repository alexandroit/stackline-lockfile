# Contributing

Use Node.js 20 or newer for development while preserving the declared runtime
floor of exact Node.js 14.17 and the callback-based CommonJS implementation.

1. Install the exact dependency graph with `npm ci`.
2. Add focused upstream-differential and regression proof for every observable
   change. Cover Linux and Windows behavior where filesystem semantics differ.
3. Run `npm run validate`.
4. Run the static documentation check with `node docs-site/check.mjs`.
5. Review `npm pack --dry-run`; keep fixtures, credentials, caches, decision
   evidence, docs-site sources, and development-only tools out of the package.

Preserve all six methods, optional arguments, callback timing and values,
original error identity, `undefined` success, zero-byte `wx` files, wait and
retry bounds, staleness rules, same-process bookkeeping, and exit cleanup.
The approved runtime correction in 1.0.5 is propagation of the original
non-`ENOENT` asynchronous unlink error exactly once. `ENOENT` and synchronous
suppression must stay compatible.
Version 1.0.6 only migrates the maintained exit hook to the compatible
`signal-exit@4.1.0` named API.

Do not add promises, a parallel ESM runtime, ownership metadata, heartbeats,
or a different lock protocol as a minor compatibility fix. Do not claim issue
30 is resolved without an explicitly versioned protocol design and migration.

Do not add or update a runtime dependency without a dated maintenance,
security, compatibility, license, and topology review. Every documentation
change must keep the Alexandro.Net canonical path
`/docs/vanilla/lockfile/`, machine-readable references, accessibility, and
independent-project disclaimer accurate.
