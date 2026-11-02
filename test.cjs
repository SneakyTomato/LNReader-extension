const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cheerio = require('cheerio');

const bookPath = '/book/example123/example-book.html';
let html = '', status = 200;
let responder;
const requests = [];
const fetchApi = async (url, init = {}) => {
  requests.push(url);
  if (responder) return responder(url, init);
  if (url.includes('/book/')) return { ok: true, status: 200, text: async () => '<h1 class="book-title">Example Book</h1><div class="property_language"><div class="property_value">English</div></div>' };
  return { ok: status === 200, status, text: async () => html };
};
const code = fs.readFileSync(path.join(__dirname, 'zLibGd.js'), 'utf8');
// Match LNReader's original-exports loader, not Node's module.exports loader.
const plugin = Function('require', 'module',
  'const exports = module.exports = {};\n' + code + '\nreturn exports.default;')(
  name => name === '@libs/fetch' ? { fetchApi } : name === 'cheerio' ? cheerio : require(name), {},
);

async function main() {
  assert.equal(plugin.version, '0.2.5');
  const base = 'https://cdn.example.test/pkg/content.opf';
  for (const [reference, expected] of [
    ['toc.ncx', 'https://cdn.example.test/pkg/toc.ncx'],
    ['Text/ch1.xhtml', 'https://cdn.example.test/pkg/Text/ch1.xhtml'],
    ['../Images/a.jpg', 'https://cdn.example.test/Images/a.jpg'],
    ['/root/file.xhtml', 'https://cdn.example.test/root/file.xhtml'],
    ['#anchor', base + '#anchor'],
    ['?v=1', base + '?v=1'],
    ['https://other.example.test/file', 'https://other.example.test/file'],
  ]) assert.equal(plugin.absoluteUrl(reference, base), expected);
  for (const value of ['', 'abc', 'a'.repeat(55), 'b'.repeat(64), 'c'.repeat(130)]) {
    assert.equal(Buffer.from(plugin.sha1Ascii(value)).toString('hex'), crypto.createHash('sha1').update(value).digest('hex'));
  }
  html = `<div class="masonry-endless"><div class="item">
    <a href="${bookPath}"><z-cover title="Example Book"><img data-src="/cover.jpg"></z-cover></a>
  </div><div class="item"><a href="${bookPath}"><z-cover title="Duplicate"></z-cover></a></div></div>`;
  assert.deepEqual(await plugin.popularNovels(1, {}), [
    { name: 'Example Book', path: bookPath, cover: 'https://z-lib.fm/cover.jpg' },
  ]);
  assert.equal(requests[0], 'https://z-lib.fm/popular?languages%5B%5D=english');
  const count = requests.length;
  assert.deepEqual(await plugin.popularNovels(2, {}), []);
  assert.equal(requests.length, count);

  html = `<div id="searchResultBox"><div class="book-item"><z-bookcard href="${bookPath}" language="English">
    <div slot="title">  Example\n Book  </div><img data-src="/search-cover.jpg">
  </z-bookcard></div></div>`;
  assert.deepEqual(await plugin.searchNovels('dragon & mage', 1), [
    { name: 'Example Book', path: bookPath, cover: 'https://z-lib.fm/search-cover.jpg' },
  ]);
  assert.equal(requests.at(-1), 'https://z-lib.fm/s/dragon%20%26%20mage?languages%5B%5D=english');
  assert.deepEqual(await plugin.searchNovels('dragon', 2), []);

  html = '<div id="searchResultBox">Nothing has been found</div>';
  assert.deepEqual(await plugin.searchNovels('nothing', 1), []);
  html = '<title>Unexpected page</title><div id="searchResultBox"></div>';
  await assert.rejects(() => plugin.searchNovels('dragon', 1), /did not contain recognizable book cards/);
  html = '<title class="challenge">Checking your browser ...</title>';
  await assert.rejects(() => plugin.searchNovels('dragon', 1), /unsupported browser check/);
  status = 503;
  html = '<title>Service unavailable</title>';
  await assert.rejects(() => plugin.popularNovels(1, {}), /HTTP 503/);
  status = 200;

  html = '<h1 class="book-title">Example Book</h1><div class="property_language"><div class="property_value">English</div></div>';
  assert.deepEqual(await plugin.searchNovels('https://z-lib.fm' + bookPath, 1), [
    { name: 'Example Book', path: bookPath },
  ]);
  const last = requests.length;
  assert.deepEqual(await plugin.searchNovels('https://z-lib.fm' + bookPath, 2), []);
  assert.deepEqual(await plugin.searchNovels('https://z-lib.gd' + bookPath, 1), [
    { name: 'Example Book', path: bookPath },
  ]);
  assert.equal(requests.at(-1), 'https://z-lib.fm' + bookPath);
  assert.equal(plugin.resolveUrl('https://z-lib.do' + bookPath), 'https://z-lib.fm' + bookPath);
  assert.equal(plugin.resolveUrl('https://z-lib.gd' + bookPath), 'https://z-lib.fm' + bookPath);
  assert.equal(requests.length, last + 1);
  assert.deepEqual(await plugin.searchNovels('   ', 1), []);

  const seed = '0'.repeat(40), digest = crypto.createHash('sha1').update(seed + '0').digest();
  const challenge = `<title>Checking your browser ...</title><script>const x=['${seed}','c_token=','array'];(s[n1]===0x${digest[0].toString(16)})&&(s[n1+0x1]===0x${digest[1].toString(16)}); 'c_time=';</script>`;
  const response = (body, code = 200) => ({ ok: code === 200, status: code, text: async () => body });
  let calls = 0;
  responder = async (url, init) => {
    calls++;
    if (calls === 1) return response(challenge, 503);
    assert.match(init.headers.Cookie, new RegExp('^c_token=' + seed + '0; c_time='));
    assert.equal(init.headers.Referer, 'https://z-lib.fm/');
    return response('PASSED');
  };
  assert.equal(await plugin.text('https://z-lib.fm/popular?languages%5B%5D=english', { headers: { Referer: 'https://z-lib.fm/' } }), 'PASSED');
  assert.equal(calls, 2, 'Complete the 503 challenge and retry once');
  responder = async (url, init) => { assert(!init.headers?.Cookie); return response('CDN'); };
  assert.equal(await plugin.text('https://cdn.example.test/asset'), 'CDN');
  responder = async (url, init) => { assert(!init.headers?.Cookie); return response('READER'); };
  assert.equal(await plugin.text('https://reader.z-lib.gd/'), 'READER');
  responder = async () => response(challenge, 503);
  await assert.rejects(() => plugin.text('https://z-lib.fm/popular?languages%5B%5D=english'), /not accepted/);
  assert(!plugin.challengeCookies.has('https://z-lib.fm'));

  // Reproduce a mobile URL implementation that treats file bases as directories.
  // The plugin must still resolve the OPF, NCX, chapter, and image as siblings.
  const StandardURL = global.URL;
  global.URL = class FileAppendingURL extends StandardURL {
    constructor(input, parent) {
      super(parent && !/^[a-z]+:/i.test(input) && !input.startsWith('/')
        ? parent.replace(/\/$/, '') + '/' + input : input, parent);
    }
  };
  try {
    const opf = '<package><manifest><item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="chapter" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/></manifest><spine toc="toc"><itemref idref="chapter"/></spine></package>';
    const ncx = '<ncx><navMap><navPoint id="one"><navLabel><text>Prologue</text></navLabel><content src="Text/ch1.xhtml#start"/></navPoint></navMap></ncx>';
    const chapterHtml = '<html><body><p>Example chapter for testing.</p><img src="../Images/test.png"/></body></html>';
    const files = new Map([
      [base, opf], ['https://cdn.example.test/pkg/toc.ncx', ncx],
      ['https://cdn.example.test/pkg/Text/ch1.xhtml', chapterHtml],
      ['https://cdn.example.test/pkg/Images/test.png', 'image'],
    ]);
    const signedFiles = new Map();
    const connection = JSON.stringify({ extension: 'epub', source: 'test-book' }).replace(/"/g, '\\u0022');
    let activeReader = 'https://reader.z-lib.do';
    responder = async (url, init) => {
      const route = new StandardURL(url);
      if (route.pathname.startsWith('/book/')) return response(`<h1 class="book-title">Example Book</h1><div class="property_language"><div class="property_value">English</div></div><a class="reader-link" href="${activeReader}/read/test">Read Online</a>`);
      if (route.pathname.startsWith('/api/')) {
        assert.equal(route.origin, activeReader, 'API credentials stay on the session reader origin');
        assert.equal(init.headers.Referer, activeReader + '/');
      }
      if (route.pathname === '/read/test') return response(`<meta name="csrf-token" content="TEST"><script>const connectionInfo = JSON.parse('${connection}');</script>`);
      if (route.pathname === '/api/auth/get-credentials') return response(JSON.stringify({ access_token: 'TEST', file_access_token: 'TEST' }));
      if (route.pathname === '/api/prepare-book') return response(JSON.stringify({ extension: 'epub', type: 'FLOW', fileIdentifier: 'test-file', bookId: 1 }));
      if (route.pathname === '/api/fetch-config') return response(JSON.stringify({ result: { configURL: base, book_info_token: 'TEST' } }));
      if (route.pathname === '/api/fetch-sections') {
        const group = JSON.parse(init.body).section_sources[0], key = group.keys[0], source = group.prefix + key;
        assert(files.has(source), 'Unexpected EPUB resource path: ' + source);
        const id = String(signedFiles.size + 1); signedFiles.set(id, files.get(source));
        return response(JSON.stringify([{ prefix: 'https://signed.example.test/', keys: { [key]: id } }]));
      }
      if (route.hostname === 'signed.example.test') return response(signedFiles.get(route.pathname.slice(1)));
      throw new Error('Unexpected test request: ' + route.pathname);
    };
    for (const origin of ['https://reader.z-lib.do', 'https://reader.z-lib.gd']) {
      activeReader = origin;
      plugin.sessions.clear();
      const novel = await plugin.parseNovel(bookPath);
      assert.equal(novel.chapters.length, 1);
      assert.equal(novel.chapters[0].name, 'Prologue');
      const parsedChapter = await plugin.parseChapter(novel.chapters[0].path);
      assert(parsedChapter.includes('Example chapter for testing.'));
      assert(parsedChapter.includes('https://signed.example.test/'));
    }
    activeReader = 'https://reader.unrelated.example';
    plugin.sessions.clear();
    await assert.rejects(() => plugin.parseNovel(bookPath), /Unsupported reader domain/);
  } finally { global.URL = StandardURL; }
  let checks = 0;
  responder = async url => {
    checks++;
    const lang = url.includes('french') ? 'French' : url.includes('unknown') ? '' : 'English';
    return response(`<div class="property_language"><div class="property_value">${lang}</div></div>`);
  };
  const mixed = [
    { name: 'Known English', path: '/book/known/english.html', language: 'en-US' },
    { name: 'Known French', path: '/book/known/french.html', language: 'French' },
    { name: 'Verified English', path: '/book/check/english.html' },
    { name: 'Verified French', path: '/book/check/french.html' },
    { name: 'Unknown', path: '/book/check/unknown.html' },
  ];
  assert.deepEqual((await plugin.englishBooks(mixed)).map(x => x.name), ['Known English', 'Verified English']);
  assert.equal(checks, 3);
  await plugin.englishBooks(mixed);
  assert.equal(checks, 3, 'Repeated catalogs reuse cached language checks');
  responder = async () => response('<h1 class="book-title">French Book</h1><div class="property_language"><div class="property_value">French</div></div>');
  assert.deepEqual(await plugin.searchNovels('https://z-lib.fm' + bookPath, 1), []);
  await assert.rejects(() => plugin.parseNovel(bookPath), /only loads books confirmed as English/);
  assert(!plugin.isEnglish('English, French'));
  console.log('PASS: English-only results, metadata fallback/cache, non-English URL rejection, catalog, browser challenge, domain compatibility, and EPUB reading flow.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
