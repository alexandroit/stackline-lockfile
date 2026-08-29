'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const tarball = process.argv[2]
if (!tarball) throw new Error('usage: node scripts/alias-registry-smoke.cjs <package.tgz>')

const absoluteTarball = path.resolve(tarball)
const tarballBytes = fs.readFileSync(absoluteTarball)
const packageJson = require(path.resolve(__dirname, '..', 'package.json'))
const shasum = crypto.createHash('sha1').update(tarballBytes).digest('hex')
const integrity = `sha512-${crypto.createHash('sha512').update(tarballBytes).digest('base64')}`
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'stackline-lockfile-alias-'))

const server = http.createServer((request, response) => {
  const raw = request.url.split('?')[0]
  let decoded = raw
  try { decoded = decodeURIComponent(raw) } catch (_) {}

  if (decoded === '/@stackline/lockfile') {
    const tarballUrl = `http://127.0.0.1:${server.address().port}/@stackline/lockfile/-/stackline-lockfile-1.0.5.tgz`
    return json(response, {
      name: '@stackline/lockfile',
      'dist-tags': { latest: '1.0.5' },
      versions: {
        '1.0.5': Object.assign({}, packageJson, {
          dist: { tarball: tarballUrl, shasum, integrity }
        })
      }
    })
  }

  if (decoded === '/@stackline/lockfile/-/stackline-lockfile-1.0.5.tgz') {
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-length': tarballBytes.length
    })
    return response.end(tarballBytes)
  }

  response.writeHead(404, { 'content-type': 'application/json' })
  response.end('{"error":"not found"}')
})

server.listen(0, '127.0.0.1', async () => {
  try {
    const registry = `http://127.0.0.1:${server.address().port}`
    await directScopedSmoke(registry)
    await aliasSmoke('npm', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], registry)
    await aliasSmoke('pnpm-9', executable('pnpm'), ['install', '--ignore-scripts', '--frozen-lockfile=false'], registry)
    await aliasSmoke('yarn-1', executable('yarn'), ['install', '--ignore-scripts', '--non-interactive'], registry)
    process.stdout.write(`${JSON.stringify({ status: 'pass', directScoped: true, aliases: ['npm', 'pnpm-9', 'yarn-1'] })}\n`)
  } catch (error) {
    console.error(error.stack || error)
    process.exitCode = 1
  } finally {
    server.close()
  }
})

async function directScopedSmoke (registry) {
  const directory = path.join(temp, 'direct')
  fs.mkdirSync(directory)
  fs.writeFileSync(path.join(directory, 'package.json'), `${JSON.stringify({
    private: true,
    dependencies: { '@stackline/lockfile': `file:${absoluteTarball}` }
  }, null, 2)}\n`)
  await run(process.execPath, [path.resolve(__dirname, 'install-and-smoke-child.cjs'), 'direct'], directory, {
    STACKLINE_SCOPED_REGISTRY: registry
  })
}

async function aliasSmoke (name, command, args, registry) {
  const directory = path.join(temp, name)
  fs.mkdirSync(directory)
  fs.writeFileSync(path.join(directory, 'package.json'), `${JSON.stringify({
    private: true,
    dependencies: { lockfile: 'npm:@stackline/lockfile@1.0.5' }
  }, null, 2)}\n`)
  fs.writeFileSync(path.join(directory, '.npmrc'), `@stackline:registry=${registry}\n`)
  await run(command, args, directory)
  await run(process.execPath, [path.resolve(__dirname, 'install-and-smoke-child.cjs'), 'alias'], directory)
}

function executable (name) {
  const command = path.resolve(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name)
  assert.ok(fs.existsSync(command), `${name} executable exists`)
  return command
}

function json (response, body) {
  const bytes = Buffer.from(JSON.stringify(body))
  response.writeHead(200, {
    'content-type': 'application/json',
    'content-length': bytes.length
  })
  response.end(bytes)
}

function run (command, args, cwd, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: Object.assign({}, process.env, extraEnv || {}, {
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
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)))
  })
}
