export { api } from "./api.js"
export type { WebExtApi } from "./api.js"

export { defineSettings } from "./settings.js"
export type {
  Settings,
  SettingsArea,
  SettingsChangeListener,
  SettingsSchema,
  SettingsValue,
  DefineSettingsOptions,
} from "./settings.js"

export { sendToActiveTab } from "./messaging.js"
export type { SendToActiveTabOptions } from "./messaging.js"
