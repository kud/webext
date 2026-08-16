import { vi } from "vitest"

export type FakeStyle = "promise" | "callback"

/**
 * A minimal `storage` + `tabs` double. `style` selects between the promise-returning
 * shape (Firefox, Chrome MV3) and the callback-only shape (Chrome MV2) so both
 * branches of `invoke` are covered by the same suite — the callback path is the one
 * no local browser exercises.
 */
export const createFakeBrowser = (
  style: FakeStyle = "promise",
  seed: Record<string, unknown> = {},
) => {
  const data: Record<string, unknown> = { ...seed }
  const listeners: ((
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ) => void)[] = []

  const respond = <T>(value: T, callback?: (value: T) => void) => {
    if (style === "callback") {
      callback?.(value)
      return undefined
    }
    return Promise.resolve(value)
  }

  const local = {
    get: vi.fn((keys: string[], callback?: (value: unknown) => void) => {
      const picked = Object.fromEntries(
        keys.filter((key) => key in data).map((key) => [key, data[key]]),
      )
      return respond(picked, callback as never)
    }),
    set: vi.fn(
      (patch: Record<string, unknown>, callback?: (value: unknown) => void) => {
        const changes = Object.fromEntries(
          Object.entries(patch).map(([key, newValue]) => [
            key,
            { oldValue: data[key], newValue },
          ]),
        )
        Object.assign(data, patch)
        for (const listener of listeners) listener(changes, "local")
        return respond(undefined, callback as never)
      },
    ),
  }

  const tabs = {
    query: vi.fn((_query: unknown, callback?: (value: unknown) => void) =>
      respond(tabs._tabs, callback as never),
    ),
    sendMessage: vi.fn(
      (_id: number, message: unknown, callback?: (value: unknown) => void) => {
        if (tabs._receiver)
          return respond(tabs._receiver(message), callback as never)
        if (style === "callback") {
          fake.runtime.lastError = {
            message: "Could not establish connection.",
          }
          callback?.(undefined)
          fake.runtime.lastError = undefined
          return undefined
        }
        return Promise.reject(new Error("Could not establish connection."))
      },
    ),
    _tabs: [{ id: 1 }] as { id?: number }[],
    _receiver: null as null | ((message: unknown) => unknown),
  }

  const fake = {
    runtime: { lastError: undefined as undefined | { message: string } },
    storage: {
      local,
      sync: local,
      onChanged: {
        addListener: (fn: (typeof listeners)[number]) => listeners.push(fn),
        removeListener: (fn: (typeof listeners)[number]) => {
          const index = listeners.indexOf(fn)
          if (index >= 0) listeners.splice(index, 1)
        },
      },
    },
    tabs,
    _data: data,
    _listenerCount: () => listeners.length,
    // A key removed from storage reports a change with no `newValue`.
    _remove: (key: string) => {
      delete data[key]
      for (const listener of listeners) listener({ [key]: {} }, "local")
    },
    _emitOtherArea: () => {
      for (const listener of listeners)
        listener({ enabled: { newValue: true } }, "managed")
    },
  }

  return fake
}

export const installFakeBrowser = (
  fake: ReturnType<typeof createFakeBrowser>,
  as: "browser" | "chrome" = "browser",
) => {
  const scope = globalThis as Record<string, unknown>
  scope[as] = fake
  return () => {
    delete scope[as]
  }
}
