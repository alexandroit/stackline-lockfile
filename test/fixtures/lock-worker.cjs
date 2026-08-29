'use strict'

const fs = require('fs')

const lockfile = require(process.argv[2])
const lockPath = process.argv[3]
const guardPath = process.argv[4]
const iterations = Number(process.argv[5])

if (!lockPath || !guardPath || !Number.isInteger(iterations) || iterations <= 0) {
  throw new Error('usage: lock-worker.cjs <module> <lock-path> <guard-path> <iterations>')
}

function delay (milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds)
  })
}

function acquire () {
  return new Promise(function (resolve, reject) {
    lockfile.lock(lockPath, { wait: 15000, pollPeriod: 4 }, function (error) {
      if (error) return reject(error)
      resolve()
    })
  })
}

function release () {
  return new Promise(function (resolve, reject) {
    lockfile.unlock(lockPath, function (error) {
      if (error) return reject(error)
      resolve()
    })
  })
}

async function main () {
  for (var index = 0; index < iterations; index += 1) {
    var acquired = false
    var guard = null
    try {
      await acquire()
      acquired = true
      guard = fs.openSync(guardPath, 'wx')
      fs.writeSync(guard, String(process.pid) + ':' + String(index))
      await delay(2 + ((process.pid + index) % 4))
      fs.closeSync(guard)
      guard = null
      fs.unlinkSync(guardPath)
      await release()
      acquired = false
    } catch (error) {
      if (guard !== null) {
        try { fs.closeSync(guard) } catch (_) {}
        try { fs.unlinkSync(guardPath) } catch (_) {}
      }
      if (acquired) {
        try { lockfile.unlockSync(lockPath) } catch (_) {}
      }
      throw error
    }
  }

  process.stdout.write('DONE ' + String(iterations) + '\n')
}

main().catch(function (error) {
  console.error(error && error.stack || error)
  process.exitCode = 1
})
