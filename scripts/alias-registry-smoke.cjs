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
    const tarballUrl = `http://127.0.0.1:${server.address().port}/@stackline/lockfile/-/stackline-lockfile-1.0.7.tgz`
    return json(response, {
      name: '@stackline/lockfile',
      'dist-tags': { latest: '1.0.7' },
      versions: {
        '1.0.7': Object.assign({}, packageJson, {
          dist: { tarball: tarballUrl, shasum, integrity }
        })
      }
    })
  }

  if (decoded === '/@stackline/lockfile/-/stackline-lockfile-1.0.7.tgz') {
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
    await aliasSmoke('pnpm-10', executable('pnpm'), ['install', '--ignore-scripts', '--frozen-lockfile=false'], registry)
    await aliasSmoke('yarn-1', executable('yarn'), ['install', '--non-interactive'], registry)
    process.stdout.write(`${JSON.stringify({ status: 'pass', directScoped: true, aliases: ['npm', 'pnpm-10', 'yarn-1'] })}\n`)
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
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const install = await run(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund'], directory, {
    STACKLINE_SCOPED_REGISTRY: registry
  })
  assertCleanInstall(install, 'direct npm install')
  await verifyNpmClosure(directory, '@stackline/lockfile')
  await run(process.execPath, [path.resolve(__dirname, 'install-and-smoke-child.cjs'), 'direct-installed'], directory)
}

async function aliasSmoke (name, command, args, registry) {
  const directory = path.join(temp, name)
  fs.mkdirSync(directory)
  fs.writeFileSync(path.join(directory, 'package.json'), `${JSON.stringify({
    private: true,
    dependencies: { lockfile: 'npm:@stackline/lockfile@1.0.7' }
  }, null, 2)}\n`)
  fs.writeFileSync(path.join(directory, '.npmrc'), `@stackline:registry=${registry}\n`)
  const install = await run(command, args, directory)
  assertCleanInstall(install, `${name} alias install`)
  if (name === 'npm') await verifyNpmClosure(directory, 'lockfile')
  await run(process.execPath, [path.resolve(__dirname, 'install-and-smoke-child.cjs'), 'alias'], directory)
}

async function verifyNpmClosure (directory, dependencyKey) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const listed = await run(npm, ['ls', '--all', '--json'], directory)
  const tree = JSON.parse(listed.stdout)
  assert.ok(!tree.problems || tree.problems.length === 0, `npm ls reports problems: ${JSON.stringify(tree.problems)}`)
  const rootDependency = tree.dependencies && tree.dependencies[dependencyKey]
  assert.ok(rootDependency, `${dependencyKey} is present in the production tree`)
  assert.strictEqual(rootDependency.version, '1.0.7')
  assert.strictEqual(rootDependency.dependencies['signal-exit'].version, '4.1.0')

  const audited = await run(npm, [
    'audit',
    '--omit=dev',
    '--json',
    '--registry=https://registry.npmjs.org/'
  ], directory)
  const report = JSON.parse(audited.stdout)
  assert.strictEqual(report.metadata.vulnerabilities.total, 0, 'production audit must report zero vulnerabilities')
}

function assertCleanInstall (result, label) {
  const output = `${result.stdout}\n${result.stderr}`
  assert.ok(!/(?:^|\n)\s*(?:(?:npm\s+)?warn(?:ing)?\b|warning\b)/i.test(output), `${label} emitted a warning`)
  assert.ok(!/\bdeprecated\b/i.test(output), `${label} emitted a deprecation warning`)
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
    let stdout = ''
    let stderr = ''
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
      stdio: ['ignore', 'pipe', 'pipe']
    })
    child.stdout.on('data', chunk => {
      stdout += chunk
      process.stdout.write(chunk)
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
      process.stderr.write(chunk)
    })
    child.on('error', reject)
    child.on('exit', code => code === 0
      ? resolve({ stdout, stderr })
      : reject(new Error(`${command} exited ${code}`)))
  })
}
