'use strict'

var assert = require('assert')
var fs = require('fs')
var os = require('os')
var path = require('path')
var spawnSync = require('child_process').spawnSync
var pathToFileURL = require('url').pathToFileURL

var artifactDirectory = path.resolve(process.argv[2] || 'artifact')
var tarball = fs.readdirSync(artifactDirectory).filter(function (entry) {
  return /\.tgz$/.test(entry)
})

assert.strictEqual(tarball.length, 1, 'exactly one package tarball is present')

var workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-lockfile-packed-'))
var packagePath = path.join(workspace, 'package.json')
fs.writeFileSync(packagePath, JSON.stringify({ private: true }, null, 2) + '\n')

var install = spawnSync('npm', [
  'install',
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
  path.join(artifactDirectory, tarball[0])
], {
  cwd: workspace,
  env: Object.assign({}, process.env, {
    NPM_CONFIG_ACCESS: 'public',
    NPM_CONFIG_CAFILE: '',
    NPM_CONFIG_FETCH_RETRIES: '1',
    NPM_CONFIG_FETCH_TIMEOUT: '15000'
  }),
  shell: process.platform === 'win32',
  stdio: 'inherit'
})

if (install.error) throw install.error
if (install.status !== 0) process.exit(install.status || 1)

var packageRoot = path.join(workspace, 'node_modules', '@stackline', 'lockfile')
var lockfile = require(packageRoot)
var deepEntry = require(path.join(packageRoot, 'lockfile.js'))
var metadata = require(path.join(packageRoot, 'package.json'))
assert.strictEqual(metadata.name, '@stackline/lockfile')
assert.strictEqual(metadata.version, '1.0.7')
assert.strictEqual(deepEntry, lockfile)
assert.strictEqual(fs.existsSync(path.join(packageRoot, 'lockfile.d.ts')), true)
assert.strictEqual(typeof lockfile.lock, 'function')
assert.strictEqual(typeof lockfile.unlock, 'function')

var target = path.join(workspace, 'packed-consumer.lock')
lockfile.lockSync(target)
assert.strictEqual(lockfile.checkSync(target), true)
lockfile.unlockSync(target)
assert.strictEqual(lockfile.checkSync(target), false)

import(pathToFileURL(path.join(packageRoot, 'lockfile.js')).href).then(function (imported) {
  assert.strictEqual(imported.default, lockfile)

  var originalUnlink = fs.unlink
  var injected = new Error('packed consumer injected unlink error')
  injected.code = 'EPERM'
  fs.unlink = function (_target, callback) {
    process.nextTick(function () { callback(injected) })
  }

  lockfile.unlock(target, function (error) {
    fs.unlink = originalUnlink
    assert.strictEqual(error, injected)
    process.stdout.write(JSON.stringify({
      status: 'pass',
      node: process.version,
      platform: process.platform,
      package: metadata.name,
      version: metadata.version,
      commonjsRoot: true,
      deepEntry: true,
      esmDefaultInterop: true
    }) + '\n')
  })
}).catch(function (error) {
  console.error(error.stack || error)
  process.exitCode = 1
})
