// --- METADATA ---
const mangayomiSources = [{
    "name": "Animerco",
    "id": 645698215,
    "lang": "ar",
    "baseUrl": "https://vip.animerco.org",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=animerco.org",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.0",
    "pkgPath": "anime/src/ar/animerco.js"
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
            "Referer": this.getBaseUrl() + "/",
            "Origin": this.getBaseUrl(),
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        };
    }

    // --- CORE METHODS ---

    async getPopular(page) {
        const url = `${this.getBaseUrl()}/animes/page/${page}/`;
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);

        const list = [];
        const items = doc.select("div.box-5x1.media-block");

        for (const item of items) {
            const linkElement = item.selectFirst("a.image");
            const name = linkElement.attr("title");
            const link = linkElement.attr("href").replace(this.getBaseUrl(), "");
            const imageUrl = linkElement.attr("data-src");
            list.push({ name, imageUrl, link });
        }

        const hasNextPage = doc.selectFirst("a.next.page-numbers") != null;
        return { list, hasNextPage };
    }

    async getLatestUpdates(page) {
        const url = `${this.getBaseUrl()}/episodes/page/${page}/`;
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);

        const list = [];
        const items = doc.select("div.media-block");

        for (const item of items) {
            const linkElement = item.selectFirst("a.image");
            const name = linkElement.attr("title").replace(/ الحلقة \d+$/, "");
            const link = linkElement.attr("href").replace(/\/episodes\/.*/, `/animes/${name.replace(/ /g, "-")}/`);
            const imageUrl = linkElement.attr("data-src");
            list.push({ name, imageUrl, link });
        }

        const hasNextPage = doc.selectFirst("a.next.page-numbers") != null;
        return { list, hasNextPage };
    }

    async search(query, page, filters) {
        const url = `${this.getBaseUrl()}/page/${page}/?s=${encodeURIComponent(query)}`;
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);

        const list = [];
        const items = doc.select("div.box-5x1.media-block");

        for (const item of items) {
            const linkElement = item.selectFirst("a.image");
            const name = linkElement.attr("title");
            const link = linkElement.attr("href").replace(this.getBaseUrl(), "");
            const imageUrl = linkElement.attr("data-src");
            list.push({ name, imageUrl, link });
        }

        const hasNextPage = doc.selectFirst("a.next.page-numbers") != null;
        return { list, hasNextPage };
    }

    async getDetail(url) {
        const res = await this.client.get(this.getBaseUrl() + url, this.getHeaders(this.getBaseUrl() + url));
        const doc = new Document(res.body);

        const name = doc.selectFirst("div.media-title h1")?.text ?? doc.selectFirst("a.poster").attr("title");
        const imageUrl = doc.selectFirst("a.poster").attr("data-src");
        
        let description = doc.selectFirst("div.media-story div.content p")?.text ?? "";
        const altTitle = doc.selectFirst("div.media-title > h3.alt-title")?.text;
        if (altTitle) {
            description += `\n\nAlternative title: ${altTitle}`;
        }

        const statusText = doc.select("ul.chapters-list a.se-title > span.badge").map(e => e.text);
        let status;
        if (statusText.every(s => s.includes("مكتمل"))) {
            status = 1; // COMPLETED
        } else if (statusText.some(s => s.includes("يعرض الأن"))) {
            status = 0; // ONGOING
        } else {
            status = 5; // UNKNOWN
        }

        const genre = doc.select("div.genres a").map(e => e.text);

        const chapters = [];
        const episodeElements = doc.select("ul.chapters-list li a:has(h3)");

        if (doc.location.includes("/movies/")) {
            chapters.push({
                name: "Movie",
                url: doc.location.replace(this.getBaseUrl(), ""),
                scanlator: 1
            });
        } else {
            for (const el of episodeElements) {
                const seasonDocRes = await this.client.get(el.attr("abs:href"), this.getHeaders(el.attr("abs:href")));
                const seasonDoc = new Document(seasonDocRes.body);
                const seasonName = seasonDoc.selectFirst("div.media-title h1").text;
                const seasonNum = parseInt(seasonName.split(" ").pop()) || 1;

                const seasonEpisodes = seasonDoc.select("ul.chapters-list li a:has(h3)");
                for (const ep of seasonEpisodes) {
                    const epText = ep.selectFirst("h3").ownText;
                    const epNum = parseFloat(`${seasonNum}.${epText.replace(/[^0-9]/g, '').padStart(3, '0')}`);
                    chapters.push({
                        name: `${seasonName}: ${epText}`,
                        url: ep.attr("href").replace(this.getBaseUrl(), ""),
                        scanlator: epNum
                    });
                }
            }
        }
        chapters.sort((a, b) => b.scanlator - a.scanlator);

        return { name, imageUrl, description, link: url, status, genre, chapters };
    }

    async getVideoList(url) {
        const res = await this.client.get(this.getBaseUrl() + url, this.getHeaders(this.getBaseUrl() + url));
        const doc = new Document(res.body);
        const players = doc.select("li.dooplay_player_option");
        const videos = [];

        for (const player of players) {
            const postData = {
                "action": "doo_player_ajax",
                "post": player.attr("data-post"),
                "nume": player.attr("data-nume"),
                "type": player.attr("data-type")
            };
            const playerRes = await this.client.post(`${this.getBaseUrl()}/wp-admin/admin-ajax.php`, postData, this.getHeaders(this.getBaseUrl() + url));
            const embedUrl = JSON.parse(playerRes.body).embed_url.replace(/\\/g, "");

            if (embedUrl) {
                const name = player.selectFirst("span.title").text.toLowerCase();
                // Simplified extractor logic for demonstration
                if (name.includes("dood")) {
                    videos.push({ url: embedUrl, quality: "Doodstream", headers: this.getHeaders(embedUrl) });
                } else if (name.includes("streamtape")) {
                    videos.push({ url: embedUrl, quality: "StreamTape", headers: this.getHeaders(embedUrl) });
                } else if (name.includes("mp4upload")) {
                    videos.push({ url: embedUrl, quality: "Mp4upload", headers: this.getHeaders(embedUrl) });
                } else if (name.includes("ok.ru")) {
                    videos.push({ url: embedUrl, quality: "Okru", headers: this.getHeaders(embedUrl) });
                }
            }
        }
        
        const quality = this.getPreference("preferred_quality") || "1080";
        videos.sort((a, b) => {
            const aQuality = a.quality.toLowerCase();
            const bQuality = b.quality.toLowerCase();
            if (aQuality.includes(quality)) return -1;
            if (bQuality.includes(quality)) return 1;
            return 0;
        });

        return videos;
    }

    getFilterList() {
        return [];
    }

    getSourcePreferences() {
        return [{
            key: "override_base_url",
            editTextPreference: {
                title: "Override Base URL",
                summary: "For temporary uses. Update the extension for permanent changes.",
                value: "https://vip.animerco.org",
                dialogTitle: "Override Base URL",
                dialogMessage: "Default: " + "https://vip.animerco.org",
            }
        }, {
            key: "preferred_quality",
            listPreference: {
                title: "Preferred quality",
                summary: "Preferred quality for video streaming",
                valueIndex: 0,
                entries: ["1080p", "720p", "480p", "360p", "Doodstream", "StreamTape"],
                entryValues: ["1080", "720", "480", "360", "Doodstream", "StreamTape"],
            }
        }];
    }
}
