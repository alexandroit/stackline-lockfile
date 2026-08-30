'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const tarball = process.argv[2]
if (!tarball) throw new Error('usage: node scripts/check-packed.cjs <package.tgz>')

const absolute = path.resolve(tarball)
const bytes = fs.readFileSync(absolute)
const inventory = execFileSync('tar', ['-tzf', absolute], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .sort()

const expected = [
  'package/CHANGELOG.md',
  'package/LICENSE',
  'package/NOTICE',
  'package/README.md',
  'package/THIRD_PARTY_LICENSES.md',
  'package/lockfile.d.ts',
  'package/lockfile.js',
  'package/package.json'
].sort()

assert.deepStrictEqual(inventory, expected)

const packed = JSON.parse(execFileSync('tar', ['-xOzf', absolute, 'package/package.json'], { encoding: 'utf8' }))
assert.strictEqual(packed.name, '@stackline/lockfile')
assert.strictEqual(packed.version, '1.0.6')
assert.strictEqual(packed.main, 'lockfile.js')
assert.strictEqual(packed.types, 'lockfile.d.ts')

const hashes = {
  bytes: bytes.length,
  sha1: crypto.createHash('sha1').update(bytes).digest('hex'),
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  sha512: crypto.createHash('sha512').update(bytes).digest('hex')
}

process.stdout.write(`${JSON.stringify({ status: 'pass', inventory, hashes })}\n`)
