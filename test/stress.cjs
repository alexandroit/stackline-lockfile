'use strict'

const assert = require('assert')
const childProcess = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const candidate = require('../lockfile.js')
const upstream = require('lockfile-upstream')

const candidatePath = require.resolve('../lockfile.js')
const holderFixture = path.join(__dirname, 'fixtures', 'lock-holder.cjs')
const workerFixture = path.join(__dirname, 'fixtures', 'lock-worker.cjs')
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-lockfile-stress-'))
const implementations = [
  { name: 'candidate', value: candidate },
  { name: 'upstream', value: upstream }
]
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

function testPath (label) {
  pathSequence += 1
  return path.join(temporaryRoot, label.replace(/[^a-z0-9]+/gi, '-') + '-' + pathSequence)
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
    var timer = setTimeout(function () {
      reject(new Error(method + ' callback did not settle within ' + timeout + 'ms'))
    }, timeout)

    function callback () {
      clearTimeout(timer)
      resolve(Array.prototype.slice.call(arguments))
    }

    try {
      implementation[method].apply(implementation, args.concat(callback))
    } catch (error) {
      clearTimeout(timer)
      reject(error)
    }
  })
}

function spawnHolder (lockPath, mode) {
  var child = childProcess.spawn(process.execPath, [
    holderFixture,
    candidatePath,
    lockPath,
    mode
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  })
  var stdout = ''
  var stderr = ''
  var readySettled = false
  var readyTimer

  var exited = new Promise(function (resolve) {
    child.once('exit', function (code, signal) {
      resolve({ code: code, signal: signal, stderr: stderr, stdout: stdout })
    })
  })

  var ready = new Promise(function (resolve, reject) {
    readyTimer = setTimeout(function () {
      if (readySettled) return
      readySettled = true
      reject(new Error('holder did not report LOCKED within 5 seconds; stderr=' + stderr))
    }, 5000)

    child.stdout.on('data', function (chunk) {
      stdout += chunk.toString()
      if (!readySettled && stdout.indexOf('LOCKED\n') !== -1) {
        readySettled = true
        clearTimeout(readyTimer)
        resolve()
      }
    })
    child.stderr.on('data', function (chunk) {
      stderr += chunk.toString()
    })
    child.once('exit', function (code, signal) {
      if (readySettled) return
      readySettled = true
      clearTimeout(readyTimer)
      reject(new Error('holder exited before LOCKED: code=' + code + ' signal=' + signal + ' stderr=' + stderr))
    })
  })

  return { child: child, exited: exited, ready: ready }
}

function spawnWorker (lockPath, guardPath, iterations) {
  return new Promise(function (resolve, reject) {
    var child = childProcess.spawn(process.execPath, [
      workerFixture,
      candidatePath,
      lockPath,
      guardPath,
      String(iterations)
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    var stdout = ''
    var stderr = ''
    var timedOut = false
    var timer = setTimeout(function () {
      timedOut = true
      try { child.kill('SIGKILL') } catch (_) {}
    }, 20000)

    child.stdout.on('data', function (chunk) {
      stdout += chunk.toString()
    })
    child.stderr.on('data', function (chunk) {
      stderr += chunk.toString()
    })
    child.once('error', function (error) {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', function (code, signal) {
      clearTimeout(timer)
      if (timedOut) {
        return reject(new Error('worker timed out; stdout=' + stdout + ' stderr=' + stderr))
      }
      resolve({ code: code, signal: signal, stderr: stderr, stdout: stdout })
    })
  })
}

async function ensureHolderStopped (holder) {
  if (holder.child.exitCode === null && holder.child.signalCode === null) {
    try { holder.child.kill('SIGKILL') } catch (_) {}
  }
  await holder.exited
}

test('serializes independent processes without overlapping critical sections', async function () {
  var lockPath = testPath('contention.lock')
  var guardPath = testPath('contention.guard')
  var workerCount = 6
  var iterations = 12
  var workers = []

  for (var index = 0; index < workerCount; index += 1) {
    workers.push(spawnWorker(lockPath, guardPath, iterations))
  }

  var results = await Promise.all(workers)
  results.forEach(function (result) {
    assert.strictEqual(result.code, 0, result.stderr)
    assert.strictEqual(result.signal, null)
    assert.strictEqual(result.stdout, 'DONE ' + String(iterations) + '\n')
  })
  assert.strictEqual(fs.existsSync(lockPath), false)
  assert.strictEqual(fs.existsSync(guardPath), false)
})

test('removes held locks during normal child exit', async function () {
  var lockPath = testPath('normal-exit.lock')
  var holder = spawnHolder(lockPath, 'normal')
  try {
    await holder.ready
    assert.strictEqual(fs.existsSync(lockPath), true)
    var result = await holder.exited
    assert.strictEqual(result.code, 0, result.stderr)
    assert.strictEqual(result.signal, null)
    await delay(25)
    assert.strictEqual(fs.existsSync(lockPath), false)
  } finally {
    await ensureHolderStopped(holder)
  }
})

test('removes held locks during SIGTERM on platforms with POSIX signals', async function () {
  if (process.platform === 'win32') return
  var lockPath = testPath('sigterm.lock')
  var holder = spawnHolder(lockPath, 'hold')
  try {
    await holder.ready
    assert.strictEqual(fs.existsSync(lockPath), true)
    assert.strictEqual(holder.child.kill('SIGTERM'), true)
    var result = await holder.exited
    assert.ok(result.signal === 'SIGTERM' || result.code === 143, result.stderr)
    await delay(25)
    assert.strictEqual(fs.existsSync(lockPath), false)
  } finally {
    await ensureHolderStopped(holder)
  }
})

test('leaves SIGKILL residue and permits explicit stale takeover', async function () {
  if (process.platform === 'win32') return
  var lockPath = testPath('sigkill.lock')
  var holder = spawnHolder(lockPath, 'hold')
  try {
    await holder.ready
    assert.strictEqual(fs.existsSync(lockPath), true)
    assert.strictEqual(holder.child.kill('SIGKILL'), true)
    var result = await holder.exited
    assert.strictEqual(result.signal, 'SIGKILL', result.stderr)
    assert.strictEqual(fs.existsSync(lockPath), true)

    var old = new Date(Date.now() - 5000)
    fs.utimesSync(lockPath, old, old)
    var originalFiletime = candidate.filetime
    candidate.filetime = 'mtime'
    try {
      candidate.lockSync(lockPath, { stale: 100 })
      assert.strictEqual(candidate.checkSync(lockPath), true)
      candidate.unlockSync(lockPath)
    } finally {
      candidate.filetime = originalFiletime
    }
    assert.strictEqual(fs.existsSync(lockPath), false)
  } finally {
    await ensureHolderStopped(holder)
  }
})

test('differentially preserves coarse timestamp rounding and future clock skew', function () {
  var outcomes = []
  var realDateNow = Date.now
  var base = 1700000000000

  implementations.forEach(function (implementation) {
    var value = implementation.value
    var originalFiletime = value.filetime
    var coarsePath = testPath('coarse-' + implementation.name + '.lock')
    var futurePath = testPath('future-' + implementation.name + '.lock')
    value.filetime = 'mtime'

    try {
      fs.writeFileSync(coarsePath, '')
      var coarseTime = new Date(base - 2000)
      fs.utimesSync(coarsePath, coarseTime, coarseTime)
      assert.strictEqual(fs.statSync(coarsePath).mtime.getTime() % 1000, 0)
      Date.now = function () { return base }

      var coarseOptions = { stale: 1501 }
      var coarseError
      try {
        value.lockSync(coarsePath, coarseOptions)
      } catch (error) {
        coarseError = error
      }
      assert.ok(coarseError)
      assert.strictEqual(coarseError.code, 'EEXIST')
      assert.strictEqual(coarseOptions.stale, 2000)
      fs.unlinkSync(coarsePath)

      fs.writeFileSync(futurePath, '')
      var futureTime = new Date(base + 60000)
      fs.utimesSync(futurePath, futureTime, futureTime)
      assert.strictEqual(value.checkSync(futurePath, { stale: 1 }), true)
      var futureError
      try {
        value.lockSync(futurePath, { stale: 1 })
      } catch (error) {
        futureError = error
      }
      assert.ok(futureError)
      assert.strictEqual(futureError.code, 'EEXIST')
      fs.unlinkSync(futurePath)

      outcomes.push({
        coarseCode: coarseError.code,
        roundedStale: coarseOptions.stale,
        futureCode: futureError.code
      })
    } finally {
      Date.now = realDateNow
      value.filetime = originalFiletime
    }
  })

  assert.deepStrictEqual(outcomes[0], outcomes[1])
})

test('does not leak descriptors through repeated Linux check paths', async function () {
  if (process.platform !== 'linux' || !fs.existsSync('/proc/self/fd')) return

  for (var index = 0; index < implementations.length; index += 1) {
    var implementation = implementations[index]
    var target = testPath('fd-' + implementation.name + '.lock')
    fs.writeFileSync(target, '')
    var before = fs.readdirSync('/proc/self/fd').length

    for (var iteration = 0; iteration < 300; iteration += 1) {
      var checked = await callbackCall(implementation.value, 'check', [target, { stale: 60000 }])
      assert.strictEqual(checked[0], null)
      assert.strictEqual(checked[1], true)
      assert.strictEqual(implementation.value.checkSync(target, { stale: 60000 }), true)
    }

    await delay(25)
    var after = fs.readdirSync('/proc/self/fd').length
    assert.ok(after <= before + 2, implementation.name + ' leaked descriptors: before=' + before + ' after=' + after)
    fs.unlinkSync(target)
  }
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
