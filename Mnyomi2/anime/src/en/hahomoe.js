// --- METADATA ---
const mangayomiSources = [{
    "name": "Haho.moe",
    "id": 5195842838023485,
    "lang": "en",
    "baseUrl": "https://haho.moe",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=haho.moe",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.1", // Version bump for new preference
    "pkgPath": "anime/src/en/hahomoe.js"
}];

// --- CLASS ---
class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // --- PREFERENCES AND HEADERS ---
    getPreference(key) {
        return new SharedPreferences().get(key);
    }

    getBaseUrl() {
        return this.getPreference("override_base_url") || this.source.baseUrl;
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
            const link = item.getHref;
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
            const link = item.getHref;
            const imageUrl = item.selectFirst("img")?.getSrc;
            list.push({ name, imageUrl, link });
        }
        const hasNextPage = doc.selectFirst("ul.pagination li.page-item a[rel=next]") != null;
        return { list, hasNextPage };
    }

    async search(query, page, filters) {
        let sort = "rel-d";
        let httpQueryParts = [];
        if (query) {
            httpQueryParts.push(query.trim());
        }

        for (const filter of filters) {
            if (filter.type_name === "SelectFilter") {
                const selectedValue = filter.values[filter.state].value;
                if (filter.name === "Sort By") {
                    sort = selectedValue;
                } else if (selectedValue) {
                    const filterKey = filter.name.toLowerCase().replace(/\s+/g, "-");
                    httpQueryParts.push(`${filterKey}:${selectedValue}`);
                }
            } else if (filter.type_name === "GroupFilter") {
                const filterName = filter.name.startsWith("Excluded") ? "-genre" : "genre";
                for (const item of filter.state) {
                    if (item.state) {
                        httpQueryParts.push(`${filterName}:${item.value}`);
                    }
                }
            }
        }

        const httpQuery = httpQueryParts.join(' ');
        const encodedQuery = encodeURIComponent(httpQuery);
        const url = `${this.getBaseUrl()}/anime?page=${page}&s=${sort}&q=${encodedQuery}`;

        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        const list = [];
        const items = doc.select("ul.anime-loop.loop > li > a");
        for (const item of items) {
            const name = item.selectFirst("div.label > span, span.thumb-title").text;
            const link = item.getHref;
            const imageUrl = item.selectFirst("img")?.getSrc;
            list.push({ name, imageUrl, link });
        }
        const hasNextPage = doc.selectFirst("ul.pagination li.page-item a[rel=next]") != null;
        return { list, hasNextPage };
    }

    async getDetail(url) {
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        const entry = doc.selectFirst("article.anime-entry");
        if (!entry) throw new Error("Main content <article> not found.");
        const name = entry.selectFirst("header h1")?.text ?? "Unknown Title";
        const imageUrl = entry.selectFirst("img.cover-image.img-thumbnail")?.getSrc;
        const details = [];
        const mainInfo = entry.selectFirst("section.main-info");
        const addDetail = (label, value) => {
            if (value && value.trim()) details.push(`${label.padEnd(15, ' ')}\t${value.trim()}`);
        };
        const officialTitle = mainInfo?.select("li.official-title .value").map(el => el.text.replace(/\s+/g, ' ').trim()).join(' / ');
        addDetail("Japanese Title", officialTitle);
        addDetail("Type", mainInfo?.selectFirst("li.type .value a")?.text);
        const statusText = mainInfo?.selectFirst("li.status .value a")?.text;
        addDetail("Status", statusText);
        addDetail("Content Rating", mainInfo?.selectFirst("li.content-rating .value a")?.text);
        addDetail("Censorship", mainInfo?.selectFirst("li.censorship .value a")?.text);
        addDetail("Source", mainInfo?.selectFirst("li.source .value a")?.text);
        addDetail("Resolution", mainInfo?.select("li.resolution .value a").map(e => e.text.trim()).join(' • '));
        addDetail("Production", mainInfo?.select("li.production .value a").map(e => e.text.trim()).join(' & '));
        const synopsis = entry.selectFirst("section.entry-description div.card-body")?.text.trim() ?? "No description available.";
        const description = details.join('\n') + "\n\n" + synopsis;
        const status = statusText?.toLowerCase().includes("ongoing") ? 0 : statusText?.toLowerCase().includes("completed") ? 1 : 5;
        const genre = mainInfo?.select("li.genre .value a").map(e => e.text.trim()) ?? [];
        const author = mainInfo?.select("li.production .value a").map(e => e.text.trim()).join(', ');
        const artist = mainInfo?.select("li.group .value a").map(e => e.text.trim()).join(', ');
        const chapters = [];
        for (const element of entry.select("ul.episode-loop > li > a")) {
            const epNumStr = element.selectFirst("div.episode-number, div.episode-slug")?.text ?? "Ep";
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
        const sortValues = [ { name: "Latest Released", value: "rel-d" }, { name: "Last Added", value: "add-d" }, { name: "Highest Rated", value: "rtg-d" }, { name: "Most Popular", value: "vtt-d" }, { name: "Popular Today", value: "vdy-d" }, { name: "Popular This Week", value: "vwk-d" }, { name: "Popular This Month", value: "vmt-d" }, { name: "Popular This Year", value: "vyr-d" }, { name: "Title A-Z", value: "az-a" }, { name: "Title Z-A", value: "az-d" }, { name: "Earliest Released", value: "rel-a" }, { name: "First Added", value: "add-a" } ];
        const typeValues = [ { name: "Any", value: "" }, { name: "OVA", value: "ova" }, { name: "Web", value: "web" }, { name: "Movie", value: "movie" }, { name: "TV Series", value: "tv-series" }, { name: "TV Special", value: "tv-special" }, { name: "Other", value: "other" } ];
        const statusValues = [ { name: "Any", value: "" }, { name: "Ongoing", value: "ongoing" }, { name: "Completed", value: "completed" }, { name: "Stalled", value: "stalled" } ];
        const censorshipValues = [ { name: "Any", value: "" }, { name: "Censored", value: "censored" }, { name: "Uncensored", value: "uncensored" } ];
        const sourceValues = [ { name: "Any", value: "" }, { name: "Blu-ray", value: "bd" }, { name: "DVD", value: "dvd" }, { name: "Web", value: "web" }, { name: "TV", value: "tv" }, { name: "VHS", value: "vhs" }, { name: "VCD", value: "vcd" }, { name: "LD", value: "ld" } ];
        const resolutionValues = [ { name: "Any", value: "" }, { name: "1080p", value: "1080p" }, { name: "720p", value: "720p" }, { name: "540p", value: "540p" }, { name: "480p", value: "480p" }, { name: "360p", value: "360p" } ];
        const genres = [ "3D CG animation", "absurdist humour", "action", "action game", "adapted into Japanese movie", "adapted into JDrama", "adults are useless", "adventure", "age difference romance", "ahegao", "air force", "alcohol", "alien", "all-boys school", "all-girls school", "alternative past", "alternative present", "amnesia", "anal", "android", "angel", "BDSM", "bestiality", "bishoujo", "bishounen", "black humour", "blackmail", "bondage", "borderline porn", "cheating", "chikan", "comedy", "coming of age", "competition", "contemporary fantasy", "cosplaying", "countryside", "creampie", "crime", "cross-dressing", "cunnilingus", "cyberpunk", "cyborg", "daily life", "dark fantasy", "dark-skinned girl", "dementia", "demon", "detective", "drugs", "dungeon", "dystopia", "ecchi", "elf", "enema", "enjo-kousai", "episodic", "erotic game", "exhibitionism", "facesitting", "fantasy", "fellatio", "female protagonist", "femdom", "fetishes", "FFM threesome", "fingering", "fisting", "foot fetish", "footjob", "forbidden love", "foursome", "futanari", "game", "gang bang", "gang rape", "gender bender", "ghost", "giant insects", "gigantic breasts", "glasses", "glory hole", "gokkun", "golden shower", "gore", "groping", "group love", "gunfights", "guro", "gyaru", "harem", "high school", "historical", "horror", "housewives", "humiliation", "idol", "immortality", "impregnation", "incest", "infidelity", "isekai", "island", "jealousy", "kemonomimi", "kidnapping", "lactation", "loli", "love polygon", "magic", "magical girl", "maid", "male protagonist", "martial arts", "master-servant relationship", "masturbation", "mecha", "military", "MILF", "mind break", "mind control", "misunderstanding", "MMF threesome", "molestation", "monster", "monster girl", "mother-son incest", "murder", "music", "mystery", "netorare", "netori", "ninja", "nudity", "nun", "nurse", "office lady", "older female younger male", "onahole", "oral", "orgy", "original work", "otaku culture", "oyakodon", "panty theft", "parody", "pirate", "plot with porn", "police", "post-apocalyptic", "pregnant", "prison", "prostitution", "psychological", "public sex", "rape", "revenge", "reverse harem", "rimming", "romance", "samurai", "school", "school life", "science fiction", "sex toys", "shibari", "shota", "shoujo ai", "shounen ai", "sister-sister incest", "sixty-nine", "slavery", "sleeping sex", "slime", "small breasts", "soapland", "space", "spanking", "sports", "squirting", "stomach bulge", "succubus", "super power", "superhero", "supernatural", "survival", "suspense", "swimsuit", "swordplay", "teacher", "tentacles", "themes", "threesome", "thriller", "tomboy", "torture", "toys", "tragedy", "trap", "tsundere", "ugly bastard", "vampire", "vanilla", "video game", "violence", "virtual world", "visual novel", "voyeurism", "waitress", "watersports", "work", "wrestling", "yaoi", "yuri", "zombie" ];
        
        return [
            { type_name: "SelectFilter", name: "Sort By", state: 0, values: sortValues.map(v => ({ type_name: "SelectOption", name: v.name, value: v.value })) },
            { type_name: "HeaderFilter", name: "Content Filters" },
            { type_name: "SelectFilter", name: "Type", state: 0, values: typeValues.map(v => ({ type_name: "SelectOption", name: v.name, value: v.value })) },
            { type_name: "SelectFilter", name: "Status", state: 0, values: statusValues.map(v => ({ type_name: "SelectOption", name: v.name, value: v.value })) },
            { type_name: "SelectFilter", name: "Censorship", state: 0, values: censorshipValues.map(v => ({ type_name: "SelectOption", name: v.name, value: v.value })) },
            { type_name: "SelectFilter", name: "Source", state: 0, values: sourceValues.map(v => ({ type_name: "SelectOption", name: v.name, value: v.value })) },
            { type_name: "SelectFilter", name: "Resolution", state: 0, values: resolutionValues.map(v => ({ type_name: "SelectOption", name: v.name, value: v.value })) },
            { type_name: "SeparatorFilter" },
            { type_name: "HeaderFilter", name: "Genre Filters" },
            { type_name: "GroupFilter", name: "Included Genres", state: genres.map(g => ({ type_name: "CheckBox", name: g, value: g.toLowerCase().replace(/\s+/g, "-"), state: false })) },
            { type_name: "SeparatorFilter" },
            { type_name: "GroupFilter", name: "Excluded Genres", state: genres.map(g => ({ type_name: "CheckBox", name: g, value: g.toLowerCase().replace(/\s+/g, "-"), state: false })) }
        ];
    }

    getSourcePreferences() {
        return [
            {
                key: "override_base_url",
                editTextPreference: {
                    title: "Override Base URL",
                    summary: "Use a different mirror/domain for the source",
                    value: this.source.baseUrl,
                    dialogTitle: "Enter new Base URL",
                    dialogMessage: "",
                }
            },
            {
                key: "preferred_quality",
                listPreference: {
                    title: "Preferred Video Quality",
                    summary: "Select the quality to be prioritized. Requires app restart.",
                    valueIndex: 0, // Default to 1080p
                    entries: ["1080p", "720p", "480p", "360p", "Auto"],
                    entryValues: ["1080", "720", "480", "360", "auto"],
                }
            }
        ];
    }
}
