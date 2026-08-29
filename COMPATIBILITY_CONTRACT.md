# Compatibility Contract

## Immutable baseline

The compatibility baseline is the published `lockfile@1.0.4` npm artifact,
not only its earlier `v1.0.4` Git tag. The official tarball has SHA-256
`887b137414eb92de260da9d42544b852c4999b38b7da7e1f39946f59f4d8c6c5` and
npm integrity
`sha512-cvbTwETRfsFh4nHsL1eGWapU1XFi5Ot9E85sWAwia7Y7EgB7vfqcZhTKZ+l7hCGxSPoushMv5GKhT5PdLv03WA==`.
The complete ISC notice and published-artifact provenance are retained.

## Preserved public surface

The root remains one CommonJS object with six methods:

- `lock(path, [options], callback)`
- `lockSync(path, [options])`
- `unlock(path, [callback])`
- `unlockSync(path)`
- `check(path, [options], callback)`
- `checkSync(path, [options])`

The mutable `filetime` property continues to default to `ctime` on POSIX and
`mtime` on Windows. No Promise API, ESM implementation, ownership API,
heartbeat API, or deep-entry protocol is added.

## Preserved behavior

- Acquisition creates a zero-byte file using exclusive `wx` access.
- Async `lock` calls back with the original filesystem/contention error or no
  arguments on success. `lockSync` throws or returns `undefined`.
- Async `check` uses `callback(error, isLocked)`; `checkSync` returns a boolean
  or throws.
- `wait`, `pollPeriod`, `stale`, `retries`, and `retryWait` retain upstream
  meanings, polling bounds, retry counts, and option-object mutation.
- POSIX stale checks use `ctime`; Windows uses `mtime`. Sync takeover retains
  the upstream upward rounding rule on second-resolution filesystems.
- Stale takeover retains the `.STALE` coordination file algorithm.
- Same-process bookkeeping and `signal-exit` cleanup remain best-effort.
- An already-absent lock is an `ENOENT` no-op for both unlock methods.
- `unlockSync` suppresses all unlink errors and returns `undefined`.

## Sole intentional runtime delta

The correction is limited to
[npm/lockfile#18](https://github.com/npm/lockfile/issues/18). After deleting
the same-process bookkeeping entry, asynchronous `unlock` now:

1. calls `callback()` after successful unlink;
2. calls `callback()` when unlink reports `ENOENT`; and
3. passes the original non-`ENOENT` unlink error to `callback` exactly once.

Upstream 1.0.4 incorrectly converted the third outcome to success. No other
default runtime behavior is intentionally changed. Omitting the optional
callback remains supported, but leaves no error-delivery channel.

## Deliberately excluded protocol change

Issue [npm/lockfile#30](https://github.com/npm/lockfile/issues/30) is not fixed
by 1.0.5. Each participant supplies its own `stale` threshold while the
zero-byte lock contains no owner, start time, heartbeat, policy, or fencing
token. Making one caller's threshold authoritative would require a new
protocol and would not be compatibility-sized work.

## Additive declarations

The package adds first-party TypeScript declarations for the actual callback
surface and `undefined` success results. These declarations change neither
JavaScript behavior nor module format.

## Runtime and filesystem boundary

Supported Node.js versions begin at exact `14.17`. Support assumes a
filesystem that provides the exclusive-create, link, unlink, visibility, and
metadata semantics used by the algorithm. Timestamp resolution, clock skew,
attribute caches, or weaker atomicity on NFS and other distributed mounts can
invalidate local-filesystem results. Every deployment must test its real mount
and choose a stale threshold conservatively.
