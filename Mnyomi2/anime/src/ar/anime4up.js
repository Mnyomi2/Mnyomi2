const mangayomiSources = [{
    "name": "Anime4up",
    "id": 8374956845,
    "lang": "ar",
    "baseUrl": "https://ww.anime4up.rest",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://ww.anime4up.rest",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.5.4",
    "pkgPath": "anime/src/ar/anime4up.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        // The base URL might need to be updated if the site changes it.
        // The override preference allows users to do this manually.
        this.source.baseUrl = this.getPreference("override_base_url") ?? "https://anime4up.rest";
    }

    getPreference(key) {
        const value = new SharedPreferences().get(key);
        if (key === "hoster_selection") {
            return value ?? ["Dood", "Voe", "Mp4upload", "Okru"];
        }
        if (key === "preferred_quality") {
            return value ?? "720";
        }
        return value;
    }

    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Referer": url,
        };
    }

    async request(url) {
        const referer = url.includes(this.source.baseUrl) ? this.source.baseUrl + "/" : url;
        const res = await this.client.get(url, this.getHeaders(referer));
        return res.body;
    }

    async requestDoc(path) {
        const url = this.source.baseUrl + path;
        const res = await this.client.get(url, this.getHeaders(this.source.baseUrl + "/"));
        return new Document(res.body);
    }

    parseAnimeListPage(doc) {
        const list = [];
        const items = doc.select(".anime-card-container, div.row.posts-row article"); // Added second selector for search results
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
        const hasNextPage = doc.selectFirst("ul.pagination li a.next, a.next.page-numbers") !== null;
        return { list, hasNextPage };
    }

    getNumericQuality(quality) {
        quality = quality.toLowerCase();
        if (quality.includes("fhd") || quality.includes("1080")) return "1080p";
        if (quality.includes("hd") || quality.includes("720")) return "720p";
        if (quality.includes("sd") || quality.includes("480")) return "480p";
        return "720p";
    }


    async getPopular(page) {
        const doc = await this.requestDoc(`/قائمة-الانمي/page/${page}/`);
        return this.parseAnimeListPage(doc);
    }

    async getLatestUpdates(page) {
        const slug = `/episode/page/${page}/`;
        const doc = await this.requestDoc(slug);
        const result = this.parseAnimeListPage(doc);
        const fixedList = result.list.map(item => {
            const newLink = item.link
                .replace(/-%d8%a7%d9%84%d8%ad%d9%84%d9%82%d8%a9-.*$/, "")
                .replace("/episode/", "/anime/");
            return { ...item, link: newLink };
        });
        return { list: fixedList, hasNextPage: result.hasNextPage };
    }

    //
    // FIXED SECTION: getFilterList()
    //
    getFilterList() {
        // Genre values are correct as they use URL-encoded Arabic.
        const genres = [
            { name: 'الكل', value: '' },
            { name: 'أطفال', value: '%d8%a3%d8%b7%d9%81%d8%a7%d9%84' }, { name: 'أكشن', value: '%d8%a3%d9%83%d8%b4%d9%86' },
            { name: 'إيتشي', value: '%d8%a5%d9%8a%d8%aa%d8%b4%d9%8a' }, { name: 'اثارة', value: '%d8%a7%d8%ab%d8%a7%d8%b1%d8%a9' },
            { name: 'العاب', value: '%d8%a7%d9%84%d8%b9%d8%a7%d8%a8' }, { name: 'بوليسي', value: '%d8%a8%d9%88%d9%84%d9%8a%d8%b3%d9%8a' },
            { name: 'تاريخي', value: '%d8%aa%d8%a7%d8%b1%d9%8a%d8%ae%d9%8a' }, { name: 'حربي', value: '%d8%ad%d8%b1%d8%a8%d9%8a' },
            { name: 'حريم', value: '%d8%ad%d8%b1%d9%8a%d9%85' }, { name: 'خارق للعادة', value: '%d8%ae%d8%a7%d8%b1%d9%82-%d9%84%d9%84%d8%b9%d8%a7%d8%af%d8%a9' },
            { name: 'خيال علمي', value: '%d8%ae%d9%8a%d8%a7%d9%84-%d8%b9%d9%84%d9%85%d9%8a' }, { name: 'دراما', value: '%d8%af%d8%b1%d8%a7%d9%85%d8%a7' },
            { name: 'رعب', value: '%d8%b1%d8%b9%d8%a8' }, { name: 'رومانسي', value: '%d8%b1%d9%88%d9%85%d8%a7%d9%86%d8%b3%d9%8a' },
            { name: 'رياضي', value: '%d8%b1%d9%8a%d8%a7%d8%b6%d9%8a' }, { name: 'ساموراي', value: '%d8%b3%d8%a7%d9%85%d9%88%d8%b1%d8%a7%d9%8a' },
            { name: 'سحر', value: '%d8%b3%d8%ad%d8%b1' }, { name: 'سينين', value: '%d8%b3%d9%8a%d9%86%d9%8a%d9%86' },
            { name: 'شريحة من الحياة', value: '%d8%b4%d8%b1%d9%8a%d8%ad%d8%a9-%d9%85%d9%86-%d8%a7%d9%84%d8%ad%d9%8a%d8%a7%d8%a9' },
            { name: 'شوجو', value: '%d8%b4%d9%88%d8%ac%d9%88' }, { name: 'شونين', value: '%d8%b4%d9%88%d9%86%d9%8a%d9%86' },
            { name: 'شياطين', value: '%d8%b4%d9%8a%d8%a7%d8%b7%d9%8a%d9%86' }, { name: 'غموض', value: '%d8%ba%d9%85%d9%88%d8%b6' },
            { name: 'فضائي', value: '%d9%81%d8%b6%d8%a7%d8%a6%d9%8a' }, { name: 'فنتازيا', value: '%d9%81%d9%86%d8%aa%d8%a7%d8%b2%d9%8a%d8%a7' },
            { name: 'فنون قتالية', value: '%d9%81%d9%86%d9%88%d9%86-%d9%82%d8%aa%d8%a7%d9%84%d9%8a%d8%a9' },
            { name: 'قوى خارقة', value: '%d9%82%d9%88%d9%89-%d8%ae%d8%a7%d8%b1%d9%82%d8%a9' }, { name: 'كوميدي', value: '%d9%83%d9%88%d9%85%d9%8a%d8%af%d9%8a' },
            { name: 'مدرسي', value: '%d9%85%d8%af%d8%b1%d8%b3%d9%8a' }, { name: 'مصاصي دماء', value: '%d9%85%d8%b5%d8%a7%d8%b5%d9%8a-%d8%af%d9%85%d8%a7%d8%a1' },
            { name: 'مغامرات', value: '%d9%85%d8%ba%d8%a7%d9%85%d8%b1%d8%a7%d8%aa' }, { name: 'موسيقي', value: '%d9%85%d9%88%d8%b3%d9%8a%d9%82%d9%8a' },
            { name: 'ميكا', value: '%d9%85%d9%8a%d9%83%d8%a7' }, { name: 'نفسي', value: '%d9%86%d9%81%d8%b3%d9%8a' }
        ].map(g => ({ type_name: "SelectOption", name: g.name, value: g.value }));

        // Corrected type values to match the website's slugs.
        const types = [
            { name: 'الكل', value: '' },
            { name: 'Movie', value: 'movie-3' },
            { name: 'ONA', value: 'ona1' },
            { name: 'OVA', value: 'ova1' },
            { name: 'Special', value: 'special1' },
            { name: 'TV', value: 'tv2' }
        ].map(t => ({ type_name: "SelectOption", name: t.name, value: t.value }));

        // Season logic is correct.
        const seasons = [{ name: 'الكل', value: '' }];
        const currentYear = new Date().getFullYear();
        for (let year = currentYear + 1; year >= 2010; year--) {
            seasons.push({ name: `ربيع ${year}`, value: encodeURIComponent(`ربيع-${year}`) });
            seasons.push({ name: `شتاء ${year}`, value: encodeURIComponent(`شتاء-${year}`) });
            seasons.push({ name: `صيف ${year}`, value: encodeURIComponent(`صيف-${year}`) });
            seasons.push({ name: `خريف ${year}`, value: encodeURIComponent(`خريف-${year}`) });
        }
        const seasonOptions = seasons.map(s => ({ type_name: "SelectOption", name: s.name, value: s.value }));

        return [{
            type_name: "HeaderFilter",
            name: "ملاحظة: لا يمكن إختيار أكثر من فلتر واحد في نفس الوقت. سيتم تجاهل الفلاتر في حال البحث"
        }, {
            type_name: "SelectFilter",
            name: "تصنيف الأنمي", // Name changed for clarity
            state: 0,
            values: genres
        }, {
            type_name: "SelectFilter",
            name: "النوع", // Name changed to match website
            state: 0,
            values: types
        }, {
            type_name: "SelectFilter",
            name: "الموسم", // Name changed to match website
            state: 0,
            values: seasonOptions
        }];
    }
    
    //
    // FIXED SECTION: search()
    //
    async search(query, page, filters) {
        let urlPath;
        let hasFilters = false;

        // If a search query is present, it takes precedence.
        if (query) {
            urlPath = `/page/${page}/?s=${encodeURIComponent(query)}`;
        } else {
            // Check filters only if there is no search query.
            const genreFilter = filters.find(f => f.name === "تصنيف الأنمي");
            const typeFilter = filters.find(f => f.name === "النوع");
            const seasonFilter = filters.find(f => f.name === "الموسم");

            // Website only supports one filter at a time.
            if (genreFilter && genreFilter.state > 0) {
                const selectedGenreValue = genreFilter.values[genreFilter.state].value;
                // Corrected path from /anime-category/ to /anime-genre/
                urlPath = `/anime-genre/${selectedGenreValue}/page/${page}/`;
                hasFilters = true;
            } else if (typeFilter && typeFilter.state > 0) {
                const selectedTypeValue = typeFilter.values[typeFilter.state].value;
                urlPath = `/anime-type/${selectedTypeValue}/?page=${page}`; // Movie page uses ?page= instead of /page/
                hasFilters = true;
            } else if (seasonFilter && seasonFilter.state > 0) {
                const selectedSeasonValue = seasonFilter.values[seasonFilter.state].value;
                urlPath = `/anime-season/${selectedSeasonValue}/page/${page}/`;
                hasFilters = true;
            }
        }
        
        // If no query and no filters, use the main anime list page.
		if (!query && !hasFilters) {
            // Corrected path from /anime-list/ to the actual path.
            urlPath = `/قائمة-الانمي/page/${page}/`;
        }

        const doc = await this.requestDoc(urlPath);
        return this.parseAnimeListPage(doc);
    }

    statusCode(status) {
        return { "يعرض الان": 0, "مكتمل": 1 }[status] ?? 5;
    }

    async getDetail(url) {
        const doc = await this.requestDoc(url.replace(this.source.baseUrl, ''));
        const chapters = [];
        const genre = [];

        const statusText = doc.selectFirst('div.anime-info:contains(حالة الأنمي) a')?.text ?? '';
        const description = doc.selectFirst('p.anime-story')?.text ?? 'No description available.';

        doc.select('ul.anime-genres > li > a').forEach(a => genre.push(a.text));

        doc.select('.episodes-card-title h3 a').forEach(linkElement => {
            chapters.push({ 
                name: linkElement.text.trim(), 
                url: linkElement.getHref.replace(/^https?:\/\/[^\/]+/, '')
            });
        });

        return {
            description,
            status: this.statusCode(statusText),
            genre,
            chapters: chapters.reverse()
        };
    }
    
    async mp4uploadExtractor(url, quality) {
        if (url.startsWith("//")) {
            url = "https:" + url;
        }

        const embedHtml = await this.request(url);
        const sourceMatch = embedHtml.match(/player\.src\({[^}]+src:\s*"([^"]+)"/);

        if (sourceMatch && sourceMatch[1]) {
            const videoUrl = sourceMatch[1];
            return [{
                url: videoUrl,
                originalUrl: videoUrl,
                quality: quality,
                headers: { "Referer": url }
            }];
        }
        throw new Error("Mp4upload Extractor: Could not find the video source.");
    }

    async getVideoList(url) {
        const doc = await this.requestDoc(url.replace(this.source.baseUrl, ''));
        let videos = [];
        const hosterSelection = this.getPreference("hoster_selection");
        const headersForStandardHosts = this.getHeaders(url);

        const linkElements = doc.select('#episode-servers li a');
        for (const element of linkElements) {
            try {
                let streamUrl = element.attr('data-ep-url');
                const qualityText = element.text.trim();
                const lowerCaseQualityText = qualityText.toLowerCase();

                if (streamUrl.startsWith("//")) {
                    streamUrl = "https:" + streamUrl;
                }

                const serverName = qualityText.split(' - ')[0];
                const numericQuality = this.getNumericQuality(qualityText);
                const finalQualityString = `${serverName} - ${numericQuality}`;

                if (lowerCaseQualityText.includes("mp4upload") && hosterSelection.includes("Mp4upload")) {
                    const extractedVideos = await this.mp4uploadExtractor(streamUrl, finalQualityString);
                    videos.push(...extractedVideos);
                } else if (lowerCaseQualityText.includes("dood") && hosterSelection.includes("Dood")) {
                    videos.push({ url: streamUrl, quality: finalQualityString, headers: headersForStandardHosts });
                } else if (lowerCaseQualityText.includes("ok.ru") && hosterSelection.includes("Okru")) {
                    videos.push({ url: streamUrl, quality: finalQualityString, headers: headersForStandardHosts });
                } else if (lowerCaseQualityText.includes("voe.sx") && hosterSelection.includes("Voe")) {
                    videos.push({ url: streamUrl, quality: finalQualityString, headers: headersForStandardHosts });
                }
            } catch (e) {
                console.log(`Error processing hoster: ${e}`);
            }
        }

        const preferredQuality = this.getPreference("preferred_quality");
        videos.sort((a, b) => {
            const qualityMatchA = a.quality.includes(preferredQuality);
            const qualityMatchB = b.quality.includes(preferredQuality);
            if (qualityMatchA !== qualityMatchB) return qualityMatchB - qualityMatchA;

            const regex = /(\d+)p/;
            const matchA = a.quality.match(regex);
            const matchB = b.quality.match(regex);
            const qualityNumA = matchA ? parseInt(matchA[1]) : 0;
            const qualityNumB = matchB ? parseInt(matchB[1]) : 0;
            return qualityNumB - qualityNumA;
        });

        if (videos.length === 0) {
            throw new Error("No videos found from enabled hosters.");
        }
        return videos;
    }

    getSourcePreferences() {
        return [{
            key: "override_base_url",
            editTextPreference: {
                title: "Override Base URL",
                summary: "Use a different mirror/domain for the source",
                value: this.source.baseUrl,
                dialogTitle: "Enter new Base URL",
                dialogMessage: "Default: " + this.source.baseUrl,
            }
        }, {
			key: "preferred_quality",
            listPreference: {
                title: "Preferred Quality",
                summary: "",
                valueIndex: 1,
                entries: ["1080p", "720p", "480p", "360p"],
                entryValues: ["1080", "720", "480", "360"],
            }
        }, {
            key: "hoster_selection",
            multiSelectListPreference: {
                title: "Enable/Disable Hosts",
                summary: "",
                entries: ["Dood", "Voe", "Mp4upload", "Okru"],
                entryValues: ["Dood", "Voe", "Mp4upload", "Okru"],
                values: ["Dood", "Voe", "Mp4upload", "Okru"],
            }
        }];
    }
}