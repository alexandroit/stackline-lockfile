# @stackline/lockfile

> Maintained compatibility-first file locking with observable asynchronous unlock failures

[![npm version](https://img.shields.io/npm/v/@stackline/lockfile.svg?style=flat-square)](https://www.npmjs.com/package/@stackline/lockfile)
[![license](https://img.shields.io/npm/l/@stackline/lockfile.svg?style=flat-square)](https://github.com/alexandroit/stackline-lockfile/blob/main/LICENSE)
[![GitHub repository](https://img.shields.io/badge/GitHub-Repository-181717?style=flat-square&logo=github)](https://github.com/alexandroit/stackline-lockfile)

**[Documentation](https://alexandro.net/docs/vanilla/lockfile/)** |
**[npm](https://www.npmjs.com/package/@stackline/lockfile)** |
**[Issues](https://github.com/alexandroit/stackline-lockfile/issues)** |
**[Repository](https://github.com/alexandroit/stackline-lockfile)**

**Package version:** `1.0.7`

## Why this package?

Compatibility-first filesystem lock files for CommonJS, with asynchronous
unlock failures made observable.

This is an independent Stackline continuation of `lockfile`. It is not
affiliated with or endorsed by Isaac Z. Schlueter, npm, the original
maintainers, or the upstream project.

## Compatibility

| Item | Value |
| --- | --- |
| Package | `@stackline/lockfile@1.0.7` |
| Node.js runtime | `>=14.17` |
| CommonJS / primary entry | `lockfile.js` |
| Type declarations | `lockfile.d.ts` |

<a id="typescript-and-runtime-support"></a>

### TypeScript and runtime support

First-party declarations model the callback-based CommonJS API, optional
arguments, options, mutable `filetime`, and actual `undefined` success values.
They are additive: the package does not introduce Promise methods, an ESM
runtime, or a second implementation.

The supported runtime is Node.js `>=14.17`. Development and release tooling
may require a newer Node.js version than consumers do.

## Installation

<a id="install"></a>

### Install

For new code, install and import the scoped package directly:

## Usage

```sh
npm install @stackline/lockfile@1.0.7
```

```js
var lockfile = require('@stackline/lockfile')
```

To keep an existing `require('lockfile')` unchanged, install the scoped
package under the historical dependency key:

```sh
npm install lockfile@npm:@stackline/lockfile@1.0.7
```

The equivalent manifest entry is:

```json
{
  "dependencies": {
    "lockfile": "npm:@stackline/lockfile@1.0.7"
  }
}
```

<a id="quick-start"></a>

### Quick start

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

## Features and Integrations

<a id="the-bounded-unlock-correction"></a>

### The bounded unlock correction

Upstream issue [npm/lockfile#18](https://github.com/npm/lockfile/issues/18)
identified the error boundary. In `lockfile@1.0.4`, asynchronous `unlock`
discarded every `fs.unlink` error and always reported success.

`@stackline/lockfile@1.0.7` changes only that branch:

- `ENOENT` still means already unlocked and remains a successful no-op;
- successful unlink still settles as `callback()` with `undefined`;
- a non-`ENOENT` unlink failure such as `EACCES`, `EPERM`, or an I/O error is
  delivered as the original error, exactly once; and
- synchronous `unlockSync` remains best-effort and suppresses unlink errors.

Acquisition, checking, retry, wait, stale, callback, on-disk, and process-exit
behavior otherwise remain compatible with the published 1.0.4 artifact.

<a id="more-documentation"></a>

### More documentation

- [Migration guide](https://github.com/alexandroit/stackline-lockfile/blob/main/MIGRATION.md)
- [Compatibility contract](https://github.com/alexandroit/stackline-lockfile/blob/main/COMPATIBILITY_CONTRACT.md)
- [Security policy and trust boundary](https://github.com/alexandroit/stackline-lockfile/blob/main/SECURITY.md)
- [Contributing](https://github.com/alexandroit/stackline-lockfile/blob/main/CONTRIBUTING.md)
- [Publishing gates](https://github.com/alexandroit/stackline-lockfile/blob/main/PUBLISHING.md)
- [Notices](https://github.com/alexandroit/stackline-lockfile/blob/main/NOTICE)
- [Third-party licenses](https://github.com/alexandroit/stackline-lockfile/blob/main/THIRD_PARTY_LICENSES.md)
- [Alexandro.Net documentation](https://alexandro.net/docs/vanilla/lockfile/)

## Security

<a id="filesystem-boundary"></a>

### Filesystem boundary

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

## API Surface

<a id="commonjs-api"></a>

### CommonJS API

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

#### Options

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

## Local Development

```sh
git clone https://github.com/alexandroit/stackline-lockfile.git
cd stackline-lockfile
npm ci
npm run validate
```

Release tooling uses Node.js 24.20.0 and npm 11.19.0. The consumer runtime contract remains the one documented above.

## Consumer Smoke Test

Run the repository's existing consumer/package check after installing development dependencies:

```sh
npm run check:packed
```

## Release Checklist

Run `npm run validate` and inspect the package contents before release. Publish a new version through the [GitHub Actions publishing workflow](https://github.com/alexandroit/stackline-lockfile/actions/workflows/publish.yml), using the SHA-512 digest of the reviewed tarball. Verify the exact published version, tarball integrity, and npm provenance after the run.

## Community and Support

Report reproducible package issues in the [issue tracker](https://github.com/alexandroit/stackline-lockfile/issues). Use the [security policy](https://github.com/alexandroit/stackline-lockfile/blob/main/SECURITY.md) for vulnerability reports.

- [Stackline / Alexandro.Net](https://alexandro.net/)
- [GitHub](https://github.com/alexandroit)
- [Maintainer LinkedIn](https://www.linkedin.com/in/aleinfo/)
- [Reddit community: r/Stackline](https://www.reddit.com/r/Stackline/)

## License

ISC. See [the license](https://github.com/alexandroit/stackline-lockfile/blob/main/LICENSE) for the complete terms.

Original authorship and third-party attribution are preserved in [NOTICE](https://github.com/alexandroit/stackline-lockfile/blob/main/NOTICE).
