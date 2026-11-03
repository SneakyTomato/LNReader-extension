"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_1 = require("@libs/fetch");
const cheerio_1 = require("cheerio");
const filterInputs_1 = require("@libs/filterInputs");
// Main category links captured from the live site categories directory.
const categories = [
    {
        "label": "Arts",
        "value": "/category/1"
    },
    {
        "label": "Astronomy",
        "value": "/category/2"
    },
    {
        "label": "Biography & Autobiography",
        "value": "/category/3"
    },
    {
        "label": "Biology and other natural sciences",
        "value": "/category/4"
    },
    {
        "label": "Business & Economics",
        "value": "/category/5"
    },
    {
        "label": "Chemistry",
        "value": "/category/6"
    },
    {
        "label": "Children's Books",
        "value": "/category/7"
    },
    {
        "label": "Comics & Graphic Novels",
        "value": "/category/8"
    },
    {
        "label": "Computers",
        "value": "/category/10"
    },
    {
        "label": "Cookbooks, Food & Wine",
        "value": "/category/311"
    },
    {
        "label": "Crime, Thrillers & Mystery",
        "value": "/category/11"
    },
    {
        "label": "Earth Sciences",
        "value": "/category/722"
    },
    {
        "label": "Education Studies & Teaching",
        "value": "/category/12"
    },
    {
        "label": "Engineering",
        "value": "/category/13"
    },
    {
        "label": "Erotica",
        "value": "/category/712"
    },
    {
        "label": "Fantasy",
        "value": "/category/794"
    },
    {
        "label": "Fiction",
        "value": "/category/14"
    },
    {
        "label": "History",
        "value": "/category/17"
    },
    {
        "label": "Housekeeping & Leisure",
        "value": "/category/18"
    },
    {
        "label": "Jurisprudence & Law",
        "value": "/category/20"
    },
    {
        "label": "Languages",
        "value": "/category/21"
    },
    {
        "label": "Linguistics",
        "value": "/category/22"
    },
    {
        "label": "Mathematics",
        "value": "/category/23"
    },
    {
        "label": "Medicine",
        "value": "/category/24"
    },
    {
        "label": "Nature, Animals & Pets",
        "value": "/category/25"
    },
    {
        "label": "Others",
        "value": "/category/26"
    },
    {
        "label": "Physics",
        "value": "/category/27"
    },
    {
        "label": "Poetry",
        "value": "/category/28"
    },
    {
        "label": "Psychology",
        "value": "/category/29"
    },
    {
        "label": "Reference",
        "value": "/category/30"
    },
    {
        "label": "Religion & Spirituality",
        "value": "/category/31"
    },
    {
        "label": "Romance",
        "value": "/category/32"
    },
    {
        "label": "Science (General)",
        "value": "/category/33"
    },
    {
        "label": "Science Fiction",
        "value": "/category/34"
    },
    {
        "label": "Self-Help, Relationships & Lifestyle",
        "value": "/category/35"
    },
    {
        "label": "Society, Politics & Philosophy",
        "value": "/category/36"
    },
    {
        "label": "Sports, Hobbies & Games",
        "value": "/category/37"
    },
    {
        "label": "Technique",
        "value": "/category/38"
    },
    {
        "label": "Travel",
        "value": "/category/39"
    }
];
class ZLibGdPlugin {
    constructor() {
        this.id = 'zLibGd';
        this.name = 'Z-Library GD (experimental)';
        this.site = 'https://z-lib.do';
        this.version = '0.2.8';
        this.icon = 'src/en/zLibGd/icon.png';
        this.imageRequestInit = { headers: { Referer: 'https://reader.z-lib.do/' } };
        this.readerOrigin = 'https://reader.z-lib.do';
        this.bookOrigins = ['https://z-lib.gd', 'https://z-lib.do'];
        this.readerOrigins = ['https://reader.z-lib.gd', 'https://reader.z-lib.do'];
        this.sessions = new Map();
        this.challengeCookies = new Map();
        this.filters = {
            category: { type: filterInputs_1.FilterTypes.Picker, label: 'Category', value: '', options: [{ label: 'All categories', value: '' }, ...categories] },
            query: { type: filterInputs_1.FilterTypes.TextInput, label: 'Keywords (optional when category selected)', value: '' },
            language: {
                type: filterInputs_1.FilterTypes.Picker, label: 'Search language', value: 'english',
                options: [{ label: 'English', value: 'english' }, { label: 'All languages', value: '' }],
            },
            format: {
                type: filterInputs_1.FilterTypes.Picker, label: 'Search file format', value: '',
                options: [{ label: 'All formats', value: '' }, { label: 'EPUB (supported reader format)', value: 'EPUB' }],
            },
            yearFrom: { type: filterInputs_1.FilterTypes.TextInput, label: 'Publication year from (optional)', value: '' },
            yearTo: { type: filterInputs_1.FilterTypes.TextInput, label: 'Publication year to (optional)', value: '' },
            order: {
                type: filterInputs_1.FilterTypes.Picker, label: 'Search sort order', value: '',
                options: [
                    { label: 'Website default', value: '' },
                    { label: 'Best match', value: 'bestmatch' },
                    { label: 'Most popular', value: 'popular' },
                    { label: 'Recently added', value: 'date' },
                    { label: 'Title (A–Z)', value: 'titleA' },
                    { label: 'Title (Z–A)', value: 'title' },
                    { label: 'Publication year', value: 'year' },
                ],
            },
        };
    }
    filterValue(filters, key) {
        // LNReader/Nekori send {value,type}; tolerate a plain value map as well.
        const supplied = filters?.[key];
        const value = supplied && typeof supplied === 'object' ? supplied.value : supplied;
        return typeof value === 'string' ? value.trim() : this.filters[key].value;
    }
    searchUrl(query, filters) {
        const category = this.filterValue(filters, 'category');
        if (category && !categories.some(option => option.value === category))
            throw new Error('Reset the category filter; this category is no longer supported.');
        const language = this.filterValue(filters, 'language');
        const format = this.filterValue(filters, 'format');
        const order = this.filterValue(filters, 'order');
        const from = this.filterValue(filters, 'yearFrom');
        const to = this.filterValue(filters, 'yearTo');
        if (!['', 'english'].includes(language) || !['', 'EPUB'].includes(format)
            || !this.filters.order.options.some(option => option.value === order))
            throw new Error('Reset the source filters; a selected option is no longer supported.');
        for (const year of [from, to]) {
            if (year && (!/^\d{1,4}$/.test(year) || Number(year) < 1)) {
                throw new Error('Publication years must be numbers between 1 and 9999.');
            }
        }
        if (from && to && Number(from) > Number(to))
            throw new Error('The starting publication year must not exceed the ending year.');
        const params = [];
        const add = (key, value) => { if (value)
            params.push(encodeURIComponent(key) + '=' + encodeURIComponent(value)); };
        add('languages[]', language);
        add('extensions[]', format);
        add('yearFrom', from);
        add('yearTo', to);
        add('order', order);
        // Scoped search needs a category slug segment before /s/; the bare
        // /category/<id>/s/ route is not the site's category-search action.
        if (category && query)
            params.unshift('q=' + encodeURIComponent(query));
        const categorySlug = category ? categories.find(option => option.value === category).label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') : '';
        const route = category ? category + (query ? '/' + categorySlug + '/s/' : '') : '/s/' + encodeURIComponent(query);
        return { url: this.site + route + (params.length ? '?' + params.join('&') : ''), englishOnly: language === 'english' };
    }
    absoluteUrl(reference, base) {
        // Resolve file-relative paths ourselves. Some mobile URL implementations
        // append to a file base (content.opf/toc.ncx) instead of replacing its name.
        const ref = reference.trim();
        if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) {
            if (!/^https?:/i.test(ref))
                throw new Error('Unsupported resource URL scheme.');
            return new URL(ref).href;
        }
        const parent = new URL(base);
        if (ref.startsWith('//'))
            return new URL(parent.protocol + ref).href;
        const cleanBase = base.split('#')[0];
        if (!ref)
            return cleanBase;
        if (ref.startsWith('#'))
            return cleanBase + ref;
        if (ref.startsWith('?'))
            return cleanBase.split('?')[0] + ref;
        const split = ref.search(/[?#]/);
        const relativePath = split < 0 ? ref : ref.slice(0, split);
        const suffix = split < 0 ? '' : ref.slice(split);
        const directory = parent.pathname.slice(0, parent.pathname.lastIndexOf('/') + 1);
        const combined = relativePath.startsWith('/') ? relativePath : directory + relativePath;
        const segments = [];
        for (const segment of combined.split('/')) {
            if (segment === '..') {
                if (segments.length > 1)
                    segments.pop();
            }
            else if (segment !== '.')
                segments.push(segment);
        }
        let path = segments.join('/') || '/';
        if (/\/\.{1,2}$/.test(combined) && !path.endsWith('/'))
            path += '/';
        return new URL(parent.origin + path + suffix).href;
    }
    sha1Ascii(input) {
        const size = Math.ceil((input.length + 9) / 64) * 16;
        const blocks = new Uint32Array(size), words = new Uint32Array(80);
        for (let i = 0; i < input.length; i++)
            blocks[i >>> 2] |= input.charCodeAt(i) << (24 - (i % 4) * 8);
        blocks[input.length >>> 2] |= 0x80 << (24 - (input.length % 4) * 8);
        blocks[size - 1] = input.length * 8;
        let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
        const rotate = (value, bits) => (value << bits) | (value >>> (32 - bits));
        for (let block = 0; block < size; block += 16) {
            for (let i = 0; i < 16; i++)
                words[i] = blocks[block + i];
            for (let i = 16; i < 80; i++)
                words[i] = rotate(words[i - 3] ^ words[i - 8] ^ words[i - 14] ^ words[i - 16], 1);
            let a = h0, b = h1, c = h2, d = h3, e = h4;
            for (let i = 0; i < 80; i++) {
                const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
                const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
                const next = (rotate(a, 5) + f + e + k + words[i]) | 0;
                e = d;
                d = c;
                c = rotate(b, 30);
                b = a;
                a = next;
            }
            h0 = (h0 + a) | 0;
            h1 = (h1 + b) | 0;
            h2 = (h2 + c) | 0;
            h3 = (h3 + d) | 0;
            h4 = (h4 + e) | 0;
        }
        const bytes = [];
        for (const word of [h0, h1, h2, h3, h4])
            for (const shift of [24, 16, 8, 0])
                bytes.push((word >>> shift) & 255);
        return bytes;
    }
    isBrowserCheck(body) {
        return /<title[^>]*>\s*(?:Checking your browser|Just a moment|Access denied|Attention required)/i.test(body);
    }
    async completeBrowserCheck(body) {
        // Recognize only the observed site's fixed proof-of-work format. Never eval
        // response JavaScript, guess access credentials, or modify reader access tokens.
        const seedMatch = body.match(/\['([0-9a-f]{32,128})','c_token=','array'\]/i);
        const target = body.match(/s\[n1\]===0x([0-9a-f]+).*?s\[n1\+0x1\]===0x([0-9a-f]+)/i);
        if (!seedMatch || !target || !body.includes('c_time=')) {
            throw new Error('The website returned an unsupported browser check. Its challenge format needs inspection.');
        }
        const seed = seedMatch[1], offset = parseInt(seed[0], 16);
        const first = parseInt(target[1], 16), second = parseInt(target[2], 16);
        if (offset >= 19 || first > 255 || second > 255)
            throw new Error('Invalid browser-check parameters.');
        const started = Date.now();
        for (let nonce = 0; nonce < 1000000; nonce++) {
            const hash = this.sha1Ascii(seed + nonce);
            if (hash[offset] === first && hash[offset + 1] === second) {
                return `c_token=${seed}${nonce}; c_time=${(Date.now() - started) / 1000}`;
            }
            if (nonce > 0 && nonce % 4096 === 0) {
                if (Date.now() - started > 15000)
                    break;
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        throw new Error('The website browser check exceeded this plugin\'s computation limit.');
    }
    bookPath(input) {
        const url = new URL(this.absoluteUrl(input, this.site));
        if (!this.bookOrigins.includes(url.origin) || !/^\/book\/[^/]+\/.+\.html$/.test(url.pathname)) {
            throw new Error('Use a z-lib.do or z-lib.gd book details URL.');
        }
        return url.pathname;
    }
    resolveUrl(path) {
        if (path.startsWith('zlib-chapter:')) {
            const ref = JSON.parse(decodeURIComponent(path.slice(13)));
            return this.absoluteUrl(this.bookPath(ref.book), this.site);
        }
        return this.absoluteUrl(this.bookPath(path), this.site);
    }
    async text(url, init) {
        const origin = new URL(url).origin;
        const eligible = this.bookOrigins.includes(origin) || this.readerOrigins.includes(origin);
        const request = () => {
            const cookie = eligible ? this.challengeCookies.get(origin) : undefined;
            return (0, fetch_1.fetchApi)(url, cookie ? { ...init, headers: { ...init?.headers, Cookie: cookie } } : init);
        };
        let response = await request();
        // Challenge HTML can accompany HTTP 503; inspect the body before rejecting.
        let body = await response.text();
        if (eligible && this.isBrowserCheck(body)) {
            this.challengeCookies.set(origin, await this.completeBrowserCheck(body));
            response = await request();
            body = await response.text();
            if (this.isBrowserCheck(body)) {
                this.challengeCookies.delete(origin);
                throw new Error('The browser check was not accepted by the plugin request. WebView uses a separate session; reopening it alone may not resolve this.');
            }
        }
        if (!response.ok) {
            if (response.status === 429) {
                const wait = response.headers?.get?.('retry-after');
                throw new Error(`The website is rate limiting requests (HTTP 429). Wait before retrying.${wait ? ` Server Retry-After: ${wait}.` : ''}`);
            }
            throw new Error(`Website returned HTTP ${response.status} for ${new URL(url).pathname}. This request did not receive a supported browser check.`);
        }
        return body;
    }
    async api(path, session, body) {
        const readerOrigin = session.readerOrigin || this.readerOrigin;
        const url = new URL(this.absoluteUrl(path, readerOrigin));
        if (session.accessToken)
            url.searchParams.set('access_token', session.accessToken);
        const headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Referer: readerOrigin + '/',
        };
        if (session.csrf)
            headers['X-CSRF-TOKEN'] = session.csrf;
        if (session.fileToken)
            headers['X-File-Access-Token'] = session.fileToken;
        if (session.bookToken)
            headers['X-Book-Info-Token'] = session.bookToken;
        const responseBody = await this.text(url.href, {
            method: body ? 'POST' : 'GET',
            headers,
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        try {
            return JSON.parse(responseBody);
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
        const target = new URL(this.absoluteUrl(signedUrl, session.readerOrigin));
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
        const readerUrl = new URL(this.absoluteUrl(link, this.site));
        if (!this.readerOrigins.includes(readerUrl.origin))
            throw new Error(`Unsupported reader domain: ${readerUrl.hostname}.`);
        const html = await this.text(readerUrl.href);
        const reader = (0, cheerio_1.load)(html);
        const csrf = reader('meta[name="csrf-token"]').attr('content');
        const match = html.match(/\bconst\s+connectionInfo\s*=\s*JSON\.parse\('((?:\\.|[^'\\])*)'\)/);
        if (!match || !csrf)
            throw new Error('Reader initialization changed or a browser check is required.');
        // Decode a JSON string literal; never evaluate page JavaScript.
        const info = JSON.parse(JSON.parse('"' + match[1] + '"'));
        const session = {
            readerOrigin: readerUrl.origin,
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
                    href: this.absoluteUrl(href, session.opfUrl),
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
                    const url = this.absoluteUrl(navigation(el).attr('href'), entry.href).split('#')[0];
                    if (!labels.has(url))
                        labels.set(url, navigation(el).text().trim());
                });
            }
            else {
                navigation('navPoint').each((_, el) => {
                    const point = navigation(el), href = point.children('content').attr('src');
                    if (!href)
                        return;
                    const url = this.absoluteUrl(href, entry.href).split('#')[0];
                    if (!labels.has(url))
                        labels.set(url, point.children('navLabel').text().trim());
                });
            }
        }
        opf('spine > itemref').each((index, el) => {
            if (opf(el).attr('linear') === 'no')
                return;
            const item = items.get(opf(el).attr('idref') || '');
            if (!item)
                return;
            const url = item.href.split('#')[0];
            session.toc.push({ name: labels.get(url) || `Section ${index + 1}`, url });
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
            ...(cover ? { cover: this.absoluteUrl(cover, this.site) } : {}),
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
        const entry = session.toc.find(item => item.url === ref.source)
            || session.toc.find(item => new URL(item.url).pathname === new URL(ref.source).pathname);
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
            const source = this.absoluteUrl(src, entry.url);
            $(img).attr(attr, await this.resource(session, source));
        }
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href') || '';
            if (/^\s*(?:javascript|data):/i.test(href))
                $(el).removeAttr('href');
        });
        return $('body').html() || $.root().html() || '';
    }
    catalog(html, mode, englishOnly = mode === 'search') {
        const $ = (0, cheerio_1.load)(html);
        // Search responses include hidden decoy cards outside the selected filters.
        // They are not visible website results and must not enter the app's catalog.
        $('[hidden], [aria-hidden="true"]').remove();
        const books = [];
        const seen = new Set();
        const excluded = new Set();
        const scope = mode === 'search' ? $('#searchResultBox') : $('z-masonry, .masonry-endless');
        const add = (href, title, image) => {
            if (!href)
                return;
            let path;
            try {
                path = this.bookPath(href);
            }
            catch {
                return;
            }
            if (excluded.has(path))
                return;
            const name = title.replace(/\s+/g, ' ').trim();
            if (!name || seen.has(path))
                return;
            seen.add(path);
            let cover;
            if (image && !/^(?:data:|blob:)/i.test(image)) {
                const url = new URL(this.absoluteUrl(image, this.site));
                if (url.protocol === 'https:')
                    cover = url.href;
            }
            books.push({ name, path, ...(cover ? { cover } : {}) });
        };
        // Z-Library result cards store their URL on a custom element, not an <a>.
        const cards = scope.length ? scope.find('z-bookcard[href]') : $('z-bookcard[href]');
        cards.each((_, el) => {
            const card = $(el), img = card.find('img').first();
            const language = (card.attr('language') || '').trim();
            if (englishOnly && language && !/^(?:english|en(?:[-_][a-z]{2})?)$/i.test(language)) {
                try {
                    excluded.add(this.bookPath(card.attr('href')));
                }
                catch { }
                return;
            }
            add(card.attr('href'), card.find('[slot="title"]').first().text()
                || card.attr('title') || card.find('z-cover').attr('title') || '', img.attr('data-src') || img.attr('src') || card.attr('cover'));
        });
        scope.find('.item, .book-item').each((_, el) => {
            const item = $(el), link = item.find('a[href*="/book/"]').first();
            const cover = item.find('z-cover').first(), img = item.find('img').first();
            add(link.attr('href'), cover.attr('title') || item.find('[slot="title"]').first().text()
                || link.attr('title') || link.text(), img.attr('data-src') || img.attr('src') || cover.attr('src'));
        });
        // Older layouts use ordinary title links inside a recognized result area.
        scope.find('a[href*="/book/"]').each((_, el) => {
            const link = $(el), img = link.find('img').first();
            add(link.attr('href'), link.find('z-cover').attr('title')
                || link.attr('title') || link.text() || img.attr('alt') || '', img.attr('data-src') || img.attr('src'));
        });
        if (books.length || (mode === 'search' && cards.length))
            return books;
        const pageTitle = $('title').text().replace(/\s+/g, ' ').trim().slice(0, 100);
        const explicitEmpty = /(?:nothing (?:has been|was) found|no (?:books|results) found|no results matching)/i.test(scope.text());
        if (mode === 'search' && scope.length && explicitEmpty)
            return [];
        throw new Error(`${mode === 'search' ? 'Search' : 'Popular books'} page did not contain recognizable book cards${pageTitle ? ` (page title: ${pageTitle})` : ''}. WebView may have loaded a different page or session. Please share this error and a saved copy of the corresponding page.`);
    }
    async popularNovels(pageNo, options) {
        // Only the first catalog page has a verified route in the reference project.
        if (pageNo > 1)
            return [];
        const selected = options?.filters;
        const query = this.filterValue(selected, 'query');
        const changed = Object.keys(this.filters).some(key => this.filterValue(selected, key) !== this.filters[key].value);
        if (query || this.filterValue(selected, 'category')) {
            if (/^https?:\/\//i.test(query))
                throw new Error('Enter search keywords in the filter panel. To open a book URL, use the regular search button.');
            const search = this.searchUrl(query, selected);
            return this.catalog(await this.text(search.url), 'search', search.englishOnly);
        }
        if (changed)
            throw new Error('Choose a category or enter keywords in the filter panel to apply filters, or reset filters to return to Popular.');
        return this.catalog(await this.text(this.site + '/popular'), 'popular');
    }
    async searchNovels(searchTerm, pageNo) {
        // Pasting a book URL gives a deterministic fallback while listing support is tested.
        if (/^https:\/\/z-lib\.(?:gd|do)\/book\//i.test(searchTerm.trim())) {
            if (pageNo > 1)
                return [];
            const path = this.bookPath(searchTerm.trim());
            const $ = (0, cheerio_1.load)(await this.text(this.site + path));
            const name = $('h1.book-title').first().text().trim();
            if (!name)
                throw new Error('Book details were not found.');
            const language = $('.property_language .property_value').first().text().trim();
            if (!/^(?:english|en(?:[-_][a-z]{2})?)$/i.test(language))
                return [];
            return [{ name, path }];
        }
        const query = searchTerm.trim();
        if (!query || pageNo > 1)
            return [];
        const search = this.searchUrl(query);
        return this.catalog(await this.text(search.url), 'search', search.englishOnly);
    }
}
exports.default = new ZLibGdPlugin();
