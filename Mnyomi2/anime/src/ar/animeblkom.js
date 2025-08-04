const mangayomiSources = [
  {
    "name": "Animeblkom",
    "id": 987654321,
    "baseUrl": "https://animeblkom.net",
    "lang": "ar",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=animeblkom.net",
    "itemType": 1,
    "version": "1.5.0",
    "hasCloudflare": true,
    "pkgPath": "anime/src/ar/animeblkom.js",
  },
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  getPreference(key) {
    return new SharedPreferences().get(key);
  }

  getBaseUrl() {
    return this.getPreference("animeblkom_base_url");
  }

  getHeaders() {
    return { "Referer": this.getBaseUrl() };
  }

  async requestDoc(url) {
    const res = await this.client.get(url, this.getHeaders());
    return new Document(res.body);
  }

  async getPopular(page) {
    const url = `${this.getBaseUrl()}/animes-list?page=${page}&sort_by=rate`;
    const doc = await this.requestDoc(url);
    const list = [];
    const items = doc.select("div.content div.content-inner");

    items.forEach((item) => {
      const linkElement = item.selectFirst("div.name a");
      if (!linkElement) return;

      const name = linkElement.text;
      const link = linkElement.getHref;

      const imageElement = item.selectFirst("div.poster img");
      let imageUrl = imageElement.attr("data-original");
      if (!imageUrl.startsWith("http")) {
          imageUrl = this.getBaseUrl() + imageUrl;
      }
      
      list.push({ name, link, imageUrl });
    });
    
    const hasNextPage = !!doc.selectFirst("a[rel=next]");
    return { list, hasNextPage };
  }

  async getLatestUpdates(page) {
    const url = `${this.getBaseUrl()}/animes-list?page=${page}&sort_by=created_at`;
    const doc = await this.requestDoc(url);
    const list = [];
    const items = doc.select("div.content div.content-inner");

    items.forEach((item) => {
      const linkElement = item.selectFirst("div.name a");
      if (!linkElement) return;

      const name = linkElement.text;
      const link = linkElement.getHref;

      const imageElement = item.selectFirst("div.poster img");
      let imageUrl = imageElement.attr("data-original");
      if (!imageUrl.startsWith("http")) {
          imageUrl = this.getBaseUrl() + imageUrl;
      }
      
      list.push({ name, link, imageUrl });
    });
    
    const hasNextPage = !!doc.selectFirst("a[rel=next]");
    return { list, hasNextPage };
  }

  async search(query, page, filters) {
    const url = `${this.getBaseUrl()}/animes-list?search=${query}&page=${page}`;
    const doc = await this.requestDoc(url);
    const list = [];
    const items = doc.select("div.content div.content-inner");

    items.forEach((item) => {
      const linkElement = item.selectFirst("div.name a");
      if (!linkElement) return;

      const name = linkElement.text;
      const link = linkElement.getHref;

      const imageElement = item.selectFirst("div.poster img");
      let imageUrl = imageElement.attr("data-original");
      if (!imageUrl.startsWith("http")) {
          imageUrl = this.getBaseUrl() + imageUrl;
      }
      
      list.push({ name, link, imageUrl });
    });
    
    const hasNextPage = !!doc.selectFirst("a[rel=next]");
    return { list, hasNextPage };
  }

  async getDetail(url) {
    const doc = await this.requestDoc(url);

    function statusCode(status) {
        status = status.trim();
        return {
            "مستمر": 0,       // Ongoing
            "منتهي": 1,        // Completed
            "لم يعرض بعد": 4 // Not yet aired
        }[status] ?? 5;     // Unknown
    }

    const name = doc.selectFirst("div.name h1").text.replace(/\(anime\)/i, '').trim();

    const imageElement = doc.selectFirst("div.poster img");
    let imageUrl = imageElement.attr("data-original");
    if (!imageUrl.startsWith("http")) {
        imageUrl = this.getBaseUrl() + imageUrl;
    }
    
    const description = doc.selectFirst("div.story-container div.story").text.trim();
    
    const genre = doc.select("p.genres a").map(el => el.text.trim());

    let status = 5;
    const infoRows = doc.select(".info-table > div");
    infoRows.forEach(row => {
        const head = row.selectFirst("span.head").text;
        if (head.includes("حالة الأنمي")) {
            const statusText = row.selectFirst("span.info").text;
            status = statusCode(statusText);
        }
    });

    const chapters = [];
    doc.select("ul.episodes-links li.episode-link").forEach((item) => {
      const linkElement = item.selectFirst("a");
      const link = linkElement.getHref;
      const spans = linkElement.select("span");
      const epNum = spans[spans.length - 1].text.trim();
      
      chapters.push({ name: `الحلقة ${epNum}`, url: link });
    });

    chapters.reverse();
    
    return { name, imageUrl, description, genre, status, link: url, chapters };
  }
  
  async getVideoList(url) {
    const doc = await this.requestDoc(url);
    const videos = [];

    // Select all links within the direct download modal
    doc.select("div.direct-download a[target='_blank']").forEach(link => {
        const videoUrl = link.getHref;
        // The text content is like "360p 46.17 MiB", we use it for quality.
        const quality = link.text.trim();

        if (videoUrl) {
            videos.push({
                url: videoUrl,
                originalUrl: videoUrl,
                quality: quality,
                headers: { "Referer": url } // Add referer for direct links
            });
        }
    });

    if (videos.length === 0) {
        throw new Error("No direct download links found. The site may have changed its structure.");
    }

    // Sort the videos based on user preference
    const preferredQuality = this.getPreference("animeblkom_preferred_quality");

    return videos.sort((a, b) => {
        const aIsPreferred = a.quality.includes(preferredQuality);
        const bIsPreferred = b.quality.includes(preferredQuality);

        // If 'a' is the preferred quality and 'b' is not, 'a' comes first.
        if (aIsPreferred && !bIsPreferred) return -1;
        // If 'b' is the preferred quality and 'a' is not, 'b' comes first.
        if (!aIsPreferred && bIsPreferred) return 1;
        
        // Optional: for other cases, sort by quality descending (1080p > 720p)
        const aQualityNum = parseInt(a.quality);
        const bQualityNum = parseInt(b.quality);
        return bQualityNum - aQualityNum;
    });
  }
  
  getSourcePreferences() {
      return [
          {
              key: "animeblkom_base_url",
              editTextPreference: {
                  title: "Override Base URL",
                  summary: "Default: https://animeblkom.net",
                  value: "https://animeblkom.net",
                  dialogTitle: "Override Base URL",
                  dialogMessage: "Enter the new Base URL for Animeblkom.",
              }
          },
          {
              key: "animeblkom_preferred_quality",
              listPreference: {
                  title: "Preferred Video Quality",
                  summary: "Select your preferred quality. It will be prioritized in the video list.",
                  valueIndex: 0, // Default to 1080p
                  entries: ["1080p", "720p", "480p", "360p"],
                  entryValues: ["1080p", "720p", "480p", "360p"],
              }
          }
      ];
  }
}
