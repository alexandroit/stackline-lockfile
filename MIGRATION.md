# Migration

`@stackline/lockfile@1.0.5` preserves the callback-based CommonJS and on-disk
contract of `lockfile@1.0.4`. Choose either the historical-key alias or the
direct scoped import; do not add both identities for the same lock path.

## Preserve `require('lockfile')`

For the smallest source diff, replace the dependency spec while retaining the
historical key:

```sh
npm install lockfile@npm:@stackline/lockfile@1.0.5
```

```json
{
  "dependencies": {
    "lockfile": "npm:@stackline/lockfile@1.0.5"
  }
}
```

Existing code stays unchanged:

```js
var lockfile = require('lockfile')
```

After a clean install, verify both the dependency key and installed identity:

```sh
npm ls lockfile @stackline/lockfile --all
node -p "require('lockfile/package.json').name"
```

The second command should print `@stackline/lockfile`.

## Import the scoped package directly

New code can install the scoped identity:

```sh
npm install @stackline/lockfile@1.0.5
```

Then update the import:

```js
var lockfile = require('@stackline/lockfile')
```

There is no native ESM or Promise API. ESM applications can use normal
CommonJS interoperability, but should not infer a second runtime surface.

## Behavior to review

The only intentional runtime delta is asynchronous unlock error reporting.
In 1.0.4, `unlock(path, callback)` discarded all unlink errors. In 1.0.5:

- successful removal remains `callback()`;
- `ENOENT` remains an already-unlocked success and calls `callback()`;
- every other unlink error is passed through unchanged, exactly once; and
- `unlockSync(path)` remains best-effort and suppresses all unlink errors.

Audit callers that ignored the first callback argument, promisified `unlock`,
or assumed cleanup could not fail. Add a test showing how the application
handles a retained lock after `EACCES`, `EPERM`, or an I/O failure. Provide the
callback whenever cleanup failure must be observable.

The six methods, zero-byte `wx` lock file, wait and retry behavior, POSIX
`ctime`/Windows `mtime` staleness, same-process bookkeeping, and best-effort
exit cleanup are otherwise preserved. Issue
[npm/lockfile#30](https://github.com/npm/lockfile/issues/30) remains a protocol
limitation: different callers can choose conflicting stale thresholds because
the file contains no owner or policy metadata.

## TypeScript

First-party declarations are included. They model runtime success as
`undefined`, keep callbacks and optional arguments, and add no runtime code.
Remove redundant `@types/lockfile` declarations if they conflict, then run the
consumer's typecheck and packed-install tests.

## Migration checklist

1. Pin `@stackline/lockfile@1.0.5` directly or through the historical alias.
2. Perform a clean install and inspect the resolved production dependency tree.
3. Run all application tests on Node.js `>=14.17`.
4. Exercise contention, timeout, retry, stale takeover, already-missing unlock,
   non-`ENOENT` unlock failure, and abrupt-process cleanup on each target OS.
5. Validate the real filesystem or network mount; local-disk results do not
   prove NFS or cross-host behavior.
6. Confirm application policy for a surfaced asynchronous cleanup error.
