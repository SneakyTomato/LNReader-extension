# Z-Library GD source for LNReader — experimental 0.2.3

This package contains a custom source prototype targeting LNReader 2.1.4's
plugin interface. It is JavaScript loaded through a plugin repository, not an APK.
It has not been tested inside the Android app. The browser challenge, Android
cookie behavior, Tor routing, and native runtime compatibility remain unverified.

## What works in development

- Book metadata parsing was checked against the supplied saved book page.
- The site's normal reader flow was tested live: credentials, prepare-book,
  configuration, resource signing, OPF metadata, navigation, and one section.
- An offline integration check exercised this plugin's metadata parsing, 120 EPUB
  spine entries, navigation labels, chapter extraction, stable chapter references,
  URL search, and isolation of reader credentials from CDN requests.
- No book contents, saved web pages, account credentials, access tokens, or signed
  links are included in this package.

## Current scope and limitations

- EPUB only. PDF and other reader modes are unsupported.
- Paste a full `https://z-lib.gd/book/...html` URL into the source's Search box.
  Keyword search is deliberately not implemented until a search page is inspected.
- Homepage browsing is experimental and has not been checked live.
- Book resources are obtained through the reader's existing authorization flow.
  A table-of-contents entry is not a guarantee that the server allows reading it.
  Preview, login, rate, and other server restrictions still apply.
- Browser-check HTML produces an explicit error. The plugin does not run arbitrary
  JavaScript returned by the website. Try opening the source in LNReader's own
  WebView and completing the check. This may not transfer the required cookies to
  plugin requests on every app/device configuration; that requires an Android test.
  Cookies in Brave or Tor Browser are not automatically cookies in LNReader.
- If direct network access fails, route LNReader through Orbot. Working in a Tor
  browser does not automatically route LNReader through Tor.
- EPUB sections without navigation labels use “Section N”. Book metadata is taken
  from the site and may itself contain errors.
- Chapter references retain resource identity instead of signed download URLs.
  Session credentials are kept in memory for up to five minutes; every resource
  request obtains a fresh signed resource URL. Signed image URLs can still expire
  in already cached chapter HTML. Images and offline downloads need device testing.
- Domain changes and future reader changes may require plugin updates.

## Host and install your custom repository

The package includes precompiled `zLibGd.js` and `icon.png`; Node.js is not needed
to host this build. You need an HTTPS location that serves these files directly.

For a new public GitHub repository:

1. Create your own repository. Upload this package's contents into its root.
2. On a computer with Python 3, configure the manifest, replacing the placeholders:

   ```text
   python configure.py https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main
   ```

   Use `py` in place of `python` if that is your Windows Python launcher.
   Match your actual branch name. Upload the generated `plugins.min.json` too.
   If working only through GitHub's web editor, replace `YOUR_USERNAME` and
   `YOUR_REPO` in the included `plugins.min.json` instead.

3. Add this URL through LNReader's plugin repository management screen:

   ```text
   https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/plugins.min.json
   ```

4. Refresh available plugins and install **Z-Library GD (experimental)**.
5. Open the source in its WebView. Complete any browser check, then return to the
   source and search using a full book details URL. The initial list may fail;
   the URL-search path is the intended first test.
6. Open the book and try one available chapter. Record the exact error if it fails.

Hosting/installation steps have not been exercised with an actual LNReader device.
Do not upload your saved reader archives or session tokens to a public repository.

## Files

- `plugins/english/zLibGd.ts`: editable TypeScript source.
- `zLibGd.js`: CommonJS plugin build, with `cheerio` and `@libs/fetch` external so
  LNReader supplies them at runtime.
- `plugins.min.json`: repository manifest template.
- `configure.py`: fills the manifest with your hosting location.
- `build.cjs`: recompiles the TypeScript with LNReader's expected CommonJS exports.
- `icon.png`: original generic book icon, 96 by 96 pixels.
- `public/static/src/en/zLibGd/icon.png`: icon at the official plugin repository's
  expected source location, if you choose to copy the source into a fork instead.

## Rebuild after editing

From this folder, with Node.js 22 or newer:

```text
npm install --no-save typescript
node build.cjs
```

Increment `version` in the source and manifest before distributing an update.
Alternatively, copy the TypeScript and public icon into a fork of the official
`lnreader/lnreader-plugins` repository and use its documented build workflow.

## References

- https://github.com/lnreader/lnreader/tree/v2.1.4
- https://github.com/lnreader/lnreader-plugins
- https://github.com/lnreader/lnreader-plugins/blob/master/docs/docs.md

MIT License. Copyright (c) 2026. Permission is granted, free of charge, to any
person obtaining a copy of this software and associated documentation files to
deal in the software without restriction, including the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies, provided this
copyright and permission notice are included. THE SOFTWARE IS PROVIDED “AS IS”,
WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR ITS USE.
