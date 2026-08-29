declare namespace lockfile {
  interface Options {
    wait?: number
    pollPeriod?: number
    stale?: number
    retries?: number
    retryWait?: number
  }

  interface ErrnoException extends Error {
    code?: string
    errno?: number
    path?: string
    syscall?: string
  }

  type Callback = (error?: ErrnoException) => void
  type LockCallback = (error?: ErrnoException | null) => void
  type CheckCallback = (error: ErrnoException | null, isLocked?: boolean) => void

  /**
   * Stat timestamp used for stale-lock checks. The runtime defaults to ctime
   * except on Windows, where it defaults to mtime.
   */
  let filetime: string

  function lock(path: string, callback: LockCallback): void
  function lock(path: string, options: Options, callback: LockCallback): void
  function lockSync(path: string, options?: Options): void

  function unlock(path: string, callback?: Callback): void
  function unlockSync(path: string): void

  function check(path: string, callback: CheckCallback): void
  function check(path: string, options: Options, callback: CheckCallback): void
  function checkSync(path: string, options?: Options): boolean
}

export = lockfile
