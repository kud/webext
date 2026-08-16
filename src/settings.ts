import { api, invoke } from "./api.js"

export type SettingsArea = "sync" | "local"

export type SettingsValue =
  | string
  | number
  | boolean
  | null
  | SettingsValue[]
  | { [key: string]: SettingsValue }

export type SettingsSchema = Record<string, SettingsValue>

export type SettingsChangeListener<T> = (values: T, changed: Partial<T>) => void

export type Settings<T> = {
  get: () => Promise<T>
  set: (patch: Partial<T>) => Promise<void>
  onChange: (listener: SettingsChangeListener<T>) => () => void
}

export type DefineSettingsOptions = {
  area?: SettingsArea
}

/**
 * `T extends SettingsSchema` infers literal types from an object-literal argument
 * (`{ enabled: true }` becomes `{ enabled: true }`, not `{ enabled: boolean }`) —
 * a standalone quirk of generic inference against an index-signature constraint,
 * reproducible with a bare `Record<string, boolean>` and unrelated to this union.
 * Left alone, `settings.set({ enabled: false })` fails to typecheck for any
 * default that isn't already its own widest value. `Widen` restores the type a
 * caller actually wrote — `boolean`, `string`, `number` — after inference runs.
 */
type Widen<V> = V extends boolean
  ? boolean
  : V extends string
    ? string
    : V extends number
      ? number
      : V extends null
        ? null
        : V extends (infer U extends SettingsValue)[]
          ? Widen<U>[]
          : V extends SettingsValue
            ? { [K in keyof V]: Widen<V[K]> }
            : V

type WidenSchema<T> = { [K in keyof T]: Widen<T[K]> }

/**
 * Every extension audited re-derived its defaults at each read site — `x !== false`,
 * `x || FALLBACK`, `Boolean(x)` — because `storage.get` omits absent keys. Three of
 * those idioms cannot express a default of `false`, and restating them per site is
 * how one default drifts from another. Declaring the schema once makes the defaults
 * a single fact and the key names a checkable one.
 */
export const defineSettings = <T extends SettingsSchema>(
  defaults: T,
  options: DefineSettingsOptions = {},
): Settings<WidenSchema<T>> => {
  const area = options.area ?? "sync"
  const keys = Object.keys(defaults)
  const store = () => api.storage[area]

  const get = async (): Promise<T> => {
    const stored = await invoke<Partial<T>>(store(), "get", keys)
    return { ...defaults, ...stored }
  }

  // Consumers are plain JS with no build step, so the type parameter alone would
  // catch nothing at their end. A misspelt key is a silent no-op today — the write
  // lands under a name nothing ever reads. Failing loudly on the first run is the
  // only version of that check which reaches a no-build caller.
  const set = (patch: Partial<T>): Promise<void> => {
    const unknown = Object.keys(patch).filter((key) => !(key in defaults))
    if (unknown.length) {
      throw new Error(
        `@kud/webext: unknown setting${unknown.length > 1 ? "s" : ""} ${unknown.map((k) => `"${k}"`).join(", ")} — declared keys are ${keys.map((k) => `"${k}"`).join(", ")}.`,
      )
    }
    return invoke<void>(store(), "set", patch).then(() => undefined)
  }

  const onChange = (listener: SettingsChangeListener<T>): (() => void) => {
    const handler = (
      changes: Record<string, { newValue?: SettingsValue }>,
      changedArea: string,
    ) => {
      if (changedArea !== area) return
      const changed: Partial<T> = {}
      for (const key of keys) {
        if (!(key in changes)) continue
        // A removed key reverts to its default rather than reporting undefined.
        const { newValue } = changes[key]
        changed[key as keyof T] = (
          newValue === undefined ? defaults[key] : newValue
        ) as T[keyof T]
      }
      if (!Object.keys(changed).length) return
      get().then((values) => listener(values, changed))
    }

    api.storage.onChanged.addListener(handler)
    return () => api.storage.onChanged.removeListener(handler)
  }

  return { get, set, onChange } as Settings<WidenSchema<T>>
}
