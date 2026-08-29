import lockfile = require('../..')

const path = 'example.lock'

lockfile.lock(path, error => {
  if (error) {
    const code: string | undefined = error.code
    void code
  }
})

lockfile.lock(path, {
  wait: 100,
  pollPeriod: 5,
  stale: 1000,
  retries: 2,
  retryWait: 10
}, error => {
  const settled: Error | null | undefined = error
  void settled
})

lockfile.lockSync(path, { stale: 1000, retries: 1 })
lockfile.unlock(path, error => {
  const settled: Error | undefined = error
  void settled
})
lockfile.unlockSync(path)

lockfile.check(path, { stale: 1000 }, (error, locked) => {
  const state: boolean | undefined = locked
  void error
  void state
})

const locked: boolean = lockfile.checkSync(path, { stale: 1000 })
const clockField: string = lockfile.filetime
void locked
void clockField
