import { api, invoke } from "./api.js"

export type SendToActiveTabOptions = {
  /**
   * Which window's active tab to target. `lastFocused` is correct when the send is
   * triggered from outside the browser UI (a keyboard command, a socket, an alarm),
   * where "current" may resolve to the background context's own window.
   */
  window?: "current" | "lastFocused"
}

/**
 * Sends a message to the active tab, resolving `undefined` when nothing is
 * listening rather than rejecting.
 *
 * `tabs.sendMessage` rejects identically whether the tab has no content script or
 * the content script threw, so every caller audited wrapped it in a try/catch that
 * discards the error — one of them four times over in a single file. The absence of
 * a receiver is the expected case (a browser-internal page, a non-matching site),
 * not a failure, so it is reported as a value.
 */
export const sendToActiveTab = async <R = unknown>(
  message: unknown,
  options: SendToActiveTabOptions = {},
): Promise<R | undefined> => {
  const query =
    options.window === "lastFocused"
      ? { active: true, lastFocusedWindow: true }
      : { active: true, currentWindow: true }

  try {
    const [tab] = await invoke<{ id?: number }[]>(api.tabs, "query", query)
    if (tab?.id === undefined) return undefined
    return await invoke<R>(api.tabs, "sendMessage", tab.id, message)
  } catch {
    return undefined
  }
}
