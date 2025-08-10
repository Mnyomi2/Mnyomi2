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

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    getHeaders(url) {
        return {
            "Referer": this.source.baseUrl
        };
    }

    async _parseAnimeListPage(slug) {
        const url = `${this.source.baseUrl}${slug}`;
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);

        const list = [];
        const items = doc.select("ul.thumb > li > a");

        for (const item of items) {
            const name = item.attr("title");
            const link = item.getHref;
            const imageUrl = item.selectFirst("img")?.getSrc;
            if (link) {
                list.push({ name, imageUrl, link });
            }
        }

        const hasNextPage = doc.selectFirst("a.page-link[rel=next]") !== null;
        return { list, hasNextPage };
    }

    async getPopular(page) {
        return this._parseAnimeListPage(`/popular-anime?page=${page}`);
    }

    async getLatestUpdates(page) {
        return this._parseAnimeListPage(`/latest-updates?page=${page}`);
    }

    async search(query, page, filters) {
        const url = `${this.source.baseUrl}/anime?q=${encodeURIComponent(query)}&page=${page}`;
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);

        const list = [];
        const items = doc.select("ul.thumb > li > a");

        for (const item of items) {
            const name = item.attr("title");
            const link = item.getHref;
            const imageUrl = item.selectFirst("img")?.getSrc;
            if (link) {
                list.push({ name, imageUrl, link });
            }
        }

        const hasNextPage = doc.selectFirst("a.page-link[rel=next]") !== null;
        return { list, hasNextPage };
    }

    _parseStatus(statusString) {
        statusString = statusString.toLowerCase();
        if (statusString.includes("ongoing")) return 0;
        if (statusString.includes("completed")) return 1;
        return 5; // Unknown
    }

    async getDetail(url) {
        const res = await this.client.get(this.source.baseUrl + url, this.getHeaders(this.source.baseUrl + url));
        const doc = new Document(res.body);

        const name = doc.selectFirst("header.entry-header > h1.mb-3").text;
        const imageUrl = doc.selectFirst("img.cover-image")?.getSrc;
        const description = doc.selectFirst(".entry-description > .card-body").text.trim();
        const link = url;

        const genre = doc.select("li.genre.meta-data > span.value a").map(e => e.text.trim());
        
        let statusText = doc.selectFirst("li.status > .value")?.text ?? '';
        const status = this._parseStatus(statusText);

        const chapters = [];
        const episodeElements = doc.select("li.episode-anime > a");
        for (const element of episodeElements) {
            chapters.push({
                name: element.selectFirst(".episode-title").text.trim(),
                url: element.getHref
            });
        }
        chapters.reverse();

        return { name, imageUrl, description, link, status, genre, chapters };
    }

    async getVideoList(url) {
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        const videos = [];

        const serverLinks = doc.select("[aria-labelledby=mirror-dropdown] > li > a.dropdown-item");
        
        for (const serverLink of serverLinks) {
            const embedUrl = `${this.source.baseUrl}/embed?v=${serverLink.attr("href").split("v=")[1].split("&")[0]}`;
            const serverName = serverLink.text.replace("/", "").trim();

            try {
                const embedRes = await this.client.get(embedUrl, this.getHeaders(url));
                const embedDoc = new Document(embedRes.body);

                const sourceElements = embedDoc.select("video#player > source");
                for (const source of sourceElements) {
                    const videoUrl = source.attr("src");
                    const quality = `${serverName} - ${source.attr("title")}`;
                    if (videoUrl) {
                        videos.push({
                            url: videoUrl,
                            originalUrl: videoUrl,
                            quality: quality,
                            headers: { "Referer": embedUrl }
                        });
                    }
                }
            } catch (e) {
                // Skip server if it fails
            }
        }

        return videos;
    }

    getFilterList() {
        return [];
    }

    getSourcePreferences() {
        return [];
    }

}
