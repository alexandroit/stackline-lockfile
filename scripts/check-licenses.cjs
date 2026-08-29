'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const license = fs.readFileSync(path.join(root, 'LICENSE'))
const licenseSha256 = crypto.createHash('sha256').update(license).digest('hex')
assert.strictEqual(licenseSha256, '4ec3d4c66cd87f5c8d8ad911b10f99bf27cb00cdfcff82621956e379186b016b')

const notice = fs.readFileSync(path.join(root, 'NOTICE'), 'utf8')
assert.match(notice, /Isaac Z\. Schlueter and Contributors/)
assert.match(notice, /not affiliated/i)
assert.match(notice, /lockfile@1\.0\.4/)

const thirdParty = fs.readFileSync(path.join(root, 'THIRD_PARTY_LICENSES.md'), 'utf8')
assert.match(thirdParty, /signal-exit@3\.0\.7/)
assert.match(thirdParty, /Copyright \(c\) 2015, Contributors/)
assert.match(thirdParty, /ISC/)

process.stdout.write(`license provenance: pass (${licenseSha256})\n`)
