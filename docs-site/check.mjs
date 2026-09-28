import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

var siteDir = path.dirname(fileURLToPath(import.meta.url))
var projectDir = path.resolve(siteDir, '..')

function read (base, name) {
  var file = path.join(base, name)
  if (!fs.existsSync(file)) throw new Error('Missing documentation file: ' + file)
  var value = fs.readFileSync(file, 'utf8')
  if (!value.trim()) throw new Error('Empty documentation file: ' + file)
  return value
}

function assert (condition, message) {
  if (!condition) throw new Error(message)
}

function includesAll (value, needles, label) {
  needles.forEach(function (needle) {
    assert(value.indexOf(needle) !== -1, label + ' is missing: ' + needle)
  })
}

var siteFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'llms-full.txt',
  'package-meta.json'
]

var rootFiles = [
  'README.md',
  'MIGRATION.md',
  'COMPATIBILITY_CONTRACT.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'PUBLISHING.md',
  'NOTICE',
  'THIRD_PARTY_LICENSES.md'
]

var site = {}
siteFiles.forEach(function (name) { site[name] = read(siteDir, name) })

var docs = {}
rootFiles.forEach(function (name) { docs[name] = read(projectDir, name) })

var html = site['index.html']
var visibleHtml = html.replace(/<!--\/?email_off-->/g, '')
var css = site['styles.css']
var app = site['app.js']
var robots = site['robots.txt']
var sitemap = site['sitemap.xml']
var llms = site['llms.txt']
var llmsFull = site['llms-full.txt']
var packageMetadata = JSON.parse(site['package-meta.json'])
var canonical = 'https://alexandro.net/docs/vanilla/lockfile/'

assert(packageMetadata.name === '@stackline/lockfile', 'package metadata identity is wrong')
assert(packageMetadata.version === '1.0.6', 'package metadata version is wrong')
assert(packageMetadata.runtimeFloor === 'Node.js 14.17.0', 'package metadata runtime floor is wrong')
assert(packageMetadata.moduleFormat === 'CommonJS', 'package metadata module format is wrong')
assert(packageMetadata.productionDependencies === 1, 'package metadata production dependency count is wrong')

includesAll(visibleHtml, [
  '<html lang="en">',
  '<link rel="canonical" href="' + canonical + '">',
  'Alexandro.Net',
  'Open Source',
  'href="#content"',
  '<main id="content" tabindex="-1">',
  '<nav class="top-nav" aria-label="Page navigation">',
  '<footer class="site-footer">',
  'aria-live="polite"',
  'role="img"',
  'aria-label="Acquire creates a zero-byte file',
  '<caption>',
  'npm install @stackline/lockfile@1.0.7',
  'npm install lockfile@npm:@stackline/lockfile@1.0.7',
  'Node.js ≥14.17',
  'TypeScript declarations',
  'non-<code>ENOENT</code>',
  'Issue 30 is not fixed',
  'NFS',
  'not affiliated with or endorsed by'
], 'index.html')

var methods = ['lock(', 'lockSync(', 'unlock(', 'unlockSync(', 'check(', 'checkSync(']
methods.forEach(function (method) {
  assert(visibleHtml.indexOf(method) !== -1, 'index.html is missing API method: ' + method)
  assert(docs['README.md'].indexOf(method) !== -1, 'README.md is missing API method: ' + method)
})

assert((html.match(/<h1(?:\s|>)/g) || []).length === 1, 'index.html must contain exactly one h1')
assert(html.length > 14000, 'index.html is unexpectedly thin')
assert(html.indexOf('http://') === -1, 'index.html contains an insecure http URL')
assert(html.indexOf('localhost') === -1, 'index.html contains localhost')
assert((html.match(/<!--email_off-->/g) || []).length === 5, 'index.html must protect five package-at-version strings from email obfuscation')
assert((html.match(/<!--\/email_off-->/g) || []).length === 5, 'index.html email protection markers must balance')

var jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
assert(jsonLdMatch, 'index.html is missing JSON-LD')
var jsonLd = JSON.parse(jsonLdMatch[1])
assert(jsonLd['@type'] === 'SoftwareSourceCode', 'JSON-LD type must be SoftwareSourceCode')
assert(jsonLd.name === '@stackline/lockfile', 'JSON-LD package identity is wrong')
assert(jsonLd.version === '1.0.6', 'JSON-LD package version is wrong')
assert(jsonLd.url === canonical, 'JSON-LD canonical URL is wrong')

includesAll(css, [
  ':focus-visible',
  'overflow-wrap: anywhere',
  'max-width: 100%',
  'min-width: 0',
  '@media (max-width:',
  '@media (prefers-reduced-motion: reduce)',
  '@media print'
], 'styles.css')

includesAll(app, [
  "'use strict'",
  '[data-copy-target]',
  'navigator.clipboard.writeText'
], 'app.js')

assert(robots.indexOf('Allow: /docs/vanilla/lockfile/') !== -1, 'robots.txt has the wrong allow path')
assert(robots.indexOf('Sitemap: ' + canonical + 'sitemap.xml') !== -1, 'robots.txt has the wrong sitemap')
assert(sitemap.indexOf('<loc>' + canonical + '</loc>') !== -1, 'sitemap.xml lacks the canonical route')
assert(sitemap.indexOf('http://') === sitemap.indexOf('http://www.sitemaps.org/schema'), 'sitemap.xml contains an unexpected insecure URL')

var locations = []
var locationPattern = /<loc>([^<]+)<\/loc>/g
var locationMatch
while ((locationMatch = locationPattern.exec(sitemap))) locations.push(locationMatch[1])
assert(locations.length === 13, 'sitemap.xml must contain exactly 13 canonical URLs')
locations.forEach(function (location) {
  var parsed = new URL(location)
  assert(parsed.protocol === 'https:', 'Sitemap URL must use https: ' + location)
  assert(parsed.hostname === 'alexandro.net', 'Sitemap URL must use alexandro.net: ' + location)
  assert(parsed.pathname.indexOf('/docs/vanilla/lockfile/') === 0, 'Sitemap URL has the wrong path: ' + location)
})

;[llms, llmsFull].forEach(function (value, index) {
  includesAll(value, [
    '@stackline/lockfile@1.0.7',
    'lockfile@1.0.4',
    'npm install lockfile@npm:@stackline/lockfile@1.0.7',
    'Node.js >=14.17',
    canonical,
    'ENOENT',
    'Issue 30',
    'NFS'
  ], index === 0 ? 'llms.txt' : 'llms-full.txt')
})

includesAll(docs['README.md'], [
  'npm install @stackline/lockfile@1.0.7',
  'npm install lockfile@npm:@stackline/lockfile@1.0.7',
  'six-method API',
  'Node.js `>=14.17`',
  'First-party declarations',
  'non-`ENOENT`',
  'synchronous `unlockSync` remains best-effort',
  'npm/lockfile#30',
  'NFS',
  canonical
], 'README.md')

includesAll(docs['COMPATIBILITY_CONTRACT.md'], [
  'Sole intentional runtime delta',
  'callback()` when unlink reports `ENOENT`',
  'original non-`ENOENT` unlink error',
  'Issue [npm/lockfile#30',
  'Supported Node.js versions begin at exact `14.17`'
], 'COMPATIBILITY_CONTRACT.md')

var license = read(projectDir, 'LICENSE').trim()
assert(docs.NOTICE.indexOf(license) !== -1, 'NOTICE must contain the exact complete upstream ISC notice')
assert(docs.NOTICE.indexOf('not affiliated with or endorsed by') !== -1, 'NOTICE lacks the non-affiliation statement')
assert(docs['THIRD_PARTY_LICENSES.md'].indexOf('signal-exit@4.1.0') !== -1, 'Third-party inventory lacks signal-exit@4.1.0')

rootFiles.forEach(function (name) {
  assert(!/TODO|PLACEHOLDER|TBD/.test(docs[name]), name + ' contains unfinished placeholder text')
})

console.log('lockfile documentation checks passed: ' + (siteFiles.length + rootFiles.length) + ' files')
