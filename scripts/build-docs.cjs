'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const source = path.join(root, 'docs-site')
const output = path.join(root, 'site-dist')

assert.strictEqual(path.dirname(output), root, 'documentation output stays inside the package root')

const siteFiles = [
  'app.js',
  'index.html',
  'llms-full.txt',
  'llms.txt',
  'robots.txt',
  'sitemap.xml',
  'styles.css'
]

const rootFiles = [
  'CHANGELOG.md',
  'COMPATIBILITY_CONTRACT.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'MIGRATION.md',
  'NOTICE',
  'PUBLISHING.md',
  'README.md',
  'SECURITY.md',
  'THIRD_PARTY_LICENSES.md'
]

fs.rmSync(output, { recursive: true, force: true })
fs.mkdirSync(output)

siteFiles.forEach(file => fs.copyFileSync(path.join(source, file), path.join(output, file)))
rootFiles.forEach(file => fs.copyFileSync(path.join(root, file), path.join(output, file)))

const inventory = fs.readdirSync(output).sort()
assert.deepStrictEqual(inventory, siteFiles.concat(rootFiles).sort())
process.stdout.write(`documentation build: pass (${inventory.length} files)\n`)
