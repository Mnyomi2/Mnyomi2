// --- METADATA ---
const mangayomiSources = [{
    "name": "Anime4up",
    "id": 8374956845,
    "lang": "ar",
    "baseUrl": "https://ww.anime4up.rest",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=ww.anime4up.rest",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.5.4",
    "pkgPath": "anime/src/ar/anime4up.js"
}];

// --- CLASS ---
class DefaultExtension extends MProvider {
    // The constructor is called when the class is initialized.
    constructor() {
        super(); // Always call the parent constructor.
        this.client = new Client(); // Initialize the HTTP client.
    }

    // --- PREFERENCES AND HEADERS ---

    getPreference(key) {
        return new SharedPreferences().get(key);
    }

    getBaseUrl() {
        // Allows users to override the base URL in the extension settings.
        return this.getPreference("override_base_url") || this.source.baseUrl;
    }

    getHeaders(url) {
        return {
            "Referer": this.getBaseUrl() + "/",
            "Origin": this.getBaseUrl(),
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        };
    }

    // --- HELPER METHODS ---

    /**
     * A helper function for catalogue page requests.
     * @param {string} path The path to fetch (e.g., "/قائمة-الانمي/page/1/").
     * @returns {Object} An object with a list of anime and a boolean indicating if there's a next page.
     */
    async fetchAndParseCataloguePage(path) {
        const url = this.getBaseUrl() + path;
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);

        const list = [];
        // The selector needs to handle different page layouts (catalogue vs. search).
        const items = doc.select(".anime-card-container, div.row.posts-row article");

        for (const item of items) {
            const linkElement = item.selectFirst("div.anime-card-title h3 a, h3.post-title a");
            const imageElement = item.selectFirst("img.img-responsive");

            if (linkElement && imageElement) {
                const name = linkElement.text.trim();
                const link = linkElement.getHref.replace(/^https?:\/\/[^\/]+/, '');
                const imageUrl = imageElement.getSrc;
                list.push({ name, imageUrl, link });
            }
        }

        const hasNextPage = doc.selectFirst("ul.pagination li a.next, a.next.page-numbers") != null;
        return { list, hasNextPage };
    }

    getNumericQuality(quality) {
        const q = quality.toLowerCase();
        if (q.includes("fhd") || q.includes("1080")) return "1080p";
        if (q.includes("hd") || q.includes("720")) return "720p";
        if (q.includes("sd") || q.includes("480")) return "480p";
        return "Auto"; // Fallback
    }

    // --- CORE METHODS ---

    async getPopular(page) {
        const path = `/قائمة-الانمي/page/${page}/`;
        return this.fetchAndParseCataloguePage(path);
    }

    async getLatestUpdates(page) {
        const path = `/episode/page/${page}/`;
        const result = await this.fetchAndParseCataloguePage(path);

        // The latest updates page links to episodes, we need to convert them to anime detail pages.
        const fixedList = result.list.map(item => ({
            ...item,
            link: item.link
                .replace(/-%d8%a7%d9%84%d8%ad%d9%84%d9%82%d8%a9-.*$/, "") // Regex to remove episode part from URL
                .replace("/episode/", "/anime/")
        }));

        return { list: fixedList, hasNextPage: result.hasNextPage };
    }

    async search(query, page, filters) {
        let urlPath;

        // A search query takes precedence over filters.
        if (query) {
            urlPath = `/page/${page}/?s=${encodeURIComponent(query)}`;
        } else {
            const genreFilter = filters.find(f => f.name === "تصنيف الأنمي");
            const typeFilter = filters.find(f => f.name === "النوع");
            const seasonFilter = filters.find(f => f.name === "الموسم");

            // The website appears to only support one filter at a time.
            if (genreFilter && genreFilter.state > 0) {
                const value = genreFilter.values[genreFilter.state].value;
                urlPath = `/anime-genre/${value}/page/${page}/`;
            } else if (typeFilter && typeFilter.state > 0) {
                const value = typeFilter.values[typeFilter.state].value;
                // Movie and some other types use a different pagination parameter.
                urlPath = `/anime-type/${value}/page/${page}/`;
            } else if (seasonFilter && seasonFilter.state > 0) {
                const value = seasonFilter.values[seasonFilter.state].value;
                urlPath = `/anime-season/${value}/page/${page}/`;
            } else {
                // If no query and no filters, default to the main anime list.
                urlPath = `/قائمة-الانمي/page/${page}/`;
            }
        }
        return this.fetchAndParseCataloguePage(urlPath);
    }

    async getDetail(url) {
        const res = await this.client.get(this.getBaseUrl() + url, this.getHeaders(this.getBaseUrl() + url));
        const doc = new Document(res.body);

        const name = doc.selectFirst("h1.anime-details-title").text;
        const imageUrl = doc.selectFirst("img.anime-poster-img").getSrc;
        const description = doc.selectFirst("p.anime-story").text;
        const link = url;

        // Status mapping: 0=Ongoing, 1=Completed, 5=Unknown
        const statusText = doc.selectFirst("div.anime-info:contains(حالة الأنمي) a")?.text ?? '';
        const status = { "يعرض الان": 0, "مكتمل": 1 }[statusText] ?? 5;

        const genre = doc.select("ul.anime-genres > li > a").map(e => e.text);

        const chapters = [];
        const episodeElements = doc.select(".episodes-card-title h3 a");
        for (const element of episodeElements) {
            chapters.push({
                name: element.text.trim(),
                url: element.getHref.replace(/^https?:\/\/[^\/]+/, '')
            });
        }
        chapters.reverse(); // List is newest first, reverse for correct order.

        return { name, imageUrl, description, link, status, genre, chapters };
    }

    // --- VIDEO EXTRACTION ---

    async mp4uploadExtractor(url, quality) {
        const embedUrl = url.startsWith("//") ? "https:" + url : url;
        const embedHtml = (await this.client.get(embedUrl, this.getHeaders(embedUrl))).body;

        const sourceMatch = embedHtml.match(/player\.src\({[^}]+src:\s*"([^"]+)"/);
        if (sourceMatch && sourceMatch[1]) {
            const videoUrl = sourceMatch[1];
            return [{
                url: videoUrl,
                originalUrl: videoUrl,
                quality: quality,
                headers: { "Referer": embedUrl }
            }];
        }
        throw new Error("Mp4upload: Could not find video source.");
    }

    async getVideoList(url) {
        const res = await this.client.get(this.getBaseUrl() + url, this.getHeaders(this.getBaseUrl() + url));
        const doc = new Document(res.body);
        let videos = [];
        const hosterSelection = this.getPreference("hoster_selection") || ["Dood", "Voe", "Mp4upload", "Okru"];
        const headers = this.getHeaders(this.getBaseUrl() + url);

        const linkElements = doc.select('#episode-servers li a');
        for (const element of linkElements) {
            try {
                let streamUrl = element.attr('data-ep-url');
                const qualityText = element.text.trim();
                const serverName = qualityText.split(' - ')[0];

                if (streamUrl.startsWith("//")) {
                    streamUrl = "https:" + streamUrl;
                }

                const numericQuality = this.getNumericQuality(qualityText);
                const finalQualityString = `${serverName} - ${numericQuality}`;

                if (serverName.includes("Mp4upload") && hosterSelection.includes("Mp4upload")) {
                    const extracted = await this.mp4uploadExtractor(streamUrl, finalQualityString);
                    videos.push(...extracted);
                } else if (serverName.includes("Dood") && hosterSelection.includes("Dood")) {
                    videos.push({ url: streamUrl, quality: finalQualityString, headers });
                } else if (serverName.includes("Ok.ru") && hosterSelection.includes("Okru")) {
                    videos.push({ url: streamUrl, quality: finalQualityString, headers });
                } else if (serverName.includes("Voe.sx") && hosterSelection.includes("Voe")) {
                    videos.push({ url: streamUrl, quality: finalQualityString, headers });
                }
            } catch (e) {
                // Could be a dead link or unsupported hoster.
            }
        }

        const preferredQuality = this.getPreference("preferred_quality") || "720";
        videos.sort((a, b) => {
            const qualityA = parseInt(a.quality.match(/(\d+)p/)?.[1] || 0);
            const qualityB = parseInt(b.quality.match(/(\d+)p/)?.[1] || 0);
            if (a.quality.includes(preferredQuality)) return -1;
            if (b.quality.includes(preferredQuality)) return 1;
            return qualityB - qualityA;
        });

        return videos;
    }

    // --- FILTERS AND PREFERENCES ---

    getFilterList() {
        const genres = [
            { name: 'الكل', value: '' }, { name: 'أطفال', value: '%d8%a3%d8%b7%d9%81%d8%a7%d9%84' },
            { name: 'أكشن', value: '%d8%a3%d9%83%d8%b4%d9%86' }, { name: 'إيتشي', value: '%d8%a5%d9%8a%d8%aa%d8%b4%d9%8a' },
            { name: 'اثارة', value: '%d8%a7%d8%ab%d8%a7%d8%b1%d8%a9' }, { name: 'العاب', value: '%d8%a7%d9%84%d8%b9%d8%a7%d8%a8' },
            { name: 'بوليسي', value: '%d8%a8%d9%88%d9%84%d9%8a%d8%b3%d9%8a' }, { name: 'تاريخي', value: '%d8%aa%d8%a7%d8%b1%d9%8a%d8%ae%d9%8a' },
            { name: 'حربي', value: '%d8%ad%d8%b1%d8%a8%d9%8a' }, { name: 'حريم', value: '%d8%ad%d8%b1%d9%8a%d9%85' },
            { name: 'خارق للعادة', value: '%d8%ae%d8%a7%d8%b1%d9%82-%d9%84%d9%84%d8%b9%d8%a7%d8%af%d8%a9' }, { name: 'خيال علمي', value: '%d8%ae%d9%8a%d8%a7%d9%84-%d8%b9%d9%84%d9%85%d9%8a' },
            { name: 'دراما', value: '%d8%af%d8%b1%d8%a7%d9%85%d8%a7' }, { name: 'رعب', value: '%d8%b1%d8%b9%d8%a8' },
            { name: 'رومانسي', value: '%d8%b1%d9%88%d9%85%d8%a7%d9%86%d8%b3%d9%8a' }, { name: 'رياضي', value: '%d8%b1%d9%8a%d8%a7%d8%b6%d9%8a' },
            { name: 'ساموراي', value: '%d8%b3%d8%a7%d9%85%d9%88%d8%b1%d8%a7%d9%8a' }, { name: 'سحر', value: '%d8%b3%d8%ad%d8%b1' },
            { name: 'سينين', value: '%d8%b3%d9%8a%d9%86%d9%8a%d9%86' }, { name: 'شريحة من الحياة', value: '%d8%b4%d8%b1%d9%8a%d8%ad%d8%a9-%d9%85%d9%86-%d8%a7%d9%84%d8%ad%d9%8a%d8%a7%d8%a9' },
            { name: 'شوجو', value: '%d8%b4%d9%88%d8%ac%d9%88' }, { name: 'شونين', value: '%d8%b4%d9%88%d9%86%d9%8a%d9%86' },
            { name: 'شياطين', value: '%d8%b4%d9%8a%d8%a7%d8%b7%d9%8a%d9%86' }, { name: 'غموض', value: '%d8%ba%d9%85%d9%88%d8%b6' },
            { name: 'فضائي', value: '%d9%81%d8%b6%d8%a7%d8%a6%d9%8a' }, { name: 'فنتازيا', value: '%d9%81%d9%86%d8%aa%d8%a7%d8%b2%d9%8a%d8%a7' },
            { name: 'فنون قتالية', value: '%d9%81%d9%86%d9%88%d9%86-%d9%82%d8%aa%d8%a7%d9%84%d9%8a%d8%a9' }, { name: 'قوى خارقة', value: '%d9%82%d9%88%d9%89-%d8%ae%d8%a7%d8%b1%d9%82%d8%a9' },
            { name: 'كوميدي', value: '%d9%83%d9%88%d9%85%d9%8a%d8%af%d9%8a' }, { name: 'مدرسي', value: '%d9%85%d8%af%d8%b1%d8%b3%d9%8a' },
            { name: 'مصاصي دماء', value: '%d9%85%d8%b5%d8%a7%d8%b5%d9%8a-%d8%af%d9%85%d8%a7%d8%a1' }, { name: 'مغامرات', value: '%d9%85%d8%ba%d8%a7%d9%85%d8%b1%d8%a7%d8%aa' },
            { name: 'موسيقي', value: '%d9%85%d9%88%d8%b3%d9%8a%d9%82%d9%8a' }, { name: 'ميكا', value: '%d9%85%d9%8a%d9%83%d8%a7' },
            { name: 'نفسي', value: '%d9%86%d9%81%d8%b3%d9%8a' }
        ].map(g => ({ type_name: "SelectOption", name: g.name, value: g.value }));

        const types = [
            { name: 'الكل', value: '' }, { name: 'Movie', value: 'movie-3' }, { name: 'ONA', value: 'ona1' },
            { name: 'OVA', value: 'ova1' }, { name: 'Special', value: 'special1' }, { name: 'TV', value: 'tv2' }
        ].map(t => ({ type_name: "SelectOption", name: t.name, value: t.value }));

        const seasons = [{ name: 'الكل', value: '' }];
        const currentYear = new Date().getFullYear();
        for (let y = currentYear + 1; y >= 2010; y--) {
            seasons.push({ name: `ربيع ${y}`, value: `spring-${y}` });
            seasons.push({ name: `شتاء ${y}`, value: `winter-${y}` });
            seasons.push({ name: `صيف ${y}`, value: `summer-${y}` });
            seasons.push({ name: `خريف ${y}`, value: `fall-${y}` });
        }
        const seasonOptions = seasons.map(s => ({ type_name: "SelectOption", name: s.name, value: s.value }));

        return [{
            type_name: "HeaderFilter",
            name: "ملاحظة: لا يمكن إختيار أكثر من فلتر واحد في نفس الوقت. سيتم تجاهل الفلاتر في حال البحث"
        }, {
            type_name: "SelectFilter", name: "تصنيف الأنمي", state: 0, values: genres
        }, {
            type_name: "SelectFilter", name: "النوع", state: 0, values: types
        }, {
            type_name: "SelectFilter", name: "الموسم", state: 0, values: seasonOptions
        }];
    }

    getSourcePreferences() {
        return [{
            key: "override_base_url",
            editTextPreference: {
                title: "تجاوز عنوان URL الأساسي",
                summary: "استخدم دومين مختلف للمصدر",
                value: this.source.baseUrl,
                dialogTitle: "أدخل عنوان URL الأساسي الجديد",
                dialogMessage: "الإفتراضي: " + this.source.baseUrl,
            }
        }, {
            key: "preferred_quality",
            listPreference: {
                title: "الجودة المفضلة",
                summary: "اختر الجودة التي سيتم اختيارها تلقائيا",
                valueIndex: 1,
                entries: ["1080p", "720p", "480p", "360p"],
                entryValues: ["1080", "720", "480", "360"],
            }
        }, {
            key: "hoster_selection",
            multiSelectListPreference: {
                title: "اختر السيرفرات",
                summary: "اختر السيرفرات التي تريد ان تظهر",
                entries: ["Dood", "Voe", "Mp4upload", "Okru"],
                entryValues: ["Dood", "Voe", "Mp4upload", "Okru"],
                values: ["Dood", "Voe", "Mp4upload", "Okru"],
            }
        }];
    }
}
