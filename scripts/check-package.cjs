'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

assert.strictEqual(pkg.name, '@stackline/lockfile')
assert.strictEqual(pkg.version, '1.0.8')
assert.strictEqual(pkg.type, 'commonjs')
assert.strictEqual(pkg.main, 'lockfile.js')
assert.strictEqual(pkg.types, 'lockfile.d.ts')
assert.deepStrictEqual(pkg.engines, { node: '>=14.17' })
assert.deepStrictEqual(pkg.dependencies, { 'signal-exit': 'npm:@stackline/signal-exit@1.0.0' })
assert.strictEqual(pkg.license, 'ISC')
assert.strictEqual(pkg.publishConfig.access, 'public')
assert.strictEqual(pkg.repository.url, 'git+https://github.com/alexandroit/stackline-lockfile.git')
assert.strictEqual(pkg.homepage, 'https://alexandro.net/docs/vanilla/lockfile/')

for (const file of pkg.files) {
  assert.ok(fs.statSync(path.join(root, file)).isFile(), `packed file exists: ${file}`)
}

for (const file of [
  'COMPATIBILITY_CONTRACT.md',
  'CONTRIBUTING.md',
  'MIGRATION.md',
  'NOTICE',
  'PUBLISHING.md',
  'SECURITY.md',
  'THIRD_PARTY_LICENSES.md',
  'lockfile.d.ts',
  'lockfile.js'
]) {
  assert.ok(fs.statSync(path.join(root, file)).isFile(), `repository file exists: ${file}`)
}

const source = fs.readFileSync(path.join(root, 'lockfile.js'), 'utf8')
assert.match(source, /unlinkEr\.code\s*!==\s*['"]ENOENT['"]/, 'only ENOENT is suppressed asynchronously')
assert.match(source, /if\s*\(!cb\)\s*return/, 'callback remains optional')
assert.match(source, /var\s+callback\s*=\s*cb\s*\n\s*cb\s*=\s*null/, 'callback is consumed before settlement')
assert.match(source, /return\s+callback\(unlinkEr\)/, 'non-ENOENT error is forwarded with exact identity')
assert.match(source, /\n\s*callback\(\)\s*\n/, 'success and ENOENT preserve zero-argument settlement')
assert.match(source, /try\s*\{\s*fs\.unlinkSync\(path\)\s*\}\s*catch\s*\(er\)\s*\{\}/, 'sync best-effort behavior remains')
assert.match(source, /require\(['"]signal-exit['"]\)\.onExit/, 'signal-exit 4 named API is used')

for (const file of pkg.files.concat(['package.json'])) {
  const text = fs.readFileSync(path.join(root, file), 'utf8')
  assert.ok(!/stl_pat_[A-Za-z0-9_-]+/.test(text), `${file} contains no catalog credential`)
  assert.ok(!/(?:npm_|ghp_)[A-Za-z0-9]{20,}/.test(text), `${file} contains no registry credential`)
}

process.stdout.write('package metadata and inventory: pass\n')
