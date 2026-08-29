'use strict'

const lockfile = require(process.argv[2])
const lockPath = process.argv[3]
const mode = process.argv[4]

if (!lockPath || (mode !== 'normal' && mode !== 'hold')) {
  throw new Error('usage: lock-holder.cjs <module> <lock-path> <normal|hold>')
}

lockfile.lockSync(lockPath)
process.stdout.write('LOCKED\n')

if (mode === 'normal') {
  setTimeout(function () {}, 250)
} else {
  setInterval(function () {}, 1000)
}
