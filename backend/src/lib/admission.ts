export class BusyError extends Error {}

// Per-process admission control protects memory and upstream services. The queue
// is intentionally bounded: waiting HTTP requests cannot be kept forever.
export function createAdmission(maxActive: number, maxWaiting: number, waitMs: number) {
  let active = 0
  const waiting: Array<() => void> = []
  return async function acquire(): Promise<() => void> {
    if (active >= maxActive) {
      if (waiting.length >= maxWaiting) throw new BusyError('Dịch vụ đang bận, vui lòng thử lại sau.')
      await new Promise<void>((resolve, reject) => {
        const grant = () => { clearTimeout(timer); resolve() }
        const timer = setTimeout(() => {
          const index = waiting.indexOf(grant)
          if (index >= 0) waiting.splice(index, 1)
          reject(new BusyError('Dịch vụ đang bận, vui lòng thử lại sau.'))
        }, waitMs)
        waiting.push(grant)
      })
    } else { active++ }
    let released = false
    return () => {
      if (released) return
      released = true
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }
}
