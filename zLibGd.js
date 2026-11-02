"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_1 = require("@libs/fetch");
const cheerio_1 = require("cheerio");
class ZLibGdPlugin {
    constructor() {
        this.id = 'zLibGd';
        this.name = 'Z-Library GD (experimental)';
        this.site = 'https://z-lib.gd';
        this.version = '0.1.1';
        this.icon = 'src/en/zLibGd/icon.png';
        this.imageRequestInit = { headers: { Referer: 'https://reader.z-lib.gd/' } };
        this.readerOrigin = 'https://reader.z-lib.gd';
        this.sessions = new Map();
    }
    bookPath(input) {
        const url = new URL(input, this.site);
        if (url.origin !== this.site || !/^\/book\/[^/]+\/.+\.html$/.test(url.pathname)) {
            throw new Error('Use a z-lib.gd book details URL.');
        }
        return url.pathname;
    }
    resolveUrl(path) {
        if (path.startsWith('zlib-chapter:')) {
            const ref = JSON.parse(decodeURIComponent(path.slice(13)));
            return new URL(this.bookPath(ref.book), this.site).href;
        }
        return new URL(this.bookPath(path), this.site).href;
    }
    async text(url, init) {
        const response = await (0, fetch_1.fetchApi)(url, init);
        if (!response.ok) {
            throw new Error(`Website returned HTTP ${response.status}. Open the source in LNReader's WebView and check access.`);
        }
        const body = await response.text();
        if (/<title>\s*Checking your browser/i.test(body)) {
            throw new Error('Browser check required. Open this source in LNReader\'s WebView, complete the check, then retry. Tor routing alone does not complete it.');
        }
        return body;
    }
    async api(path, session, body) {
        const url = new URL(path, this.readerOrigin);
        if (session.accessToken)
            url.searchParams.set('access_token', session.accessToken);
        const headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Referer: this.readerOrigin + '/',
        };
        if (session.csrf)
            headers['X-CSRF-TOKEN'] = session.csrf;
        if (session.fileToken)
            headers['X-File-Access-Token'] = session.fileToken;
        if (session.bookToken)
            headers['X-Book-Info-Token'] = session.bookToken;
        const response = await (0, fetch_1.fetchApi)(url.href, {
            method: body ? 'POST' : 'GET',
            headers,
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (!response.ok) {
            throw new Error(`Reader access failed (HTTP ${response.status}). Open the book in WebView to check its availability or sign in, then retry. No access limits are bypassed.`);
        }
        try {
            return await response.json();
        }
        catch {
            throw new Error('Reader returned a browser check or an unexpected response instead of JSON.');
        }
    }
    async resource(session, source) {
        const split = source.lastIndexOf('/');
        const prefix = source.slice(0, split + 1);
        const key = source.slice(split + 1);
        const result = await this.api('/api/fetch-sections?source=' + encodeURIComponent(session.fileId), session, {
            section_sources: [{ prefix, keys: [key] }],
        });
        let signedUrl;
        if (Array.isArray(result)) {
            const group = result[0];
            if (typeof group?.keys?.[key] === 'string')
                signedUrl = (group.prefix || '') + group.keys[key];
        }
        else if (typeof result[source] === 'string')
            signedUrl = result[source];
        if (!signedUrl)
            throw new Error('This resource is unavailable for the current reader session.');
        const target = new URL(signedUrl, this.readerOrigin);
        if (target.protocol !== 'https:')
            throw new Error('Unexpected resource URL.');
        return target.href;
    }
    async xml(session, url) {
        // Signed CDN requests deliberately omit all reader credentials.
        return this.text(await this.resource(session, url));
    }
    async createSession(path, details) {
        const page = (0, cheerio_1.load)(details ?? await this.text(this.site + path));
        const link = page('a.reader-link').first().attr('href');
        if (!link)
            throw new Error('This book does not expose a Read Online link.');
        const readerUrl = new URL(link, this.site);
        if (readerUrl.origin !== this.readerOrigin)
            throw new Error('Reader domain changed; this plugin needs an update.');
        const html = await this.text(readerUrl.href);
        const reader = (0, cheerio_1.load)(html);
        const csrf = reader('meta[name="csrf-token"]').attr('content');
        const match = html.match(/\bconst\s+connectionInfo\s*=\s*JSON\.parse\('((?:\\.|[^'\\])*)'\)/);
        if (!match || !csrf)
            throw new Error('Reader initialization changed or a browser check is required.');
        // Decode a JSON string literal; never evaluate page JavaScript.
        const info = JSON.parse(JSON.parse('"' + match[1] + '"'));
        const session = {
            csrf, accessToken: '', fileToken: '', bookToken: '', fileId: '', opfUrl: '',
            expiresAt: Date.now() + 5 * 60 * 1000, toc: [],
        };
        const auth = await this.api('/api/auth/get-credentials', session, info);
        if (!auth.access_token)
            throw new Error('Reader did not authorize this session.');
        session.accessToken = auth.access_token;
        session.fileToken = auth.file_access_token || info.file_access_token;
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(info)) {
            if (typeof value === 'string' || typeof value === 'number')
                params.set(key, String(value));
        }
        const prepared = await this.api('/api/prepare-book?' + params.toString(), session);
        if (prepared.block_status)
            throw new Error('The server restricted access to this book.');
        if (prepared.extension !== 'epub' || prepared.type !== 'FLOW') {
            throw new Error('This experimental source currently supports EPUB books only.');
        }
        session.fileId = prepared.fileIdentifier;
        const query = new URLSearchParams({ file_identifier: session.fileId, book_id: String(prepared.bookId) });
        if (prepared.source)
            query.set('source', prepared.source);
        const configured = await this.api('/api/fetch-config?' + query.toString(), session);
        session.bookToken = configured.result?.book_info_token;
        session.opfUrl = configured.result?.configURL;
        if (!session.opfUrl || !session.bookToken)
            throw new Error('Reader configuration is incomplete.');
        // This server currently supplies an OPF URL. Do not guess a different layout.
        if (!/\.opf(?:\?|$)/i.test(session.opfUrl))
            throw new Error('Unsupported reader package layout.');
        const opf = (0, cheerio_1.load)(await this.xml(session, session.opfUrl), { xmlMode: true });
        const items = new Map();
        opf('item').each((_, item) => {
            const el = opf(item), id = el.attr('id'), href = el.attr('href');
            if (id && href)
                items.set(id, {
                    href: new URL(href, session.opfUrl).href,
                    properties: el.attr('properties') || '', media: el.attr('media-type'),
                });
        });
        const nav = [...items.values()].find(item => item.properties.split(/\s+/).includes('nav'));
        const ncx = [...items.values()].find(item => item.media === 'application/x-dtbncx+xml');
        const labels = new Map();
        if (nav || ncx) {
            const entry = (nav || ncx);
            const navigation = (0, cheerio_1.load)(await this.xml(session, entry.href), { xmlMode: true });
            if (nav) {
                const root = navigation('nav').filter((_, el) => navigation(el).attr('epub:type') === 'toc' || navigation(el).attr('role') === 'doc-toc').first();
                (root.length ? root : navigation('nav').first()).find('a[href]').each((_, el) => {
                    const url = new URL(navigation(el).attr('href'), entry.href);
                    url.hash = '';
                    if (!labels.has(url.href))
                        labels.set(url.href, navigation(el).text().trim());
                });
            }
            else {
                navigation('navPoint').each((_, el) => {
                    const point = navigation(el), href = point.children('content').attr('src');
                    if (!href)
                        return;
                    const url = new URL(href, entry.href);
                    url.hash = '';
                    if (!labels.has(url.href))
                        labels.set(url.href, point.children('navLabel').text().trim());
                });
            }
        }
        opf('spine > itemref').each((index, el) => {
            if (opf(el).attr('linear') === 'no')
                return;
            const item = items.get(opf(el).attr('idref') || '');
            if (!item)
                return;
            const url = new URL(item.href);
            url.hash = '';
            session.toc.push({ name: labels.get(url.href) || `Section ${index + 1}`, url: url.href });
        });
        if (!session.toc.length)
            throw new Error('No readable spine entries were found.');
        return session;
    }
    async session(path, details) {
        let promise = this.sessions.get(path);
        if (promise) {
            const cached = await promise;
            if (cached.expiresAt > Date.now())
                return cached;
            this.sessions.delete(path);
        }
        if (this.sessions.size >= 3)
            this.sessions.delete(this.sessions.keys().next().value);
        promise = this.createSession(path, details);
        this.sessions.set(path, promise);
        try {
            return await promise;
        }
        catch (error) {
            this.sessions.delete(path);
            throw error;
        }
    }
    async parseNovel(novelPath) {
        const path = this.bookPath(novelPath);
        const html = await this.text(this.site + path);
        const $ = (0, cheerio_1.load)(html);
        const name = $('h1.book-title').first().text().trim();
        if (!name)
            throw new Error('Book details were not found.');
        const session = await this.session(path, html);
        const cover = $('.details-book-cover-container z-cover img[src], .details-book-cover-container img[src]').first().attr('src');
        return {
            name, path, author: $('.authors').first().text().trim(),
            summary: $('#bookDescriptionBox').text().trim(),
            genres: $('.property_categories .property_value').text().trim(),
            ...(cover ? { cover: new URL(cover, this.site).href } : {}),
            chapters: session.toc.map((entry, index) => ({
                name: entry.name, chapterNumber: index + 1,
                // Store stable book and resource identities, never expiring credentials.
                path: 'zlib-chapter:' + encodeURIComponent(JSON.stringify({ book: path, source: entry.url })),
            })),
        };
    }
    async parseChapter(chapterPath) {
        if (!chapterPath.startsWith('zlib-chapter:'))
            throw new Error('Invalid chapter reference.');
        const ref = JSON.parse(decodeURIComponent(chapterPath.slice(13)));
        const path = this.bookPath(ref.book);
        const session = await this.session(path);
        // Only request resources in this book's server-provided reading order.
        const entry = session.toc.find(item => item.url === ref.source);
        if (!entry)
            throw new Error('The book layout changed; refresh its chapter list.');
        const $ = (0, cheerio_1.load)(await this.xml(session, entry.url), { xmlMode: true });
        $('script, style, link, iframe, object, embed, form').remove();
        $('*').each((_, el) => {
            for (const name of Object.keys(el.attribs || {})) {
                if (/^on/i.test(name))
                    $(el).removeAttr(name);
            }
        });
        for (const img of $('img, image').toArray()) {
            const attr = $(img).is('img') ? 'src' : ($(img).attr('href') ? 'href' : 'xlink:href');
            const src = $(img).attr(attr);
            if (!src)
                continue;
            if (/^(?:data:|blob:)/i.test(src)) {
                $(img).remove();
                continue;
            }
            const source = new URL(src, entry.url).href;
            $(img).attr(attr, await this.resource(session, source));
        }
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href') || '';
            if (/^\s*(?:javascript|data):/i.test(href))
                $(el).removeAttr('href');
        });
        return $('body').html() || $.root().html() || '';
    }
    async popularNovels(_pageNo, _options) {
        // This build imports by book URL. LNReader invokes this method on opening
        // the source; an empty browse list must not depend on unverified homepage HTML.
        return [];
    }
    async searchNovels(searchTerm, pageNo) {
        // Pasting a book URL gives a deterministic fallback while listing support is tested.
        if (/^https:\/\/z-lib\.gd\/book\//i.test(searchTerm.trim())) {
            if (pageNo > 1)
                return [];
            const path = this.bookPath(searchTerm.trim());
            const $ = (0, cheerio_1.load)(await this.text(this.site + path));
            const name = $('h1.book-title').first().text().trim();
            if (!name)
                throw new Error('Book details were not found.');
            return [{ name, path }];
        }
        throw new Error('For this experimental build, paste a full z-lib.gd book URL into Search. Keyword search has not been verified yet.');
    }
}
exports.default = new ZLibGdPlugin();
