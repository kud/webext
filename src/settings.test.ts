import { afterEach, describe, expect, it, vi } from "vitest"
import { defineSettings } from "./settings.js"
import {
  createFakeBrowser,
  installFakeBrowser,
  type FakeStyle,
} from "./fake-browser.js"

let uninstall: () => void = () => {}
afterEach(() => uninstall())

const withBrowser = (
  style: FakeStyle = "promise",
  seed: Record<string, unknown> = {},
) => {
  const fake = createFakeBrowser(style, seed)
  uninstall = installFakeBrowser(fake)
  return fake
}

// The behaviour every audited extension hand-rolled, and the reason `x !== false`
// is not good enough: a setting whose default is `false` must survive a round trip.
describe("defaults", () => {
  it("returns declared defaults when storage is empty", async () => {
    withBrowser()
    const settings = defineSettings({
      enabled: true,
      verbose: false,
      threshold: 30,
    })
    expect(await settings.get()).toEqual({
      enabled: true,
      verbose: false,
      threshold: 30,
    })
  })

  it("keeps a stored false rather than treating it as absent", async () => {
    withBrowser("promise", { enabled: false })
    const settings = defineSettings({ enabled: true })
    expect(await settings.get()).toEqual({ enabled: false })
  })

  it("keeps a stored true over a false default", async () => {
    withBrowser("promise", { verbose: true })
    const settings = defineSettings({ verbose: false })
    expect(await settings.get()).toEqual({ verbose: true })
  })

  it("ignores stored keys absent from the schema", async () => {
    withBrowser("promise", { enabled: false, legacy: "junk" })
    const settings = defineSettings({ enabled: true })
    expect(await settings.get()).toEqual({ enabled: false })
  })
})

describe("set", () => {
  it("writes a partial patch without disturbing the rest", async () => {
    const fake = withBrowser("promise", { enabled: true, threshold: 30 })
    const settings = defineSettings({ enabled: true, threshold: 30 })
    await settings.set({ threshold: 50 })
    expect(await settings.get()).toEqual({ enabled: true, threshold: 50 })
    expect(fake.storage.sync.set).toHaveBeenCalledWith(
      { threshold: 50 },
      expect.anything(),
    )
  })

  it("throws on an undeclared key rather than writing a value nothing reads", () => {
    withBrowser()
    const settings = defineSettings({ enabled: true })
    expect(() => settings.set({ enbaled: false } as never)).toThrow(
      /unknown setting "enbaled"/,
    )
  })

  it("names every undeclared key and lists the valid ones", () => {
    withBrowser()
    const settings = defineSettings({ enabled: true })
    expect(() => settings.set({ a: 1, b: 2 } as never)).toThrow(
      /unknown settings "a", "b".*"enabled"/s,
    )
  })
})

describe("onChange", () => {
  it("reports full values and the changed subset", async () => {
    withBrowser("promise", { enabled: true, threshold: 30 })
    const settings = defineSettings(
      { enabled: true, threshold: 30 },
      { area: "local" },
    )
    const listener = vi.fn()
    settings.onChange(listener)

    await settings.set({ threshold: 50 })
    await vi.waitFor(() => expect(listener).toHaveBeenCalled())

    expect(listener).toHaveBeenCalledWith(
      { enabled: true, threshold: 50 },
      { threshold: 50 },
    )
  })

  it("ignores changes in another storage area", async () => {
    const fake = withBrowser()
    const settings = defineSettings({ enabled: true }, { area: "local" })
    const listener = vi.fn()
    settings.onChange(listener)

    fake._emitOtherArea()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(listener).not.toHaveBeenCalled()
  })

  it("reverts a removed key to its default", async () => {
    const fake = withBrowser("promise", { enabled: false })
    const settings = defineSettings({ enabled: true }, { area: "local" })
    const listener = vi.fn()
    settings.onChange(listener)

    fake._remove("enabled")
    await vi.waitFor(() => expect(listener).toHaveBeenCalled())
    expect(listener).toHaveBeenCalledWith({ enabled: true }, { enabled: true })
  })

  it("unsubscribes", async () => {
    const fake = withBrowser()
    const settings = defineSettings({ enabled: true }, { area: "local" })
    const off = settings.onChange(vi.fn())
    expect(fake._listenerCount()).toBe(1)
    off()
    expect(fake._listenerCount()).toBe(0)
  })
})

describe("area", () => {
  it("defaults to sync and honours an explicit local", async () => {
    const fake = withBrowser()
    await defineSettings({ a: 1 }).get()
    expect(fake.storage.sync.get).toHaveBeenCalled()

    fake.storage.sync.get.mockClear()
    await defineSettings({ a: 1 }, { area: "local" }).get()
    expect(fake.storage.local.get).toHaveBeenCalled()
  })
})

// Chrome MV2 has no promise-returning storage API. Nothing on this machine runs it,
// so it is only ever covered here.
describe("callback-style API (Chrome MV2)", () => {
  it("reads through a callback", async () => {
    withBrowser("callback", { enabled: false })
    expect(await defineSettings({ enabled: true }).get()).toEqual({
      enabled: false,
    })
  })

  it("writes through a callback", async () => {
    withBrowser("callback")
    const settings = defineSettings({ enabled: true })
    await settings.set({ enabled: false })
    expect(await settings.get()).toEqual({ enabled: false })
  })
})

describe("chrome-only global", () => {
  it("resolves `chrome` when `browser` is absent", async () => {
    const fake = createFakeBrowser("callback", { enabled: false })
    uninstall = installFakeBrowser(fake, "chrome")
    expect(await defineSettings({ enabled: true }).get()).toEqual({
      enabled: false,
    })
  })
})
