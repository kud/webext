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
`src/content.js`.

Do the same for popup and options pages — three plain `<script>` tags rather
than one `<script type="module">`. A module gets its own scope and cannot see
the vendored global, so it needs its own copy of the schema, and a second copy
of the schema is the thing this library exists to delete:

```html
<script src="vendor/webext.js"></script>
<script src="settings.js"></script>
<script src="popup.js"></script>
```

This costs something and it isn't hidden here: you commit a vendored file,
and you re-copy it by hand every time the library changes. That's the price
of a no-build extension. There's no watcher and no registry resolution at
runtime — just a file you copy in and keep in sync yourself.

## Usage

Declare the schema once, in a classic script every context loads:

```js
// src/settings.js
const settings = webext.defineSettings(
  { enabled: true, threshold: 30 },
  { area: "sync" },
)
```

A top-level `const` in a classic script lands in the shared global lexical
scope, so `settings` is in scope for every later script in that context — the
popup, the options page, the background page, and the content script — without
an `import` anywhere.

Read it from a popup:

```js
// src/popup.js
const values = await settings.get()
document.querySelector("#enabled").checked = values.enabled
```

Subscribe to changes from a content script:

```js
// src/content.js
settings.onChange((values, changed) => {
  if ("enabled" in changed) toggleFeature(values.enabled)
})
```

The one thing `settings` does not hand back is the defaults object itself. If a
context needs them synchronously — before the first `get()` resolves — name it
in `settings.js` and pass it in, so it is still declared once:

```js
const DEFAULTS = { enabled: true, threshold: 30 }
const settings = webext.defineSettings(DEFAULTS, { area: "sync" })
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
