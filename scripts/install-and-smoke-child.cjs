'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const mode = process.argv[2]

finishSmoke(mode === 'direct-installed' ? '@stackline/lockfile' : 'lockfile')

function finishSmoke (specifier) {
  smoke(specifier).catch(error => {
    console.error(error.stack || error)
    process.exitCode = 1
  })
}

async function smoke (specifier) {
  const packageRoot = path.join(process.cwd(), 'node_modules', ...specifier.split('/'))
  const lockfile = require(packageRoot)
  const deepEntry = require(path.join(packageRoot, 'lockfile.js'))
  const metadata = require(path.join(packageRoot, 'package.json'))
  assert.strictEqual(metadata.name, '@stackline/lockfile')
  assert.strictEqual(metadata.version, '1.0.7')
  assert.strictEqual(deepEntry, lockfile)
  assert.strictEqual(fs.existsSync(path.join(packageRoot, 'lockfile.d.ts')), true)
  const imported = await import(pathToFileURL(path.join(packageRoot, 'lockfile.js')).href)
  assert.strictEqual(imported.default, lockfile)
  const target = path.resolve('consumer-smoke.lock')
  lockfile.unlockSync(target)
  lockfile.lockSync(target)
  assert.strictEqual(lockfile.checkSync(target), true)
  lockfile.unlockSync(target)
  assert.strictEqual(lockfile.checkSync(target), false)
  assert.strictEqual(fs.existsSync(target), false)
}
