'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const destination = path.join(root, 'release-candidate')
const expectedName = 'stackline-lockfile-1.0.6.tgz'
const finalPath = path.join(destination, expectedName)

fs.mkdirSync(destination, { recursive: true })
if (fs.existsSync(finalPath)) throw new Error(`${finalPath} already exists; immutable artifact creation refuses to overwrite it`)

const first = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-lockfile-pack-a-'))
const second = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-lockfile-pack-b-'))
pack(first)
pack(second)

const firstBytes = fs.readFileSync(path.join(first, expectedName))
const secondBytes = fs.readFileSync(path.join(second, expectedName))
assert.strictEqual(hash(firstBytes, 'sha256'), hash(secondBytes, 'sha256'), 'two clean packs are reproducible')

fs.copyFileSync(path.join(first, expectedName), finalPath, fs.constants.COPYFILE_EXCL)
const bytes = fs.readFileSync(finalPath)
const inventory = execFileSync('tar', ['-tzf', finalPath], { encoding: 'utf8' }).trim().split('\n').sort()
const manifest = {
  schema: 'stackline-release-artifact-v1',
  package: '@stackline/lockfile',
  version: '1.0.6',
  filename: expectedName,
  bytes: bytes.length,
  sha1: hash(bytes, 'sha1'),
  sha256: hash(bytes, 'sha256'),
  sha512: hash(bytes, 'sha512'),
  integrity: `sha512-${crypto.createHash('sha512').update(bytes).digest('base64')}`,
  inventory,
  reproducibleTwoPack: true,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  createdAt: new Date().toISOString()
}

fs.writeFileSync(path.join(destination, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
fs.writeFileSync(path.join(destination, `${expectedName}.sha256`), `${manifest.sha256}  ${expectedName}\n`, { flag: 'wx' })
fs.writeFileSync(path.join(destination, `${expectedName}.sha512`), `${manifest.sha512}  ${expectedName}\n`, { flag: 'wx' })
process.stdout.write(`${JSON.stringify(manifest)}\n`)

function pack (directory) {
  execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', directory], {
    cwd: root,
    env: Object.assign({}, process.env, { NPM_CONFIG_CAFILE: '', NPM_CONFIG_ACCESS: 'public' }),
    stdio: ['ignore', 'pipe', 'inherit']
  })
}

function hash (bytes, algorithm) {
  return crypto.createHash(algorithm).update(bytes).digest('hex')
}
