'use strict'

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const candidate = require('../lockfile.js')
const upstream = require('lockfile-upstream')

const implementations = [
  { name: 'candidate', value: candidate },
  { name: 'upstream', value: upstream }
]

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-lockfile-run-'))
const tests = []
let pathSequence = 0

function test (name, fn) {
  tests.push({ name: name, fn: fn })
}

function delay (milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds)
  })
}

function testPath (label, implementation) {
  pathSequence += 1
  var safeLabel = label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  return path.join(temporaryRoot, safeLabel + '-' + implementation + '-' + pathSequence)
}

function removeTree (target) {
  var stat
  try {
    stat = fs.lstatSync(target)
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }

  if (stat.isDirectory() && !stat.isSymbolicLink()) {
    fs.readdirSync(target).forEach(function (entry) {
      removeTree(path.join(target, entry))
    })
    fs.rmdirSync(target)
    return
  }

  fs.unlinkSync(target)
}

function callbackCall (implementation, method, args, timeout) {
  timeout = timeout || 5000
  return new Promise(function (resolve, reject) {
    var synchronous = true
    var started = Date.now()
    var timer = setTimeout(function () {
      reject(new Error(method + ' callback did not settle within ' + timeout + 'ms'))
    }, timeout)

    function callback () {
      clearTimeout(timer)
      resolve({
        args: Array.prototype.slice.call(arguments),
        elapsed: Date.now() - started,
        synchronous: synchronous
      })
    }

    try {
      implementation[method].apply(implementation, args.concat(callback))
    } catch (error) {
      clearTimeout(timer)
      reject(error)
    }
    synchronous = false
  })
}

function errorShape (error) {
  if (!error) return error
  return {
    code: error.code,
    name: error.name
  }
}

function callbackShape (call) {
  return {
    args: call.args.map(function (value) {
      return value instanceof Error ? errorShape(value) : value
    }),
    synchronous: call.synchronous
  }
}

function thrownShape (fn) {
  try {
    fn()
    return null
  } catch (error) {
    return errorShape(error)
  }
}

async function observeUnlock (implementation, injectedError, withCallback, unlinkSettlements) {
  var originalUnlink = fs.unlink
  var callbackCount = 0
  var callbackArgs
  var callbackWasSynchronous = null
  var synchronous = true

  fs.unlink = function (_target, callback) {
    process.nextTick(function () {
      var settlements = unlinkSettlements || 1
      for (var index = 0; index < settlements; index += 1) {
        callback(injectedError)
      }
    })
  }

  try {
    if (withCallback) {
      implementation.unlock(testPath('observed-unlock', 'shared'), function () {
        callbackCount += 1
        callbackArgs = Array.prototype.slice.call(arguments)
        callbackWasSynchronous = synchronous
      })
    } else {
      implementation.unlock(testPath('observed-unlock-no-callback', 'shared'))
    }
    synchronous = false
    await delay(25)
  } finally {
    fs.unlink = originalUnlink
  }

  return {
    args: callbackArgs,
    count: callbackCount,
    synchronous: callbackWasSynchronous
  }
}

async function observeStaleTakeoverUnlinkFailure (implementation, label, injectedError) {
  var target = testPath('stale-unlink-failure', label)
  var originalFiletime = implementation.filetime
  var originalUnlink = fs.unlink
  implementation.filetime = 'mtime'
  fs.writeFileSync(target, '')
  var old = new Date(Date.now() - 5000)
  fs.utimesSync(target, old, old)

  fs.unlink = function (unlinkedPath, callback) {
    if (unlinkedPath === target) {
      return process.nextTick(function () { callback(injectedError) })
    }
    return originalUnlink.call(fs, unlinkedPath, callback)
  }

  try {
    return await callbackCall(implementation, 'lock', [target, { stale: 50 }])
  } finally {
    fs.unlink = originalUnlink
    implementation.filetime = originalFiletime
    implementation.unlockSync(target)
    implementation.unlockSync(target + '.STALE')
  }
}

test('exports the complete six-method CommonJS API', function () {
  var expectedMethods = [
    'check',
    'checkSync',
    'lock',
    'lockSync',
    'unlock',
    'unlockSync'
  ]

  implementations.forEach(function (implementation) {
    expectedMethods.forEach(function (method) {
      assert.strictEqual(typeof implementation.value[method], 'function', implementation.name + ' ' + method)
    })
    assert.strictEqual(typeof implementation.value.filetime, 'string')
  })
})

test('differentially preserves all six basic API results and callback timing', async function () {
  var outcomes = []

  for (var index = 0; index < implementations.length; index += 1) {
    var implementation = implementations[index]
    var value = implementation.value
    var target = testPath('basic-api', implementation.name)
    var outcome = {}

    var missingCheck = await callbackCall(value, 'check', [target])
    assert.deepStrictEqual(missingCheck.args, [null, false])
    assert.strictEqual(missingCheck.synchronous, false)
    outcome.missingCheck = callbackShape(missingCheck)
    outcome.missingCheckSync = value.checkSync(target)

    var acquired = await callbackCall(value, 'lock', [target])
    assert.strictEqual(acquired.args.length, 0)
    assert.strictEqual(acquired.synchronous, false)
    outcome.acquired = callbackShape(acquired)

    var presentCheck = await callbackCall(value, 'check', [target])
    assert.deepStrictEqual(presentCheck.args, [null, true])
    outcome.presentCheck = callbackShape(presentCheck)
    outcome.presentCheckSync = value.checkSync(target)

    var contention = await callbackCall(value, 'lock', [target])
    assert.strictEqual(contention.args.length, 1)
    assert.strictEqual(contention.args[0].code, 'EEXIST')
    outcome.contention = callbackShape(contention)

    var released = await callbackCall(value, 'unlock', [target])
    assert.strictEqual(released.args.length, 0)
    assert.strictEqual(released.synchronous, false)
    outcome.released = callbackShape(released)
    outcome.afterRelease = value.checkSync(target)

    value.lockSync(target)
    outcome.syncLocked = value.checkSync(target)
    outcome.syncContention = thrownShape(function () {
      value.lockSync(target)
    })
    value.unlockSync(target)
    outcome.syncReleased = value.checkSync(target)
    assert.doesNotThrow(function () {
      value.unlockSync(target)
    })

    outcomes.push(outcome)
  }

  assert.deepStrictEqual(outcomes[0], outcomes[1])
  assert.deepStrictEqual(outcomes[0], {
    missingCheck: { args: [null, false], synchronous: false },
    missingCheckSync: false,
    acquired: { args: [], synchronous: false },
    presentCheck: { args: [null, true], synchronous: false },
    presentCheckSync: true,
    contention: { args: [{ code: 'EEXIST', name: 'Error' }], synchronous: false },
    released: { args: [], synchronous: false },
    afterRelease: false,
    syncLocked: true,
    syncContention: { code: 'EEXIST', name: 'Error' },
    syncReleased: false
  })
})

test('issue #18 is the only unlock differential', async function () {
  var permissionError = new Error('injected unlink permission failure')
  permissionError.code = 'EPERM'

  var candidateFailure = await observeUnlock(candidate, permissionError, true)
  assert.strictEqual(candidateFailure.count, 1)
  assert.strictEqual(candidateFailure.args.length, 1)
  assert.strictEqual(candidateFailure.args[0], permissionError)
  assert.strictEqual(candidateFailure.synchronous, false)

  var candidateDuplicateFsSettlement = await observeUnlock(candidate, permissionError, true, 2)
  assert.strictEqual(candidateDuplicateFsSettlement.count, 1)
  assert.strictEqual(candidateDuplicateFsSettlement.args[0], permissionError)

  var candidateStaleFailure = await observeStaleTakeoverUnlinkFailure(candidate, 'candidate', permissionError)
  assert.strictEqual(candidateStaleFailure.args.length, 1)
  assert.strictEqual(candidateStaleFailure.args[0], permissionError)

  var upstreamStaleFailure = await observeStaleTakeoverUnlinkFailure(upstream, 'upstream', permissionError)
  assert.strictEqual(upstreamStaleFailure.args.length, 1)
  assert.notStrictEqual(upstreamStaleFailure.args[0], permissionError)
  assert.strictEqual(upstreamStaleFailure.args[0].code, 'EEXIST')

  var upstreamFailure = await observeUnlock(upstream, permissionError, true)
  assert.strictEqual(upstreamFailure.count, 1)
  assert.strictEqual(upstreamFailure.args.length, 0)
  assert.strictEqual(upstreamFailure.synchronous, false)

  var notFoundError = new Error('injected missing lock')
  notFoundError.code = 'ENOENT'
  var candidateMissing = await observeUnlock(candidate, notFoundError, true)
  var upstreamMissing = await observeUnlock(upstream, notFoundError, true)
  assert.deepStrictEqual(candidateMissing, upstreamMissing)
  assert.deepStrictEqual(candidateMissing, { args: [], count: 1, synchronous: false })

  var candidateNoCallback = await observeUnlock(candidate, permissionError, false)
  var upstreamNoCallback = await observeUnlock(upstream, permissionError, false)
  assert.deepStrictEqual(candidateNoCallback, upstreamNoCallback)
  assert.deepStrictEqual(candidateNoCallback, { args: undefined, count: 0, synchronous: null })

  var originalUnlinkSync = fs.unlinkSync
  fs.unlinkSync = function () {
    throw permissionError
  }
  try {
    assert.doesNotThrow(function () { candidate.unlockSync('candidate-sync-suppression') })
    assert.doesNotThrow(function () { upstream.unlockSync('upstream-sync-suppression') })
  } finally {
    fs.unlinkSync = originalUnlinkSync
  }
})

test('issue #37 preserves undefined success callbacks and null check success', async function () {
  for (var index = 0; index < implementations.length; index += 1) {
    var implementation = implementations[index]
    var target = testPath('callback-values', implementation.name)

    var lockCall = await callbackCall(implementation.value, 'lock', [target])
    assert.strictEqual(lockCall.args.length, 0)
    assert.strictEqual(lockCall.args[0], undefined)

    var checkCall = await callbackCall(implementation.value, 'check', [target])
    assert.strictEqual(checkCall.args.length, 2)
    assert.strictEqual(checkCall.args[0], null)
    assert.strictEqual(checkCall.args[1], true)

    var unlockCall = await callbackCall(implementation.value, 'unlock', [target])
    assert.strictEqual(unlockCall.args.length, 0)
    assert.strictEqual(unlockCall.args[0], undefined)
  }
})

test('propagates original lock, check, fstat, and close errors identically', async function () {
  for (var index = 0; index < implementations.length; index += 1) {
    var implementation = implementations[index]
    var value = implementation.value
    var target = testPath('error-identity', implementation.name)
    var originalOpen = fs.open
    var openError = new Error('injected open error')
    openError.code = 'EACCES'

    fs.open = function (_target, _flags, callback) {
      process.nextTick(function () { callback(openError) })
    }
    try {
      var checkOpenFailure = await callbackCall(value, 'check', [target])
      assert.strictEqual(checkOpenFailure.args[0], openError)
      assert.strictEqual(checkOpenFailure.args.length, 1)

      var lockOpenFailure = await callbackCall(value, 'lock', [target])
      assert.strictEqual(lockOpenFailure.args[0], openError)
      assert.strictEqual(lockOpenFailure.args.length, 1)
    } finally {
      fs.open = originalOpen
    }

    fs.writeFileSync(target, '')
    var originalFstat = fs.fstat
    var originalClose = fs.close
    var fstatError = new Error('injected fstat error')
    fstatError.code = 'EIO'
    var closeCount = 0

    fs.fstat = function (_fd, callback) {
      process.nextTick(function () { callback(fstatError) })
    }
    fs.close = function (fd, callback) {
      closeCount += 1
      originalClose.call(fs, fd, callback)
    }
    try {
      var fstatFailure = await callbackCall(value, 'check', [target, { stale: 1000 }])
      assert.strictEqual(fstatFailure.args[0], fstatError)
      assert.strictEqual(fstatFailure.args.length, 1)
      assert.strictEqual(closeCount, 1)
    } finally {
      fs.fstat = originalFstat
      fs.close = originalClose
    }

    var closeError = new Error('injected close error')
    closeError.code = 'EIO'
    fs.close = function (fd, callback) {
      originalClose.call(fs, fd, function () {
        callback(closeError)
      })
    }
    try {
      var closeFailure = await callbackCall(value, 'check', [target])
      assert.strictEqual(closeFailure.args[0], closeError)
      assert.strictEqual(closeFailure.args[1], true)
    } finally {
      fs.close = originalClose
    }

    fs.unlinkSync(target)
  }
})

test('differentially preserves retry and retryWait counts and bounds', async function () {
  var outcomes = []

  for (var index = 0; index < implementations.length; index += 1) {
    var implementation = implementations[index]
    var value = implementation.value
    var target = testPath('async-retries', implementation.name)
    var originalOpen = fs.open
    var calls = 0
    var injectedError = new Error('retry me')
    injectedError.code = 'EACCES'
    var options = { retries: 2, retryWait: 20 }

    fs.open = function (openedPath, flags, callback) {
      calls += 1
      if (calls <= 2) {
        return process.nextTick(function () { callback(injectedError) })
      }
      return originalOpen.call(fs, openedPath, flags, callback)
    }

    var call
    try {
      call = await callbackCall(value, 'lock', [target, options])
    } finally {
      fs.open = originalOpen
    }

    assert.deepStrictEqual(call.args, [undefined, undefined])
    assert.strictEqual(calls, 3)
    assert.ok(call.elapsed >= 30, 'two retry waits should be observable, got ' + call.elapsed + 'ms')
    assert.ok(call.elapsed < 1500, 'retry path should stay bounded, got ' + call.elapsed + 'ms')
    assert.strictEqual(options.retries, 0)
    assert.strictEqual(typeof options.req, 'number')
    assert.strictEqual(typeof options.start, 'number')
    value.unlockSync(target)

    var immediateTarget = testPath('async-immediate-retries', implementation.name)
    var immediateCalls = 0
    var immediateOptions = { retries: 2 }
    fs.open = function (openedPath, flags, callback) {
      immediateCalls += 1
      if (immediateCalls <= 2) {
        return process.nextTick(function () { callback(injectedError) })
      }
      return originalOpen.call(fs, openedPath, flags, callback)
    }

    var immediateCall
    try {
      immediateCall = await callbackCall(value, 'lock', [immediateTarget, immediateOptions])
    } finally {
      fs.open = originalOpen
    }
    assert.strictEqual(immediateCalls, 3)
    assert.deepStrictEqual(immediateCall.args, [undefined, undefined])
    assert.strictEqual(immediateOptions.retries, 0)
    value.unlockSync(immediateTarget)

    outcomes.push({
      calls: calls,
      callback: callbackShape(call),
      retries: options.retries,
      immediateCalls: immediateCalls,
      immediateCallback: callbackShape(immediateCall)
    })
  }

  assert.deepStrictEqual(outcomes[0], outcomes[1])
})

test('differentially preserves stale stat disappearance and error identity', async function () {
  var outcomes = []

  for (var index = 0; index < implementations.length; index += 1) {
    var implementation = implementations[index]
    var value = implementation.value
    var target = testPath('stale-stat-errors', implementation.name)
    var originalOpen = fs.open
    var originalStat = fs.stat
    var openCalls = 0
    var missing = new Error('injected stale path disappeared')
    missing.code = 'ENOENT'

    fs.open = function (openedPath, flags, callback) {
      openCalls += 1
      if (openCalls === 1) {
        var exists = new Error('injected contention')
        exists.code = 'EEXIST'
        return process.nextTick(function () { callback(exists) })
      }
      return originalOpen.call(fs, openedPath, flags, callback)
    }
    fs.stat = function (_target, callback) {
      process.nextTick(function () { callback(missing) })
    }

    var disappeared
    try {
      disappeared = await callbackCall(value, 'lock', [target, { stale: 10 }])
    } finally {
      fs.open = originalOpen
      fs.stat = originalStat
    }
    assert.strictEqual(openCalls, 2)
    assert.strictEqual(disappeared.args.length, 0)
    value.unlockSync(target)

    var statError = new Error('injected stale stat I/O failure')
    statError.code = 'EIO'
    fs.open = function (_target, _flags, callback) {
      var exists = new Error('injected contention')
      exists.code = 'EEXIST'
      process.nextTick(function () { callback(exists) })
    }
    fs.stat = function (_target, callback) {
      process.nextTick(function () { callback(statError) })
    }

    var failed
    try {
      failed = await callbackCall(value, 'lock', [target, { stale: 10 }])
    } finally {
      fs.open = originalOpen
      fs.stat = originalStat
    }
    assert.strictEqual(failed.args.length, 1)
    assert.strictEqual(failed.args[0], statError)

    outcomes.push({
      disappeared: callbackShape(disappeared),
      statErrorCode: failed.args[0].code,
      statErrorIdentity: failed.args[0] === statError
    })
  }

  assert.deepStrictEqual(outcomes[0], outcomes[1])
})

test('differentially preserves synchronous retry count', function () {
  var outcomes = []

  implementations.forEach(function (implementation) {
    var value = implementation.value
    var target = testPath('sync-retries', implementation.name)
    var originalOpenSync = fs.openSync
    var calls = 0
    var injectedError = new Error('retry sync')
    injectedError.code = 'EACCES'
    var options = { retries: 2 }

    fs.openSync = function (openedPath, flags) {
      calls += 1
      if (calls <= 2) throw injectedError
      return originalOpenSync.call(fs, openedPath, flags)
    }
    try {
      value.lockSync(target, options)
    } finally {
      fs.openSync = originalOpenSync
    }

    assert.strictEqual(calls, 3)
    assert.strictEqual(options.retries, 0)
    value.unlockSync(target)
    outcomes.push({ calls: calls, retries: options.retries })
  })

  assert.deepStrictEqual(outcomes[0], outcomes[1])
})

test('differentially preserves wait and pollPeriod timeout and success behavior', async function () {
  var outcomes = []

  for (var index = 0; index < implementations.length; index += 1) {
    var implementation = implementations[index]
    var value = implementation.value
    var timeoutTarget = testPath('wait-timeout', implementation.name)
    fs.writeFileSync(timeoutTarget, '')

    var timedOut = await callbackCall(value, 'lock', [timeoutTarget, {
      wait: 80,
      pollPeriod: 10
    }])
    assert.strictEqual(timedOut.args.length, 1)
    assert.strictEqual(timedOut.args[0].code, 'EEXIST')
    assert.ok(timedOut.elapsed >= 60, 'wait ended too early: ' + timedOut.elapsed + 'ms')
    assert.ok(timedOut.elapsed < 1000, 'wait exceeded bound: ' + timedOut.elapsed + 'ms')
    fs.unlinkSync(timeoutTarget)

    var successTarget = testPath('wait-success', implementation.name)
    value.lockSync(successTarget)
    var releaseTimer = setTimeout(function () {
      value.unlockSync(successTarget)
    }, 35)
    var waited = await callbackCall(value, 'lock', [successTarget, {
      wait: 500,
      pollPeriod: 5
    }])
    clearTimeout(releaseTimer)
    assert.strictEqual(waited.args.length, 0)
    assert.ok(waited.elapsed >= 20, 'contender should have waited for release')
    assert.ok(waited.elapsed < 1000)
    value.unlockSync(successTarget)

    outcomes.push({
      timeoutCode: timedOut.args[0].code,
      timeoutSynchronous: timedOut.synchronous,
      waitedArgs: waited.args.length,
      waitedSynchronous: waited.synchronous
    })
  }

  assert.deepStrictEqual(outcomes[0], outcomes[1])
})

test('characterizes stale takeover and requester-controlled stale values from issue #30', async function () {
  var outcomes = []

  for (var index = 0; index < implementations.length; index += 1) {
    var implementation = implementations[index]
    var value = implementation.value
    var originalFiletime = value.filetime
    value.filetime = 'mtime'

    try {
      var staleTarget = testPath('stale-async', implementation.name)
      fs.writeFileSync(staleTarget, '')
      var old = new Date(Date.now() - 5000)
      fs.utimesSync(staleTarget, old, old)

      var staleCheck = await callbackCall(value, 'check', [staleTarget, { stale: 50 }])
      assert.deepStrictEqual(staleCheck.args, [null, false])
      assert.strictEqual(value.checkSync(staleTarget, { stale: 50 }), false)

      var staleAcquire = await callbackCall(value, 'lock', [staleTarget, { stale: 50 }])
      assert.deepStrictEqual(staleAcquire.args, [null])
      value.unlockSync(staleTarget)

      var staleSyncTarget = testPath('stale-sync', implementation.name)
      fs.writeFileSync(staleSyncTarget, '')
      fs.utimesSync(staleSyncTarget, old, old)
      value.lockSync(staleSyncTarget, { stale: 50 })
      value.unlockSync(staleSyncTarget)

      var conflictingTarget = testPath('conflicting-stale', implementation.name)
      var firstLock = await callbackCall(value, 'lock', [conflictingTarget, { stale: 10000 }])
      assert.strictEqual(firstLock.args.length, 0)
      var conflictingAge = new Date(Date.now() - 3000)
      fs.utimesSync(conflictingTarget, conflictingAge, conflictingAge)
      assert.strictEqual(value.checkSync(conflictingTarget, { stale: 10000 }), true)

      var secondLock = await callbackCall(value, 'lock', [conflictingTarget, { stale: 2000 }])
      assert.deepStrictEqual(secondLock.args, [null], 'smaller requester threshold takes over by design')
      value.unlockSync(conflictingTarget)

      outcomes.push({
        staleCheck: callbackShape(staleCheck),
        staleAcquire: callbackShape(staleAcquire),
        issue30SecondAcquire: callbackShape(secondLock)
      })
    } finally {
      value.filetime = originalFiletime
    }
  }

  assert.deepStrictEqual(outcomes[0], outcomes[1])
})

test('characterizes issue #19 as existence of the supplied lock path', async function () {
  var outcomes = []

  for (var index = 0; index < implementations.length; index += 1) {
    var implementation = implementations[index]
    var value = implementation.value
    var target = testPath('issue-19', implementation.name)
    fs.writeFileSync(target, 'ordinary existing file')

    var existing = await callbackCall(value, 'check', [target])
    var existingSync = value.checkSync(target)
    fs.unlinkSync(target)
    var missing = await callbackCall(value, 'check', [target])
    var missingSync = value.checkSync(target)

    assert.deepStrictEqual(existing.args, [null, true])
    assert.strictEqual(existingSync, true)
    assert.deepStrictEqual(missing.args, [null, false])
    assert.strictEqual(missingSync, false)
    outcomes.push({
      existing: callbackShape(existing),
      existingSync: existingSync,
      missing: callbackShape(missing),
      missingSync: missingSync
    })
  }

  assert.deepStrictEqual(outcomes[0], outcomes[1])
})

test('differentially preserves symlink and dangling-symlink behavior', async function () {
  var probeTarget = testPath('symlink-probe-target', 'shared')
  var probeLink = testPath('symlink-probe-link', 'shared')
  fs.writeFileSync(probeTarget, '')
  try {
    fs.symlinkSync(probeTarget, probeLink, 'file')
  } catch (error) {
    fs.unlinkSync(probeTarget)
    if (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'ENOSYS') {
      return
    }
    throw error
  }
  fs.unlinkSync(probeLink)
  fs.unlinkSync(probeTarget)

  var outcomes = []
  for (var index = 0; index < implementations.length; index += 1) {
    var implementation = implementations[index]
    var value = implementation.value
    var target = testPath('symlink-target', implementation.name)
    var link = testPath('symlink-link', implementation.name)
    var dangling = testPath('symlink-dangling', implementation.name)
    fs.writeFileSync(target, '')
    fs.symlinkSync(target, link, 'file')
    fs.symlinkSync(target + '-missing', dangling, 'file')

    var linkedCheck = await callbackCall(value, 'check', [link])
    var linkedContention = await callbackCall(value, 'lock', [link])
    var danglingCheck = await callbackCall(value, 'check', [dangling])
    var danglingContention = await callbackCall(value, 'lock', [dangling])

    assert.deepStrictEqual(linkedCheck.args, [null, true])
    assert.strictEqual(value.checkSync(link), true)
    assert.strictEqual(linkedContention.args[0].code, 'EEXIST')
    assert.deepStrictEqual(danglingCheck.args, [null, false])
    assert.strictEqual(value.checkSync(dangling), false)
    assert.strictEqual(danglingContention.args[0].code, 'EEXIST')

    outcomes.push({
      linkedCheck: callbackShape(linkedCheck),
      linkedContention: callbackShape(linkedContention),
      danglingCheck: callbackShape(danglingCheck),
      danglingContention: callbackShape(danglingContention)
    })
    fs.unlinkSync(link)
    fs.unlinkSync(dangling)
    fs.unlinkSync(target)
  }

  assert.deepStrictEqual(outcomes[0], outcomes[1])
})

test('differentially preserves malformed and unsupported option behavior', async function () {
  var outcomes = []

  for (var index = 0; index < implementations.length; index += 1) {
    var implementation = implementations[index]
    var value = implementation.value
    var target = testPath('malformed-options', implementation.name)
    fs.writeFileSync(target, '')

    var outcome = {
      checkSyncWait: thrownShape(function () {
        value.checkSync(target, { wait: 1 })
      }),
      lockSyncWait: thrownShape(function () {
        value.lockSync(target, { wait: 1 })
      }),
      lockSyncRetryWait: thrownShape(function () {
        value.lockSync(target, { retryWait: 1 })
      }),
      lockNullOptions: thrownShape(function () {
        value.lock(target + '-null', null, function () {})
      })
    }

    var malformedNumericOptions = await callbackCall(value, 'lock', [target, {
      pollPeriod: 'ten',
      retries: 'two',
      retryWait: 'ten',
      stale: NaN,
      wait: 'eighty'
    }])
    assert.strictEqual(malformedNumericOptions.args[0].code, 'EEXIST')
    outcome.malformedNumericOptions = callbackShape(malformedNumericOptions)

    fs.unlinkSync(target)
    outcomes.push(outcome)
  }

  assert.deepStrictEqual(outcomes[0], outcomes[1])
  assert.deepStrictEqual(outcomes[0].checkSyncWait, { code: undefined, name: 'Error' })
  assert.deepStrictEqual(outcomes[0].lockSyncWait, { code: undefined, name: 'Error' })
  assert.deepStrictEqual(outcomes[0].lockSyncRetryWait, { code: undefined, name: 'Error' })
  assert.deepStrictEqual(outcomes[0].lockNullOptions, { code: undefined, name: 'TypeError' })
})

async function main () {
  var failures = 0
  console.log('TAP version 13')

  for (var index = 0; index < tests.length; index += 1) {
    var current = tests[index]
    try {
      await current.fn()
      console.log('ok ' + (index + 1) + ' - ' + current.name)
    } catch (error) {
      failures += 1
      console.log('not ok ' + (index + 1) + ' - ' + current.name)
      console.log('  ---')
      String(error && error.stack || error).split('\n').forEach(function (line) {
        console.log('  ' + line)
      })
      console.log('  ...')
    }
  }

  console.log('1..' + tests.length)
  removeTree(temporaryRoot)
  if (failures) process.exitCode = 1
}

main().catch(function (error) {
  try { removeTree(temporaryRoot) } catch (_) {}
  console.error(error && error.stack || error)
  process.exitCode = 1
})
