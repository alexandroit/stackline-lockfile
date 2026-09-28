# Changes

## [1.0.7] - 2026-09-28

- Organize package documentation, preserve API and migration examples, and add Stackline community links.
- Update development package-manager and SBOM tooling to patched pnpm, libxmljs2, and tar versions.
- Improve package discovery keywords with precise domain terms and `stackline`.
- Pin GitHub Actions release tooling and require an explicit missing-version response before publication.


## 1.0.6 - 2026-08-30

* Move the maintained process-exit integration from `signal-exit@3.0.7` to
  `signal-exit@4.1.0` and use its explicit CommonJS `onExit` export.
* Preserve normal-exit lock cleanup, signal handling, the Node 14.17 runtime
  floor, and the complete `lockfile@1.0.4` compatibility contract.
* Require clean direct and historical-alias production closures with zero
  install warnings and zero known vulnerabilities.


## 1.0.5 - 2026-08-29

First Stackline-maintained compatibility release.

* Preserve the six-method CommonJS API, zero-byte lock format, stale, wait,
  polling, retry, and signal-exit behavior from `lockfile@1.0.4`.
* Preserve asynchronous `ENOENT` unlock as an already-unlocked no-op.
* Forward the original non-`ENOENT` asynchronous unlink error exactly once
  instead of reporting false success while a lock file remains.
* Preserve synchronous unlock's historical best-effort error suppression.
* Add TypeScript declarations matching the runtime's `undefined` success
  callback value.
* Add maintained cross-platform, differential, contention, cleanup, packed
  consumer, alias-install, license, and package-quality gates.


## 1.0.4

* test parallel
* upgrade tap
* upgrade node versions in travis.yml
* Use signal-exit package to detect exit instead of process.on('exit')
* added some debugging lines

## v1.0.3

* handle the case where callback is not passed by user

## v1.0.2

* git ignore coverage and node_modules
* update tap to v7
* build a changelog
* package: fix repository link
* pass tests on 0.8
* before_script needs to be before_install
* tap 1.2.0 and travis

## v1.0.1

* isc license
* updated README.md

## v1.0.0

* Simulate staleness instead of waiting excessively
* whitespace
* manage 'retries' so it does not clash with 'wait' polling
* manage 'wait' timer properly
* Get rid of the excessive Object.create opts shadowing stuff
* failing test for the time taken for retries + wait options
* doc: add pollPeriod, correct opts.wait
* Fixed #6: polling period should be configurable

## v0.4.3

* Implement race-resistant stale lock detection
* set req id to 1 to start out

## v0.4.2

* stale option fix for windows file tunneling

## v0.4.1

* Fix version parsing

## v0.4.0

* Don't keep lockfiles open

## v0.3.4

* retry more aggressively

## v0.3.3

* Add debugging function

## v0.3.2

* remove console.error

## v0.3.1

* Support lack of subsecond fs precision
* Fix error closure overwriting in notStale

## v0.3.0

* Use polling instead of watchers
* Add more overhead buffer to contention test

## v0.2.2

* Fix wait calculation
* fixup
* Style: prefer early return to giant if/else
* unlock: Close before unlinking
* Don't get tripped up by locks named 'hasOwnProperty'
* test: Pathological extreme lock contention
* refactor license

## 0.2.1

* Handle race conditions more thoroughly

## 0.2.0

* Rename to 'lockfile'

## 0.0.2

* Add retries
* bsd

## 0.0.1

* tests
* package.json
* the code
* first
