const mangayomiSources = [{
    "name": "OkAnime",
    "id": 8374928374,
    "lang": "ar",
    "baseUrl": "https://ok.okanime.xyz",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://ok.okanime.xyz",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.2.7",
    "pkgPath": "anime/src/ar/okanime.js"
}];



// --- CLASS ---
class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
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

    // --- METHODS FROM YOUR CODE (UNCHANGED) ---

    async getPopular(page) {
        const doc = await this.requestDoc(`/anime-list/?page=${page}`);
        const list = [];

        const animeCards = doc.select("div.anime-card.anime-hover");
        for (const card of animeCards) {
            const animeTitleElement = card.selectFirst("div.anime-title h4 a");
            const episodeCountElement = card.selectFirst("div.anime-title h5 a");
            const imageElement = card.selectFirst("div.anime-image img");
            const linkElement = card.selectFirst("a.clickable");
            if (animeTitleElement && linkElement && imageElement) {
                list.push({
                    name: animeTitleElement.text.trim(),
                    link: linkElement.getHref,
                    imageUrl: imageElement.getSrc
                });
            }
        }

        const hasNextPage = doc.selectFirst('li.page-item > a[rel=next]') !== null;
        return { list, hasNextPage };
    }

    async getLatestUpdates(page) {
        const doc = await this.requestDoc(`/espisode-list?page=${page}`);
        const list = [];

        const animeCards = doc.select("div.anime-card.episode-card");

        for (const card of animeCards) {
            const animeTitleElement = card.selectFirst("div.anime-title h4 a");
            const episodeCountElement = card.selectFirst("div.anime-title h5 a");
            const imageElement = card.selectFirst("div.episode-image img");
            const linkElement = card.selectFirst("div.anime-title h4 a");

            if (animeTitleElement && linkElement && imageElement) {
                list.push({
                    name: `${animeTitleElement.text.trim()} - ${episodeCountElement?.text.trim() ?? ""}`,
                    link: linkElement.getHref,
                    imageUrl: imageElement.getSrc
                });
            }
        }

        const hasNextPage = doc.selectFirst('li.page-item > a[rel=next]') !== null;
        return { list, hasNextPage };
    }


    // This is the new getFilterList method you requested.
    getFilterList() {
        // Data for filters, extracted from the website
        const genres = [
            { name: 'الكل', value: '' },
            { name: 'أكشن', value: '%D8%A3%D9%83%D8%B4%D9%86' }, { name: 'حربي', value: '%D8%AD%D8%B1%D8%A8%D9%8A' },
            { name: 'غموض', value: '%D8%BA%D9%85%D9%88%D8%B6' }, { name: 'خارق للعادة', value: '%D8%AE%D8%A7%D8%B1%D9%82-%D9%84%D9%84%D8%B9%D8%A7%D8%AF%D8%A9' },
            { name: 'دراما', value: '%D8%AF%D8%B1%D8%A7%D9%85%D8%A7' }, { name: 'فنتازيا', value: '%D9%81%D9%86%D8%AA%D8%A7%D8%B2%D9%8A%D8%A7' },
            { name: 'شونين', value: '%D8%B4%D9%88%D9%86%D9%8A%D9%86' }, { name: 'مغامرات', value: '%D9%85%D8%BA%D8%A7%D9%85%D8%B1%D8%A7%D8%AA' },
            { name: 'العاب', value: '%D8%A7%D9%84%D8%B9%D8%A7%D8%A8' }, { name: 'رومانسي', value: '%D8%B1%D9%88%D9%85%D8%A7%D9%86%D8%B3%D9%8A' },
            { name: 'كوميدي', value: '%D9%83%D9%88%D9%85%D9%8A%D8%AF%D9%8A' }, { name: 'سحر', value: '%D8%B3%D8%AD%D8%B1' },
            { name: 'خيال علمي', value: '%D8%AE%D9%8A%D8%A7%D9%84-%D8%B9%D9%84%D9%85%D9%8A' },
            { name: 'قوى خارقة', value: '%D9%82%D9%88%D9%89-%D8%AE%D8%A7%D8%B1%D9%82%D8%A9' }, { name: 'رعب', value: '%D8%B1%D8%B9%D8%A8' },
            { name: 'نفسي', value: '%D9%86%D9%81%D8%B3%D9%8A' }, { name: 'سينين', value: '%D8%B3%D9%8A%D9%86%D9%8A%D9%86' },
            { name: 'مدرسي', value: '%D9%85%D8%AF%D8%B1%D8%B3%D9%8A' }, { name: 'فنون قتالية', value: '%D9%81%D9%86%D9%88%D9%86-%D9%82%D8%AA%D8%A7%D9%84%D9%8A%D8%A9' },
            { name: 'ميكا', value: '%D9%85%D9%8A%D9%83%D8%A7' }, { name: 'اثارة', value: '%D8%A7%D8%AB%D8%A7%D8%B1%D8%A9' },
            { name: 'شياطين', value: '%D8%B4%D9%8A%D8%A7%D8%B7%D9%8A%D9%86' }, { name: 'إيتشي', value: '%D8%A5%D9%8A%D8%AA%D8%B4%D9%8A' },
            { name: 'بوليسي', value: '%D8%A8%D9%88%D9%84%D9%8A%D8%B3%D9%8A' }, { name: 'فضائي', value: '%D9%81%D8%B6%D8%A7%D8%A6%D9%8A' },
            { name: 'شريحة من الحياة', value: '%D8%B4%D8%B1%D9%8A%D8%AD%D8%A9-%D9%85%D9%86-%D8%A7%D9%84%D8%AD%D9%8A%D8%A7%D8%A9' },
            { name: 'تاريخي', value: '%D8%AA%D8%A7%D8%B1%D9%8A%D8%AE%D9%8A' }, { name: 'ساموراي', value: '%D8%B3%D8%A7%D9%85%D9%88%D8%B1%D8%A7%D9%8A' },
            { name: 'مصاصي دماء', value: '%D9%85%D8%B5%D8%A7%D8%B5%D9%8A-%D8%AF%D9%85%D8%A7%D8%A1' },
            { name: 'حريم', value: '%D8%AD%D8%B1%D9%8A%D9%85' }, { name: 'شوجو', value: '%D8%B4%D9%88%D8%AC%D9%88' }
        ].map(g => ({ type_name: "SelectOption", name: g.name, value: g.value }));

        const types = [
            { name: 'الكل', value: '' }, { name: 'فيلم', value: '%D9%81%D9%8A%D9%84%D9%85' }, { name: 'فيلم', value: '%D9%81%D9%8A%D9%84%D9%85' },
            { name: 'أونا', value: '%D8%A3%D9%88%D9%86%D8%A7' }, { name: 'أوفا', value: '%D8%A3%D9%88%D9%81%D8%A7' },
            { name: 'حلقة خاصة', value: '%D8%AD%D9%84%D9%82%D8%A9-%D8%AE%D8%A7%D8%B5%D8%A9' }, { name: 'تلفزيون', value: '%D8%AA%D9%84%D9%81%D8%B2%D9%8A%D9%88%D9%86' }
        ].map(t => ({ type_name: "SelectOption", name: t.name, value: t.value }));
        
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
            name: "التصنيفات",
            state: 0,
            values: genres
        }, {
            type_name: "SelectFilter",
            name: "الأنواع",
            state: 0,
            values: types
        }, {
            type_name: "SelectFilter",
            name: "المواسم",
            state: 0,
            values: seasonOptions
        }];
    }
    
    // This search method is updated to handle the filters from getFilterList.
    async search(query, page, filters) {
        let url;
        let hasFilters = false;

        if (!query) {
            const categoryFilter = filters.find(f => f.name === "التصنيفات");
            const typeFilter = filters.find(f => f.name === "الأنواع");
            const seasonFilter = filters.find(f => f.name === "المواسم");

            if (categoryFilter && categoryFilter.state > 0) {
                const selectedCategoryValue = categoryFilter.values[categoryFilter.state].value;
                url = `${this.source.baseUrl}/anime-category/${selectedCategoryValue}/?page=${page}`;
                hasFilters = true;
            } else if (typeFilter && typeFilter.state > 0) {
                const selectedTypeValue = typeFilter.values[typeFilter.state].value;
                url = `${this.source.baseUrl}/anime-type/${selectedTypeValue}/?page=${page}`;
                hasFilters = true;
            } else if (seasonFilter && seasonFilter.state > 0) {
                const selectedSeasonValue = seasonFilter.values[seasonFilter.state].value;
                url = `${this.source.baseUrl}/anime-season/${selectedSeasonValue}/?page=${page}`;
                hasFilters = true;
            }
        }
        
		if (query) {
        // ✅ اصلاح الرابط حسب رقم الصفحة
            url = page === 1
                ? `${this.source.baseUrl}/search/?s=${encodeURIComponent(query)}`
                : `${this.source.baseUrl}/search/?s=${encodeURIComponent(query)}&page=${page}`;
        } else if (!hasFilters) {
            url = `${this.source.baseUrl}/anime-list/?page=${page}`;
        }

        const doc = await this.requestDoc(url.replace(this.source.baseUrl, ''));
        const list = [];
        // Using the same parsing logic as your original search method.
        const animeCards = doc.select("div.anime-card.anime-hover");
        for (const card of animeCards) {
            const animeTitleElement = card.selectFirst("div.anime-title h4 a");
            const imageElement = card.selectFirst("div.anime-image img");
            // Adjusted link element selector to be more reliable for all list pages
            const linkElement = card.selectFirst("a.clickable") ?? animeTitleElement;
            if (animeTitleElement && linkElement && imageElement) {
                list.push({
                    name: animeTitleElement.text.trim(),
                    link: linkElement.getHref,
                    imageUrl: imageElement.getSrc
                });
            }
        }

        const hasNextPage = doc.selectFirst('li.page-item > a[rel=next]') !== null;
        return { list, hasNextPage };
    }


    // --- METHODS FROM YOUR CODE (UNCHANGED) ---

    statusCode(status) {
        return { "يعرض الان": 0, "مكتمل": 1 }[status] ?? 5;
    }

    async getDetail(url) {
        const doc = await this.requestDoc(url.replace(this.source.baseUrl, ''));
        const chapters = [];
        const genre = [];

        const statusText = doc.selectFirst('.full-list-info:contains(حالة الأنمي) small a')?.text ?? '';
        const description = doc.selectFirst('.review-content')?.text ?? '';

        doc.select('.review-author-info a').forEach(a => genre.push(a.text));

        doc.select('div.anime-card.episode-card').forEach(card => {
            const linkElement = card.selectFirst('.anime-title h5 a');
            if (linkElement) {
                chapters.push({ name: linkElement.text.trim(), url: linkElement.getHref });
            }
        });

        return {
            description,
            status: this.statusCode(statusText),
            genre,
            chapters: chapters.reverse()
        };
    }

    getQuality(quality) {
        quality = quality.replaceAll(" ", "");
        if (quality === "HD") return "720p";
        if (quality === "FHD") return "1080p";
        if (quality === "SD") return "480p";
        return "240p";
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

        throw new Error("Mp4upload Extractor: Could not find the video source in the embed page.");
    }

    async getVideoList(url) {
        const doc = await this.requestDoc(url.replace(this.source.baseUrl, ''));
        let videos = [];
        const hosterSelection = this.getPreference("hoster_selection");
        const headersForStandardHosts = this.getHeaders(url);

        const linkElements = doc.select('#streamlinks a.ep-link');
        for (const element of linkElements) {
            try {
                const streamUrl = element.attr('data-src');
                const qualityText = element.selectFirst('span').text;
                const quality = this.getQuality(qualityText);

                if (streamUrl.includes("mp4upload") && hosterSelection.includes("Mp4upload")) {
                    const extractedVideos = await this.mp4uploadExtractor(streamUrl, `Mp4upload - ${quality}`);
                    videos.push(...extractedVideos);
                } else if (hosterSelection.includes("Dood") && streamUrl.includes("https://doo")) {
                    videos.push({ url: streamUrl, quality: `Dood - ${quality}`, headers: headersForStandardHosts });
                } else if (hosterSelection.includes("Okru") && streamUrl.includes("ok.ru")) {
                    videos.push({ url: streamUrl, quality: `Okru - ${quality}`, headers: headersForStandardHosts });
                } else if (hosterSelection.includes("Voe") && streamUrl.includes("voe.sx")) {
                    videos.push({ url: streamUrl, quality: `Voe - ${quality}`, headers: headersForStandardHosts });
                }
            } catch (e) {
                console.log(`Error processing hoster: ${e}`);
            }
        }

        const preferredQuality = this.getPreference("preferred_quality");
        videos.sort((a, b) => {
            const qualityMatchA = a.quality.includes(preferredQuality) ? 1 : 0;
            const qualityMatchB = b.quality.includes(preferredQuality) ? 1 : 0;
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