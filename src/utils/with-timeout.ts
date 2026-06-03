/**
 * Rejects if `promise` doesn't settle within `ms`. The underlying promise keeps
 * running — we just stop waiting on it. Used to bound the 3D dice animation so a
 * hung or lost WebGL context can never pin the roll pipeline.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)

    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
