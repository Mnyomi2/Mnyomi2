const mangayomiSources = [{
    "name": "Hanime",
    "id": 694201337,
    "lang": "en",
    "baseUrl": "https://hanime.tv",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=hanime.tv",
    "typeSource": "single",
    "itemType": 1,
    "version": "2.0.0",
    "pkgPath": "anime/src/en/hanime.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    getPreference(key) {
        return new SharedPreferences().get(key);
    }

    getBaseUrl() {
        return this.getPreference("override_base_url") || this.source.baseUrl;
    }

    getHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        };
    }

    // --- Helper Methods ---

    isNumber(num) {
        return !isNaN(parseInt(num));
    }

    getTitle(title) {
        if (title.includes(" Ep ")) {
            return title.split(" Ep ")[0].trim();
        } else {
            const parts = title.trim().split(" ");
            if (this.isNumber(parts[parts.length - 1])) {
                return parts.slice(0, -1).join(" ").trim();
            } else {
                return title.trim();
            }
        }
    }

    parseSearchJson(jsonString) {
        if (!jsonString) {
            return { list: [], hasNextPage: false };
        }
        const jResponse = JSON.parse(jsonString);
        const hasNextPage = jResponse.page < jResponse.nbPages - 1;
        const array = JSON.parse(jResponse.hits);

        const animeList = [];
        const titles = new Set();

        for (const item of array) {
            const title = this.getTitle(item.name);
            if (!titles.has(title)) {
                titles.add(title);
                animeList.push({
                    name: title,
                    link: "/videos/hentai/" + item.slug,
                    imageUrl: item.cover_url
                });
            }
        }

        return { list: animeList, hasNextPage };
    }

    // --- Core Methods ---

    async getPopular(page) {
        const payload = {
            "search_text": "",
            "tags": [],
            "tags_mode": "AND",
            "brands": [],
            "blacklist": [],
            "order_by": "likes",
            "ordering": "desc",
            "page": page - 1
        };
        const res = await this.client.post("https://search.htv-services.com/", JSON.stringify(payload), this.getHeaders());
        return this.parseSearchJson(res.body);
    }

    async getLatestUpdates(page) {
        const payload = {
            "search_text": "",
            "tags": [],
            "tags_mode": "AND",
            "brands": [],
            "blacklist": [],
            "order_by": "published_at_unix",
            "ordering": "desc",
            "page": page - 1
        };
        const res = await this.client.post("https://search.htv-services.com/", JSON.stringify(payload), this.getHeaders());
        return this.parseSearchJson(res.body);
    }

    async search(query, page, filters) {
        const includedTags = [];
        const blackListedTags = [];
        const brands = [];
        let tagsMode = "AND";
        let orderBy = "likes";
        let ordering = "desc";

        if (filters) {
            const tagFilter = filters.find(f => f.name === "Tags");
            if (tagFilter) {
                tagFilter.state.forEach(tag => {
                    if (tag.state === 1) includedTags.push(tag.value);
                    else if (tag.state === 2) blackListedTags.push(tag.value);
                });
            }

            const brandFilter = filters.find(f => f.name === "Brands");
            if (brandFilter) {
                brandFilter.state.forEach(brand => {
                    if (brand.state) brands.push(brand.value);
                });
            }

            const modeFilter = filters.find(f => f.name === "Included tags mode");
            if (modeFilter) {
                tagsMode = modeFilter.values[modeFilter.state].value;
            }

            const sortFilter = filters.find(f => f.name === "Sort");
            if (sortFilter && sortFilter.state) {
                const sortableList = this.getSortableList();
                orderBy = sortableList[sortFilter.state.index].value;
                ordering = sortFilter.state.ascending ? "asc" : "desc";
            }
        }

        const payload = {
            "search_text": query,
            "tags": includedTags,
            "tags_mode": tagsMode,
            "brands": brands,
            "blacklist": blackListedTags,
            "order_by": orderBy,
            "ordering": ordering,
            "page": page - 1
        };

        const res = await this.client.post("https://search.htv-services.com/", JSON.stringify(payload), this.getHeaders());
        return this.parseSearchJson(res.body);
    }

    async getDetail(url) {
        const res = await this.client.get(this.getBaseUrl() + url, this.getHeaders());
        const doc = new Document(res.body);

        const slug = url.substring(url.lastIndexOf('/') + 1);
        const apiRes = await this.client.get(`${this.getBaseUrl()}/api/v8/video?id=${slug}`, this.getHeaders());
        const apiData = JSON.parse(apiRes.body);

        const chapters = (apiData.hentai_franchise_hentai_videos || []).map((it, idx) => ({
            name: `Episode ${idx + 1}`,
            url: `${this.getBaseUrl()}/api/v8/video?id=${it.id}`
        })).reverse();

        return {
            name: this.getTitle(doc.selectFirst("h1.tv-title").text),
            imageUrl: doc.selectFirst("img.hvpi-cover").attr("src"),
            description: doc.select("div.hvpist-description p").map(e => e.text).join("\n\n"),
            genre: doc.select("div.hvpis-text div.btn__content").map(e => e.text),
            chapters: chapters
        };
    }

    async getVideoList(url) {
        const res = await this.client.get(url, this.getHeaders());
        const data = JSON.parse(res.body);

        const videos = [];
        if (data.videos_manifest && data.videos_manifest.servers) {
            for (const server of data.videos_manifest.servers) {
                for (const stream of server.streams) {
                    if (stream.url) {
                        videos.push({
                            url: stream.url,
                            quality: `${stream.height}p`,
                            headers: { "Referer": this.getBaseUrl() }
                        });
                    }
                }
            }
        }
        
        const preferredQuality = this.getPreference("preferred_quality") || "1080p";
        videos.sort((a, b) => {
            const qualityA = parseInt(a.quality.replace('p', ''));
            const qualityB = parseInt(b.quality.replace('p', ''));
            if (a.quality.includes(preferredQuality)) return -1;
            if (b.quality.includes(preferredQuality)) return 1;
            return qualityB - qualityA;
        });

        return videos;
    }

    // --- Filters ---

    getSortableList() {
        return [
            { name: "Uploads", value: "created_at_unix" },
            { name: "Views", value: "views" },
            { name: "Likes", value: "likes" },
            { name: "Release", value: "released_at_unix" },
            { name: "Alphabetical", value: "title_sortable" },
        ];
    }

    getFilterList() {
        const tags = this.getTags().map(tag => ({ type_name: "TriState", name: tag.name, value: tag.id }));
        const brands = this.getBrands().map(brand => ({ type_name: "CheckBox", name: brand.name, value: brand.id }));
        const sortables = this.getSortableList().map(s => s.name);

        return [
            { type_name: "GroupFilter", name: "Tags", state: tags },
            { type_name: "GroupFilter", name: "Brands", state: brands },
            { type_name: "SelectFilter", name: "Included tags mode", state: 0, values: [{name: "And", value: "AND"}, {name: "Or", value: "OR"}] },
            { type_name: "SortFilter", name: "Sort", state: { index: 2, ascending: false }, values: sortables }
        ];
    }

    getBrands() {
        return [
            { id: "37c-binetsu", name: "37c-binetsu" }, { id: "adult-source-media", name: "Adult Source Media" },
            { id: "ajia-do", name: "Ajia-Do" }, { id: "almond-collective", name: "Almond Collective" },
            { id: "alpha-polis", name: "Alpha Polis" }, { id: "ameliatie", name: "Ameliatie" },
            { id: "amour", name: "Amour" }, { id: "animac", name: "Animac" },
            { id: "antechinus", name: "Antechinus" }, { id: "appp", name: "APPP" },
            { id: "arms", name: "Arms" }, { id: "bishop", name: "Bishop" },
            { id: "blue-eyes", name: "Blue Eyes" }, { id: "bomb-cute-bomb", name: "BOMB! CUTE! BOMB!" },
            { id: "bootleg", name: "Bootleg" }, { id: "breakbottle", name: "BreakBottle" },
            { id: "bugbug", name: "BugBug" }, { id: "bunnywalker", name: "Bunnywalker" },
            { id: "celeb", name: "Celeb" }, { id: "central-park-media", name: "Central Park Media" },
            { id: "chichinoya", name: "ChiChinoya" }, { id: "chocolat", name: "Chocolat" },
            { id: "chuchu", name: "ChuChu" }, { id: "circle-tribute", name: "Circle Tribute" },
            { id: "cocoans", name: "CoCoans" }, { id: "collaboration-works", name: "Collaboration Works" },
            { id: "comet", name: "Comet" }, { id: "comic-media", name: "Comic Media" },
            { id: "cosmos", name: "Cosmos" }, { id: "cranberry", name: "Cranberry" },
            { id: "crimson", name: "Crimson" }, { id: "d3", name: "D3" },
            { id: "daiei", name: "Daiei" }, { id: "demodemon", name: "demodemon" },
            { id: "digital-works", name: "Digital Works" }, { id: "discovery", name: "Discovery" },
            { id: "dollhouse", name: "Dollhouse" }, { id: "ebimaru-do", name: "EBIMARU-DO" },
            { id: "echo", name: "Echo" }, { id: "ecolonun", name: "ECOLONUN" },
            { id: "edge", name: "Edge" }, { id: "erozuki", name: "Erozuki" },
            { id: "evee", name: "evee" }, { id: "final-fuck-7", name: "FINAL FUCK 7" },
            { id: "five-ways", name: "Five Ways" }, { id: "friends-media-station", name: "Friends Media Station" },
            { id: "front-line", name: "Front Line" }, { id: "fruit", name: "fruit" },
            { id: "godoy", name: "Godoy" }, { id: "gold-bear", name: "GOLD BEAR" },
            { id: "gomasioken", name: "gomasioken" }, { id: "green-bunny", name: "Green Bunny" },
            { id: "groover", name: "Groover" }, { id: "hoods-entertainment", name: "Hoods Entertainment" },
            { id: "hot-bear", name: "Hot Bear" }, { id: "hykobo", name: "Hykobo" },
            { id: "ironbell", name: "IRONBELL" }, { id: "ivory-tower", name: "Ivory Tower" },
            { id: "j-c", name: "J.C." }, { id: "jellyfish", name: "Jellyfish" },
            { id: "jewel", name: "Jewel" }, { id: "jumondo", name: "Jumondo" },
            { id: "kate_sai", name: "kate_sai" }, { id: "kenzsoft", name: "KENZsoft" },
            { id: "king-bee", name: "King Bee" }, { id: "kitty-media", name: "Kitty Media" },
            { id: "knack", name: "Knack" }, { id: "kuril", name: "Kuril" },
            { id: "l", name: "L." }, { id: "lemon-heart", name: "Lemon Heart" },
            { id: "lilix", name: "Lilix" }, { id: "lune-pictures", name: "Lune Pictures" },
            { id: "magic-bus", name: "Magic Bus" }, { id: "magin-label", name: "Magin Label" },
            { id: "majin-petit", name: "Majin Petit" }, { id: "marigold", name: "Marigold" },
            { id: "mary-jane", name: "Mary Jane" }, { id: "mediabank", name: "MediaBank" },
            { id: "media-blasters", name: "Media Blasters" }, { id: "metro-notes", name: "Metro Notes" },
            { id: "milky", name: "Milky" }, { id: "mimia-cute", name: "MiMiA Cute" },
            { id: "moon-rock", name: "Moon Rock" }, { id: "moonstone-cherry", name: "Moonstone Cherry" },
            { id: "mousou-senka", name: "Mousou Senka" }, { id: "ms-pictures", name: "MS Pictures" },
            { id: "muse", name: "Muse" }, { id: "n43", name: "N43" },
            { id: "nihikime-no-dozeu", name: "Nihikime no Dozeu" }, { id: "nikkatsu-video", name: "Nikkatsu Video" },
            { id: "nur", name: "nur" }, { id: "nutech-digital", name: "NuTech Digital" },
            { id: "obtain-future", name: "Obtain Future" }, { id: "otodeli", name: "Otodeli" },
            { id: "oz", name: "@ OZ" }, { id: "pashmina", name: "Pashmina" },
            { id: "passione", name: "Passione" }, { id: "peach-pie", name: "Peach Pie" },
            { id: "pinkbell", name: "Pinkbell" }, { id: "pink-pineapple", name: "Pink Pineapple" },
            { id: "pix", name: "Pix" }, { id: "pixy-soft", name: "Pixy Soft" },
            { id: "pocomo-premium", name: "Pocomo Premium" }, { id: "poro", name: "PoRO" },
            { id: "project-no-9", name: "Project No.9" }, { id: "pumpkin-pie", name: "Pumpkin Pie" },
            { id: "queen-bee", name: "Queen Bee" }, { id: "rabbit-gate", name: "Rabbit Gate" },
            { id: "sakamotoj", name: "sakamotoJ" }, { id: "sakura-purin", name: "Sakura Purin" },
            { id: "sandwichworks", name: "SANDWICHWORKS" }, { id: "schoolzone", name: "Schoolzone" },
            { id: "seismic", name: "seismic" }, { id: "selfish", name: "SELFISH" },
            { id: "seven", name: "Seven" }, { id: "shadow-prod-co", name: "Shadow Prod. Co." },
            { id: "shelf", name: "Shelf" }, { id: "shinyusha", name: "Shinyusha" },
            { id: "shosai", name: "ShoSai" }, { id: "showten", name: "Showten" },
            { id: "softcell", name: "SoftCell" }, { id: "soft-on-demand", name: "Soft on Demand" },
            { id: "speed", name: "SPEED" }, { id: "stargate3d", name: "STARGATE3D" },
            { id: "studio-9-maiami", name: "Studio 9 Maiami" }, { id: "studio-akai-shohosen", name: "Studio Akai Shohosen" },
            { id: "studio-deen", name: "Studio Deen" }, { id: "studio-fantasia", name: "Studio Fantasia" },
            { id: "studio-fow", name: "Studio FOW" }, { id: "studio-ggb", name: "studio GGB" },
            { id: "studio-houkiboshi", name: "Studio Houkiboshi" }, { id: "studio-zealot", name: "Studio Zealot" },
            { id: "suiseisha", name: "Suiseisha" }, { id: "suzuki-mirano", name: "Suzuki Mirano" },
            { id: "syld", name: "SYLD" }, { id: "tdk-core", name: "TDK Core" },
            { id: "t-japan", name: "t japan" }, { id: "tnk", name: "TNK" },
            { id: "toho", name: "TOHO" }, { id: "toranoana", name: "Toranoana" },
            { id: "t-rex", name: "T-Rex" }, { id: "triangle", name: "Triangle" },
            { id: "trimax", name: "Trimax" }, { id: "tys-work", name: "TYS Work" },
            { id: "u-jin", name: "U-Jin" }, { id: "umemaro-3d", name: "Umemaro-3D" },
            { id: "union-cho", name: "Union Cho" }, { id: "valkyria", name: "Valkyria" },
            { id: "vanilla", name: "Vanilla" }, { id: "white-bear", name: "White Bear" },
            { id: "x-city", name: "X City" }, { id: "yosino", name: "yosino" },
            { id: "y-o-u-c", name: "Y.O.U.C." }, { id: "ziz", name: "ZIZ" },
        ];
    }

    getTags() {
        return [
            { id: "3D", name: "3D" }, { id: "AHEGAO", name: "AHEGAO" }, { id: "ANAL", name: "ANAL" },
            { id: "BDSM", name: "BDSM" }, { id: "BIG BOOBS", name: "BIG BOOBS" },
            { id: "BLOW JOB", name: "BLOW JOB" }, { id: "BONDAGE", name: "BONDAGE" },
            { id: "BOOB JOB", name: "BOOB JOB" }, { id: "CENSORED", name: "CENSORED" },
            { id: "COMEDY", name: "COMEDY" }, { id: "COSPLAY", name: "COSPLAY" },
            { id: "CREAMPIE", name: "CREAMPIE" }, { id: "DARK SKIN", name: "DARK SKIN" },
            { id: "FACIAL", name: "FACIAL" }, { id: "FANTASY", name: "FANTASY" },
            { id: "FILMED", name: "FILMED" }, { id: "FOOT JOB", name: "FOOT JOB" },
            { id: "FUTANARI", name: "FUTANARI" }, { id: "GANGBANG", name: "GANGBANG" },
            { id: "GLASSES", name: "GLASSES" }, { id: "HAND JOB", name: "HAND JOB" },
            { id: "HAREM", name: "HAREM" }, { id: "HD", name: "HD" },
            { id: "HORROR", name: "HORROR" }, { id: "INCEST", name: "INCEST" },
            { id: "INFLATION", name: "INFLATION" }, { id: "LACTATION", name: "LACTATION" },
            { id: "LOLI", name: "LOLI" }, { id: "MAID", name: "MAID" },
            { id: "MASTURBATION", name: "MASTURBATION" }, { id: "MILF", name: "MILF" },
            { id: "MIND BREAK", name: "MIND BREAK" }, { id: "MIND CONTROL", name: "MIND CONTROL" },
            { id: "MONSTER", name: "MONSTER" }, { id: "NEKOMIMI", name: "NEKOMIMI" },
            { id: "NTR", name: "NTR" }, { id: "NURSE", name: "NURSE" },
            { id: "ORGY", name: "ORGY" }, { id: "PLOT", name: "PLOT" },
            { id: "POV", name: "POV" }, { id: "PREGNANT", name: "PREGNANT" },
            { id: "PUBLIC SEX", name: "PUBLIC SEX" }, { id: "RAPE", name: "RAPE" },
            { id: "REVERSE RAPE", name: "REVERSE RAPE" }, { id: "RIMJOB", name: "RIMJOB" },
            { id: "SCAT", name: "SCAT" }, { id: "SCHOOL GIRL", name: "SCHOOL GIRL" },
            { id: "SHOTA", name: "SHOTA" }, { id: "SOFTCORE", name: "SOFTCORE" },
            { id: "SWIMSUIT", name: "SWIMSUIT" }, { id: "TEACHER", name: "TEACHER" },
            { id: "TENTACLE", name: "TENTACLE" }, { id: "THREESOME", name: "THREESOME" },
            { id: "TOYS", name: "TOYS" }, { id: "TRAP", name: "TRAP" },
            { id: "TSUNDERE", name: "TSUNDERE" }, { id: "UGLY BASTARD", name: "UGLY BASTARD" },
            { id: "UNCENSORED", name: "UNCENSORED" }, { id: "VANILLA", name: "VANILLA" },
            { id: "VIRGIN", name: "VIRGIN" }, { id: "WATERSPORTS", name: "WATERSPORTS" },
            { id: "X-RAY", name: "X-RAY" }, { id: "YAOI", name: "YAOI" },
            { id: "YURI", name: "YURI" }
        ];
    }

    // --- Preferences ---

    getSourcePreferences() {
        const qualityList = ["1080p", "720p", "480p", "360p"];
        return [
            {
                key: "override_base_url",
                editTextPreference: {
                    title: "Override Base URL",
                    summary: "For temporary changes.",
                    value: this.source.baseUrl,
                    dialogTitle: "Override Base URL",
                    dialogMessage: "Default: " + this.source.baseUrl,
                }
            },
            {
                key: "preferred_quality",
                listPreference: {
                    title: "Preferred quality",
                    summary: "%s",
                    valueIndex: 0,
                    entries: qualityList,
                    entryValues: qualityList,
                }
            }
        ];
    }
}
