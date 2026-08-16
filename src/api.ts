/**
 * Firefox exposes a promise-based `browser`; Chrome exposes `chrome`, which is
 * promise-based under MV3 but callback-only under MV2. `invoke` tolerates all
 * three by passing a callback *and* honouring a returned thenable — whichever
 * arrives first wins, and a Promise settles once. Resolving this per-call rather
 * than sniffing the browser avoids a capability probe that would be wrong in
 * exactly the environment nobody tests (Chrome MV2).
 */

export type WebExtApi = Record<string, any>

const resolveApi = (): WebExtApi | undefined => {
  const scope = globalThis as Record<string, any>
  return scope.browser?.runtime
    ? scope.browser
    : scope.chrome?.runtime
      ? scope.chrome
      : undefined
}

/**
 * The resolved WebExtension namespace — `browser` where it exists, `chrome`
 * otherwise. Accessing a missing namespace throws with a useful message rather
 * than the bare `undefined is not an object` the raw globals produce.
 */
export const api: WebExtApi = new Proxy({} as WebExtApi, {
  get: (_target, prop: string) => {
    const resolved = resolveApi()
    if (!resolved) {
      throw new Error(
        `@kud/webext: no WebExtension API found — expected a global \`browser\` or \`chrome\` when reading \`${prop}\`. This code is not running in an extension context.`,
      )
    }
    return resolved[prop]
  },
})

export const invoke = <T>(
  target: WebExtApi,
  method: string,
  ...args: unknown[]
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const settle = (value: T) => {
      const failure = resolveApi()?.runtime?.lastError
      failure ? reject(new Error(failure.message)) : resolve(value)
    }
    const returned = target[method](...args, settle)
    if (returned && typeof returned.then === "function")
      returned.then(resolve, reject)
  })
