# @stackline/lockfile

Compatibility-first filesystem lock files for CommonJS, with asynchronous
unlock failures made observable.

This is an independent Stackline continuation of `lockfile`. It is not
affiliated with or endorsed by Isaac Z. Schlueter, npm, the original
maintainers, or the upstream project.

## Install

For new code, install and import the scoped package directly:

```sh
npm install @stackline/lockfile@1.0.6
```

```js
var lockfile = require('@stackline/lockfile')
```

To keep an existing `require('lockfile')` unchanged, install the scoped
package under the historical dependency key:

```sh
npm install lockfile@npm:@stackline/lockfile@1.0.6
```

The equivalent manifest entry is:

```json
{
  "dependencies": {
    "lockfile": "npm:@stackline/lockfile@1.0.6"
  }
}
```

## Quick start

```js
var lockfile = require('@stackline/lockfile')
var path = 'work.lock'

lockfile.lock(path, { wait: 2000, stale: 30000 }, function (lockError) {
  if (lockError) throw lockError

  // Perform the work protected by this cooperative lock.

  lockfile.unlock(path, function (unlockError) {
    if (unlockError) throw unlockError
  })
})
```

Always inspect the `unlock` callback when cleanup matters. There is no Promise
API: omitting the optional callback also omits the place where an unlink error
can be observed.

## CommonJS API

The runtime preserves the six-method API from `lockfile@1.0.4`:

- `lock(path, [options], callback)` acquires a lock asynchronously and calls
  `callback(error)`; success has no value.
- `lockSync(path, [options])` acquires a lock or throws; success returns
  `undefined`.
- `unlock(path, [callback])` removes a lock asynchronously. Success and a
  missing lock both call `callback()` with no error. Other unlink errors are
  passed through unchanged.
- `unlockSync(path)` makes a best-effort removal, suppresses every unlink
  error, and returns `undefined`.
- `check(path, [options], callback)` calls `callback(error, isLocked)`.
- `checkSync(path, [options])` returns a boolean or throws.

The mutable `lockfile.filetime` property defaults to `ctime` on POSIX and
`mtime` on Windows and selects the stat timestamp used for stale checks.

### Options

- `wait`: milliseconds that asynchronous `lock` may keep polling before it
  returns the original contention error.
- `pollPeriod`: milliseconds between polls while waiting; default `100`.
- `stale`: age in milliseconds after which a lock may be taken over.
- `retries`: additional acquisition attempts for `lock` and `lockSync`.
- `retryWait`: delay in milliseconds between asynchronous retries.

`lockSync` rejects `wait` and `retryWait` because it cannot sleep between
attempts. `checkSync` rejects `wait`. As in the upstream implementation,
supplied option objects are mutable bookkeeping inputs; avoid sharing one
object between independent attempts.

## The bounded unlock correction

Upstream issue [npm/lockfile#18](https://github.com/npm/lockfile/issues/18)
identified the error boundary. In `lockfile@1.0.4`, asynchronous `unlock`
discarded every `fs.unlink` error and always reported success.

`@stackline/lockfile@1.0.5` changes only that branch:

- `ENOENT` still means already unlocked and remains a successful no-op;
- successful unlink still settles as `callback()` with `undefined`;
- a non-`ENOENT` unlink failure such as `EACCES`, `EPERM`, or an I/O error is
  delivered as the original error, exactly once; and
- synchronous `unlockSync` remains best-effort and suppresses unlink errors.

Acquisition, checking, retry, wait, stale, callback, on-disk, and process-exit
behavior otherwise remain compatible with the published 1.0.4 artifact.

## TypeScript and runtime support

First-party declarations model the callback-based CommonJS API, optional
arguments, options, mutable `filetime`, and actual `undefined` success values.
They are additive: the package does not introduce Promise methods, an ESM
runtime, or a second implementation.

The supported runtime is Node.js `>=14.17`. Development and release tooling
may require a newer Node.js version than consumers do.

## Filesystem boundary

This package creates a zero-byte file with exclusive `wx` access. It is a
cooperative coordination primitive, not an authorization or security boundary.
Correctness depends on every participant using the same path and on the
filesystem providing sufficiently atomic exclusive-create, link, unlink, and
metadata behavior.

Network and distributed filesystems can weaken visibility and timestamp
assumptions through attribute caches, clock differences, or coarse timestamp
resolution. In particular, validate the intended mount and workload before
using stale takeover on NFS or across hosts. A stale threshold that is too low
can remove a live lock. Abrupt termination can leave a lock despite best-effort
`signal-exit` cleanup.

The zero-byte format has no owner, PID, heartbeat, fencing token, or embedded
stale policy. Consequently, the conflicting-threshold problem described in
[npm/lockfile#30](https://github.com/npm/lockfile/issues/30) is not fixed. If
you need leases, heartbeats, ownership metadata, or compromise detection,
evaluate a protocol such as `proper-lockfile`; it is not a drop-in replacement.

## More documentation

- [Migration guide](MIGRATION.md)
- [Compatibility contract](COMPATIBILITY_CONTRACT.md)
- [Security policy and trust boundary](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Publishing gates](PUBLISHING.md)
- [Notices](NOTICE)
- [Third-party licenses](THIRD_PARTY_LICENSES.md)
- [Alexandro.Net documentation](https://alexandro.net/docs/vanilla/lockfile/)
