# Security

Report a suspected vulnerability through the repository's
[private GitHub security advisory form](https://github.com/alexandroit/stackline-lockfile/security/advisories/new).
Do not disclose an unfixed vulnerability in a public issue. Include the
package and Node.js versions, operating system and filesystem or mount type,
the lock path and options with secrets removed, a minimal reproduction, and
the exact observed error or state.

Public correctness questions that do not contain sensitive security details
can use the normal issue tracker.

## Supported line

The latest `1.x` release supports Node.js `>=14.17`. Apply current patch
releases and test the actual filesystem used in production.

## Trust boundary

`lockfile` is cooperative process coordination. It is not authentication,
authorization, mandatory exclusion, durable consensus, or a sandbox. A party
that can modify the lock directory can create, remove, replace, or age a lock
outside this package's rules.

Use a dedicated directory with appropriate ownership and permissions. Treat
lock paths as trusted application configuration, not unsanitized user input.
Do not assume the stale-file algorithm makes an attacker-controlled directory
or symlink layout safe.

## Filesystem and failure caveats

- Correctness depends on sufficiently atomic exclusive create, hard link,
  unlink, metadata, and visibility behavior.
- NFS and other network filesystems can cache directory or stat information;
  cross-host clocks and coarse timestamp resolution can distort stale age.
- A stale threshold that is too short can remove a live participant's lock.
  The zero-byte format has no owner, PID, heartbeat, or fencing token.
- Different participants can choose conflicting stale thresholds. This is the
  unresolved protocol limitation in
  [npm/lockfile#30](https://github.com/npm/lockfile/issues/30), not a condition
  repaired by this release.
- Normal exit cleanup uses `signal-exit` and is best-effort. Abrupt termination,
  host failure, or an unlink failure can leave a lock behind.
- `unlockSync` intentionally suppresses unlink errors. Async `unlock` reports
  non-`ENOENT` errors only when a callback is supplied; applications that need
  evidence of cleanup must inspect that callback.

If the workload requires heartbeats, ownership metadata, lease renewal,
fencing, or compromise detection, select a protocol designed for those needs.
`proper-lockfile` is one alternative, but it is not API- or on-disk-compatible.

Exact-version checks of OSV, npm, GitHub global advisories, and upstream
repository advisories found no match for `lockfile@1.0.4` during the dated
2026-08-29 audit. That result is not a claim that the upstream package, its
dependency, or this continuation is vulnerability-free.
