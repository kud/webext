import { afterEach, describe, expect, it } from "vitest"
import { sendToActiveTab } from "./messaging.js"
import {
  createFakeBrowser,
  installFakeBrowser,
  type FakeStyle,
} from "./fake-browser.js"

let uninstall: () => void = () => {}
afterEach(() => uninstall())

const withBrowser = (style: FakeStyle = "promise") => {
  const fake = createFakeBrowser(style)
  uninstall = installFakeBrowser(fake)
  return fake
}

describe("sendToActiveTab", () => {
  it("returns the receiver's reply", async () => {
    const fake = withBrowser()
    fake.tabs._receiver = (message) => ({ echoed: message })
    expect(await sendToActiveTab({ type: "getStats" })).toEqual({
      echoed: { type: "getStats" },
    })
  })

  // The whole reason this function exists: every caller wrapped the raw API in a
  // try/catch that discarded exactly this rejection.
  it("returns undefined when no content script is listening", async () => {
    withBrowser()
    expect(await sendToActiveTab({ type: "getStats" })).toBeUndefined()
  })

  it("returns undefined when there is no active tab", async () => {
    const fake = withBrowser()
    fake.tabs._tabs = []
    expect(await sendToActiveTab({ type: "getStats" })).toBeUndefined()
  })

  it("returns undefined when the active tab has no id", async () => {
    const fake = withBrowser()
    fake.tabs._tabs = [{}]
    expect(await sendToActiveTab({ type: "getStats" })).toBeUndefined()
  })

  it("queries the current window by default", async () => {
    const fake = withBrowser()
    await sendToActiveTab({})
    expect(fake.tabs.query).toHaveBeenCalledWith(
      { active: true, currentWindow: true },
      expect.anything(),
    )
  })

  it("queries the last focused window on request", async () => {
    const fake = withBrowser()
    await sendToActiveTab({}, { window: "lastFocused" })
    expect(fake.tabs.query).toHaveBeenCalledWith(
      { active: true, lastFocusedWindow: true },
      expect.anything(),
    )
  })

  it("swallows a callback-style lastError", async () => {
    withBrowser("callback")
    expect(await sendToActiveTab({ type: "getStats" })).toBeUndefined()
  })
})
