# webext

Typed settings and plumbing for Firefox WebExtensions.

## Consuming this without a build step

The extensions this library is built for have no bundler — `web-ext build`
just zips the source directory as-is. So there is no `import "@kud/webext"`
resolving through node_modules at runtime; instead you **vendor** the built
file straight into the extension repo:

```sh
cp node_modules/@kud/webext/dist/index.global.js src/vendor/webext.js
```

Commit `src/vendor/webext.js`, and list it in `manifest.json` **before** the
consumer's own script — the IIFE build exposes a `webext` global that the
following script relies on:

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/vendor/webext.js", "src/content.js"]
    }
  ]
}
```

`webext.defineSettings(...)` is then available as a global inside
`src/content.js`. For options or popup pages loaded with
`<script type="module">`, import the ESM build (`dist/index.js`) instead.

This costs something and it isn't hidden here: you commit a vendored file,
and you re-copy it by hand every time the library changes. That's the price
of a no-build extension. There's no watcher and no registry resolution at
runtime — just a file you copy in and keep in sync yourself.

## Usage

Declare the schema once, in a shared module:

```js
// src/settings.js
import { defineSettings } from "./vendor/webext.js" // or "@kud/webext" from an ESM context

export const settings = defineSettings(
  { enabled: true, threshold: 30 },
  { area: "sync" },
)
```

Read it from a popup:

```js
// src/popup.js
import { settings } from "./settings.js"

const values = await settings.get()
document.querySelector("#enabled").checked = values.enabled
```

Subscribe to changes from a content script:

```js
// src/content.js
const { settings } = webext // global, vendored build

settings.onChange((values, changed) => {
  if ("enabled" in changed) toggleFeature(values.enabled)
})
```

`defineSettings` also throws on `set()` calls with an undeclared key, so a
typo in a plain-JS content script fails loudly instead of silently writing
under a name nothing reads.

## Development

```sh
npm install
npm run build      # emits dist/index.js (ESM) and dist/index.global.js (IIFE)
npm run typecheck
npm test
```
