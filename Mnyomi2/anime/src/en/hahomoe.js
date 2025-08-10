const mangayomiSources = [{
    "name": "Hahomoe",
    "id": 690217538,
    "lang": "en",
    "baseUrl": "https://haho.moe",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=haho.moe",
    "typeSource": "single",
    "itemType": 1,
    "isNsfw": true,
    "version": "1.0.1",
    "pkgPath": "anime/src/en/hahomoe.js"
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
        return this.source.baseUrl;
    }

    getHeaders(url) {
        return {
            "Referer": this.getBaseUrl(),
            "Origin": this.getBaseUrl(),
            "Cookie": "loop-view=thumb",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        };
    }

    // --- UTILITIES ---

    parseDate(dateStr) {
        if (!dateStr) return "";
        try {
            const cleanedDate = dateStr.trim().replace(/(\d+)(st|nd|rd|th)/, "$1").replace(" of ", " ");
            return new Date(cleanedDate).valueOf().toString();
        } catch (e) {
            return "";
        }
    }

    // --- CORE METHODS ---

    async getPopular(page) {
        const url = `${this.getBaseUrl()}/anime?s=vdy-d&page=${page}`;
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        const list = [];
        const items = doc.select("ul.anime-loop.loop > li > a");
        for (const item of items) {
            const name = item.selectFirst("div.label > span, span.thumb-title").text;
            const link = item.getHref + "?s=srt-d";
            const imageUrl = item.selectFirst("img")?.getSrc;
            list.push({ name, imageUrl, link });
        }
        const hasNextPage = doc.selectFirst("ul.pagination li.page-item a[rel=next]") != null;
        return { list, hasNextPage };
    }

    async getLatestUpdates(page) {
        const url = `${this.getBaseUrl()}/anime?s=rel-d&page=${page}`;
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        const list = [];
        const items = doc.select("ul.anime-loop.loop > li > a");
        for (const item of items) {
            const name = item.selectFirst("div.label > span, span.thumb-title").text;
            const link = item.getHref + "?s=srt-d";
            const imageUrl = item.selectFirst("img")?.getSrc;
            list.push({ name, imageUrl, link });
        }
        const hasNextPage = doc.selectFirst("ul.pagination li.page-item a[rel=next]") != null;
        return { list, hasNextPage };
    }

    async search(query, page, filters) {
        let sort = "rel-d";
        let type = "";
        let censorship = "";
        let source = "";
        let year = "";
        const includedGenres = [];
        const excludedGenres = [];

        for (const filter of filters) {
            if (filter.type_name === "SelectFilter") {
                const selectedValue = filter.values[filter.state].value;
                if (filter.name === "Sort By") {
                    sort = selectedValue;
                } else if (filter.name === "Type") {
                    type = selectedValue;
                } else if (filter.name === "Censorship") {
                    censorship = selectedValue;
                } else if (filter.name === "Source") {
                    source = selectedValue;
                }
            } else if (filter.type_name === "TextFilter" && filter.name === "Year") {
                year = filter.state;
            } else if (filter.type_name === "GroupFilter" && filter.name === "Genres") {
                for (const genre of filter.state) {
                    if (genre.state) includedGenres.push(genre.value);
                }
            } else if (filter.type_name === "GroupFilter" && filter.name === "Excluded Genres") {
                for (const genre of filter.state) {
                    if (genre.state) excludedGenres.push(genre.value);
                }
            }
        }

        let httpQuery = query.trim();
        if (type) httpQuery += ` type:${type}`;
        if (censorship) httpQuery += ` censorship:${censorship}`;
        if (source) httpQuery += ` source:${source}`;
        if (year) httpQuery += ` year:${year}`;
        if (includedGenres.length > 0) httpQuery += includedGenres.map(g => ` genre:${g}`).join('');
        if (excludedGenres.length > 0) httpQuery += excludedGenres.map(g => ` -genre:${g}`).join('');

        const encodedQuery = encodeURIComponent(httpQuery);
        const url = `${this.getBaseUrl()}/anime?page=${page}&s=${sort}&q=${encodedQuery}`;

        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        const list = [];
        const items = doc.select("ul.anime-loop.loop > li > a");
        for (const item of items) {
            const name = item.selectFirst("div.label > span, span.thumb-title").text;
            const link = item.getHref + "?s=srt-d"; // Append sort param to detail view
            const imageUrl = item.selectFirst("img")?.getSrc;
            list.push({ name, imageUrl, link });
        }
        const hasNextPage = doc.selectFirst("ul.pagination li.page-item a[rel=next]") != null;
        return { list, hasNextPage };
    }


    /**
     * Fetches the details for a specific anime/movie.
     * @param {string} url The URL of the anime/movie.
     * @returns {Object} A MediaDetail object.
     */
    async getDetail(url) {
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);

        const entry = doc.selectFirst("article.anime-entry");
        if (!entry) throw new Error("Main content <article> not found. Website layout may have changed.");

        const name = entry.selectFirst("header h1")?.text ?? "Unknown Title";
        const imageUrl = entry.selectFirst("img.cover-image.img-thumbnail")?.getSrc;

        // --- Rich Description Builder ---
        const details = [];
        const mainInfo = entry.selectFirst("section.main-info");
        const addDetail = (label, value) => {
            if (value && value.trim()) details.push(`${label.padEnd(15, ' ')}\t${value.trim()}`);
        };

        const officialTitle = mainInfo?.select("li.official-title .value").map(el => el.text.replace(/\s+/g, ' ').trim()).join(' / ');
        addDetail("Japanese Title", officialTitle);
        const synonym = mainInfo?.select("li.synonym .value").map(el => el.text.replace(/\s+/g, ' ').trim()).join(' / ');
        addDetail("English Synonym", synonym);
        addDetail("Type", mainInfo?.selectFirst("li.type .value a")?.text);

        const statusText = mainInfo?.selectFirst("li.status .value a")?.text;
        addDetail("Status", statusText);

        addDetail("Release Date", mainInfo?.selectFirst("li.release-date .value")?.text);
        addDetail("Views", mainInfo?.selectFirst("li.views .value")?.text);
        addDetail("Bookmark Count", entry.selectFirst("span.bkm_cnt")?.text);
        addDetail("Rating", `${entry.selectFirst("span.rtg_avg")?.text} / 5.00`);
        addDetail("Content Rating", mainInfo?.selectFirst("li.content-rating .value a")?.text);
        addDetail("Censorship", mainInfo?.selectFirst("li.censorship .value a")?.text);
        addDetail("Source", mainInfo?.selectFirst("li.source .value a")?.text);
        addDetail("Resolutions", mainInfo?.select("li.resolution .value a").map(e => e.text.trim()).join(' • '));
        addDetail("Production", mainInfo?.select("li.production .value a").map(e => e.text.trim()).join(' & '));
        addDetail("Group", mainInfo?.select("li.group .value a").map(e => e.text.trim()).join(' & '));
        const audio = mainInfo?.select("li.audio a.flag-icon").map(e => e.attr("title")).join(' / ');
        const subs = mainInfo?.select("li.subtitle a.flag-icon").map(e => e.attr("title")).join(' / ');
        addDetail("Audio / Subs", `${audio} / ${subs}`);

        const synopsis = entry.selectFirst("section.entry-description div.card-body")?.text.trim() ?? "No description available.";
        const description = details.join('\n') + "\n\n" + synopsis;
        // --- End Rich Description Builder ---

        const status = statusText?.toLowerCase().includes("ongoing") ? 0 : statusText?.toLowerCase().includes("completed") ? 1 : 5;
        const genre = [];
        mainInfo?.select("li.type .value a, li.content-rating .value a, li.censorship .value a").forEach(element => {
            genre.push(element.text.trim());
        });
        const author = mainInfo?.select("li.production .value a").map(e => e.text.trim()).join(', ');
        const artist = mainInfo?.select("li.group .value a").map(e => e.text.trim()).join(', ');

        const chapters = [];
        for (const element of entry.select("ul.episode-loop > li > a")) {
            const epNumStr = element.selectFirst("div.episode-number, div.episode-slug")?.text ?? "Episode";
            const epTitle = element.selectFirst("div.episode-label, div.episode-title")?.text.replace(/No Title/i, "").trim() ?? "";
            const epName = epTitle ? `${epNumStr}: ${epTitle}` : epNumStr;
            const epUrl = element.getHref;
            const dateStr = element.selectFirst("div.date")?.text ?? "";
            chapters.push({ name: epName, url: epUrl, dateUpload: this.parseDate(dateStr) });
        }
        chapters.reverse();

        return { name, imageUrl, description, link: url, status, genre, author, artist, chapters };
    }

    async getVideoList(url) {
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        const iframeSrc = doc.selectFirst("iframe")?.getSrc;
        if (!iframeSrc) return [];

        const iframeHeaders = { ...this.getHeaders(iframeSrc), "Referer": url };
        const iframeRes = await this.client.get(iframeSrc, iframeHeaders);
        const iframeDoc = new Document(iframeRes.body);

        const streams = [];
        for (const source of iframeDoc.select("source")) {
            const streamUrl = source.attr("src");
            const quality = source.attr("title") || "Default";
            if (streamUrl) {
                streams.push({ url: streamUrl, originalUrl: streamUrl, quality, headers: this.getHeaders(streamUrl) });
            }
        }
        return streams;
    }

    // --- FILTERS AND PREFERENCES ---

    getFilterList() {
        const sortValues = [
            { name: "Popular Today", value: "vdy-d" },
            { name: "Popular This Week", value: "vwk-d" },
            { name: "Popular This Month", value: "vmt-d" },
            { name: "Popular This Year", value: "vyr-d" },
            { name: "All-Time Popular", value: "vtt-d" },
            { name: "Latest Released", value: "rel-d" },
            { name: "Last Added", value: "add-d" },
            { name: "Highest Rated", value: "rtg-d" },
            { name: "Title A-Z", value: "ttl-a" },
            { name: "Title Z-A", value: "ttl-d" }
        ];

        const typeValues = [
            { name: "Any", value: "" },
            { name: "OVA", value: "ova" },
            { name: "Web", value: "web" },
            { name: "Movie", value: "movie" },
            { name: "TV Series", value: "tv-series" },
            { name: "TV Special", value: "tv-special" },
            { name: "Other", value: "other" }
        ];

        const censorshipValues = [
            { name: "Any", value: "" },
            { name: "Censored", value: "censored" },
            { name: "Uncensored", value: "uncensored" }
        ];

        const sourceValues = [
            { name: "Any", value: "" },
            { name: "Blu-ray", value: "bd" },
            { name: "DVD", value: "dvd" },
            { name: "Web", value: "web" },
            { name: "TV", value: "tv" },
            { name: "VHS", value: "vhs" }
        ];

        const genres = [
            "Ahegao", "Action", "Adventure", "Alien", "Anal Sex", "Android",
            "Angel", "BDSM", "Beastiality", "Big Breasts", "Blackmail",
            "Bondage", "Comedy", "Cosplay", "Creampie", "Crossdressing", "Cunnilingus",
            "Dark Skin", "Demon", "Dementia", "Ecchi", "Elf", "Exhibitionism",
            "Fantasy", "Futanari", "Gangbang", "Gender Bender", "Ghost", "Glasses",
            "Gore", "Group", "Gyaru", "Harem", "Horror", "Humiliation", "Idol", "Incest",
            "Inflation", "Isekai", "Loli", "Magic", "Maid", "MILF", "Military",
            "Mind Break", "Mind Control", "Monster", "Monster Girl", "Necomimi",
            "Netorare", "Nurse", "Orgy", "Parody", "Police", "Pregnant",
            "Prison", "Public Sex", "Rape", "Reverse Rape", "Romance", "School", "School Girl",
            "Sci-Fi", "Shota", "Slime", "Space", "Sports", "Succubus", "Supernatural",
            "Swimsuit", "Teacher", "Tentacles", "Threesome", "Tomboy", "Toys", "Trap",
            "Tsundere", "Ugly Bastard", "Vampire", "Vanilla", "Virgin", "Vore", "Voyeurism",
            "Watersports", "Yaoi", "Yuri"
        ];

        const genreValues = genres.map(g => g.toLowerCase().replace(/\s+/g, "-"));

        return [{
            type_name: "SelectFilter",
            name: "Sort By",
            state: 5, // Default to "Latest Released"
            values: sortValues.map(v => ({ type_name: "SelectOption", name: v.name, value: v.value }))
        }, {
            type_name: "HeaderFilter",
            name: "Content Filters (applied via search query)"
        }, {
            type_name: "SelectFilter",
            name: "Type",
            state: 0,
            values: typeValues.map(v => ({ type_name: "SelectOption", name: v.name, value: v.value }))
        }, {
            type_name: "SelectFilter",
            name: "Censorship",
            state: 0,
            values: censorshipValues.map(v => ({ type_name: "SelectOption", name: v.name, value: v.value }))
        }, {
            type_name: "SelectFilter",
            name: "Source",
            state: 0,
            values: sourceValues.map(v => ({ type_name: "SelectOption", name: v.name, value: v.value }))
        }, {
            type_name: "TextFilter",
            name: "Year",
            state: ""
        }, {
            type_name: "SeparatorFilter"
        }, {
            type_name: "GroupFilter",
            name: "Genres",
            state: genres.map((genre, i) => ({ type_name: "CheckBox", name: genre, value: genreValues[i], state: false }))
        }, {
            type_name: "SeparatorFilter"
        }, {
            type_name: "GroupFilter",
            name: "Excluded Genres",
            state: genres.map((genre, i) => ({ type_name: "CheckBox", name: genre, value: genreValues[i], state: false }))
        }];
    }

    getSourcePreferences() {
        return [{
            key: "preferred_quality",
            listPreference: {
                title: "Preferred Video Quality",
                summary: "Select the quality to be prioritized by the player. Requires app restart.",
                valueIndex: 1, // Default to 720p
                entries: ["1080p", "720p", "480p", "360p", "Auto"],
                entryValues: ["1080", "720", "480", "360", "auto"],
            }
        }];
    }
}
