'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { spawn } = require('child_process')

const mode = process.argv[2]

if (mode === 'direct') {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const child = spawn(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
    env: Object.assign({}, process.env, {
      NPM_CONFIG_ACCESS: 'public',
      NPM_CONFIG_CAFILE: '',
      NPM_CONFIG_PROXY: 'false',
      NPM_CONFIG_HTTPS_PROXY: 'false',
      NPM_CONFIG_FETCH_RETRIES: '1',
      NPM_CONFIG_FETCH_TIMEOUT: '15000',
      npm_config_proxy: 'false',
      npm_config_https_proxy: 'false',
      NO_PROXY: '*'
    }),
    stdio: 'inherit'
  })
  child.on('error', error => { throw error })
  child.on('exit', code => {
    if (code !== 0) process.exit(code || 1)
    finishSmoke('@stackline/lockfile')
  })
} else {
  finishSmoke('lockfile')
}

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
  assert.strictEqual(metadata.version, '1.0.5')
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
