# Z-Library source for LNReader — experimental 0.2.8

This package contains a custom source prototype targeting LNReader 2.1.4's
plugin interface. It is JavaScript loaded through a plugin repository, not an APK.
It has not been tested inside the Android app. Android cookie behavior, Tor
routing, and native runtime compatibility remain unverified.

## What works in development

- Book metadata parsing was checked against the supplied saved book page.
- The site's normal reader flow was tested live: credentials, prepare-book,
  configuration, resource signing, OPF metadata, navigation, and one section.
- An offline integration check exercised this plugin's metadata parsing, 120 EPUB
  spine entries, navigation labels, chapter extraction, stable chapter references,
  URL search, and isolation of reader credentials from CDN requests.
- No book contents, saved web pages, account credentials, access tokens, or signed
  links are included in this package.
- The live website's HTTP 503 body was confirmed to contain its browser proof-of-work
  challenge. Completing that challenge changed an external test request to HTTP 200.
  The resulting popular and keyword search pages were retrieved successfully.
- Version 0.2.1 recognizes that specific SHA-1 challenge, computes its normal
  response with bounded work, stores its cookies separately by origin in memory,
  and retries once. It never evaluates website-supplied JavaScript.
- The final compiled 0.2.1 plugin passed a live external request test: `/popular`
  returned HTTP 503, the plugin completed the challenge and received HTTP 200,
  then keyword search also returned HTTP 200. It parsed 100 popular books and
  51 results for “dragon mage”. This was not an Android device test.
- Version 0.2.2 resolves file-relative EPUB references explicitly. It prevents
  invalid paths such as `content.opf/toc.ncx`, and applies the same handling to
  navigation links, chapter files, and images. A regression test exercises a full
  OPF/NCX/chapter/image flow while simulating a mobile URL constructor that
  incorrectly appends relative paths to a file base.
- The 0.2.2 live book check was not completed: automatic approval review blocked
  a request involving `z-lib.do`, outside the authorized `z-lib.gd` site. The path
  fix is validated by local regression tests; Android confirmation is still needed.

## Current scope and limitations

- Version 0.2.4 restricts catalog and search results to English. Requests include
  the site's `languages[]=english` filter; returned book metadata is also checked.
  Popular cards without language fields require a details-page lookup, with at
  most three lookups in parallel and a ten-minute in-memory cache. The first
  Popular load can take longer. Missing or non-English language metadata is
  excluded. Direct book URLs and reader editions are checked too. Language
  checks use the site's labels; they do not detect language from the book text.

- Version 0.2.3 switches the active site to `https://z-lib.do`. Old `.gd` book
  URLs and stored book paths remain accepted. The plugin ID `zLibGd` is retained.
  Both `reader.z-lib.do` and `reader.z-lib.gd` are supported; each session uses
  its own reader origin for authentication, configuration and resource requests.
  Unknown reader domains are rejected. Local integration tests cover both origins.

- EPUB only. PDF and other reader modes are unsupported.
- Search accepts keywords or a full `.do` or `.gd` book details URL.
- Browse loads `/popular`; keyword search loads `/s/<encoded query>`. Version
  0.2.0 adds custom `z-bookcard` parsing and popular-book card parsing informed
  by Knight-project/zlib-lnr-plugin. That project targets `z-lib.fm`; the selectors
  are tested against representative fixtures here. Version 0.2.1 also recognizes
  the actual site's `z-masonry` popular layout. Android behavior still needs
  validation. Unrecognized or empty-shell HTML
  raises a diagnostic error instead of claiming that there are no results.
- Catalog and keyword search currently return only the first results page.
  Latest uses the popular catalog too; it does not claim chronological sorting.
- Book resources are obtained through the reader's existing authorization flow.
  A table-of-contents entry is not a guarantee that the server allows reading it.
  Preview, login, rate, and other server restrictions still apply.
- HTTP 503 can carry browser-check HTML even when WebView works. The plugin now
  reads that body and handles the observed computation-and-cookie check itself.
  Unknown challenges, rejected solutions, and genuine HTTP errors produce explicit
  errors. The computation stops after one million candidates or roughly 15 seconds,
  and only one request retry is attempted. It does not solve CAPTCHAs or alter
  reader access rights. WebView's separate session is not relied on for this check.
- Challenge cookies are sent only to the exact origin that issued them, and never
  to the reader CDN. They are not stored in the distributed files.
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
   source. Browse should load popular books. Try a keyword search or paste a
  full book details URL. A working WebView alone does not confirm that plugin
   requests can access the same session.
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
- `test.cjs`: representative catalog and error-handling regression checks.
- `icon.png`: original generic book icon, 96 by 96 pixels.
- `public/static/src/en/zLibGd/icon.png`: icon at the official plugin repository's
  expected source location, if you choose to copy the source into a fork instead.

## Rebuild after editing

From this folder, with Node.js 22 or newer:

```text
npm install --no-save typescript cheerio@1.0.0
node build.cjs
node test.cjs
```

Increment `version` in the source and manifest before distributing an update.
Alternatively, copy the TypeScript and public icon into a fork of the official
`lnreader/lnreader-plugins` repository and use its documented build workflow.

## References

- https://github.com/lnreader/lnreader/tree/v2.1.4
- https://github.com/lnreader/lnreader-plugins
- https://github.com/lnreader/lnreader-plugins/blob/master/docs/docs.md
- https://github.com/Knight-project/zlib-lnr-plugin/blob/main/src/plugins/english/zlib.ts

The catalog implementation was informed by the above MIT-licensed project.
See `THIRD_PARTY_NOTICES.txt` for its license notice. Its reader only provides
website links; this package's chapter integration remains separate.

MIT License. Copyright (c) 2026. Permission is granted, free of charge, to any
person obtaining a copy of this software and associated documentation files to
deal in the software without restriction, including the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies, provided this
copyright and permission notice are included. THE SOFTWARE IS PROVIDED “AS IS”,
WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR ITS USE.
