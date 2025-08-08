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

  getHeaders() {
    return {
      "Referer": this.source.baseUrl,
      "Origin": this.source.baseUrl,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
    };
  }

  // Helper methods
  isNumber(num) {
    return !isNaN(parseInt(num));
  }

  getTitle(title) {
    if (title.includes(" Ep ")) {
      return title.split(" Ep ")[0].trim();
    } else {
      const parts = title.trim().split(" ");
      const lastPart = parts[parts.length - 1];
      if (this.isNumber(lastPart)) {
        return parts.slice(0, -1).join(" ").trim();
      } else {
        return title.trim();
      }
    }
  }

  async getPopular(page) {
    // "Popular" is the search endpoint sorted by likes.
    const apiUrl = "https://search.htv-services.com/search";
    const payload = {
      search_text: "",
      tags: [],
      tags_mode: "AND",
      brands: [],
      blacklist: [],
      order_by: "likes", // <--- Sort by likes for popular
      ordering: "desc",
      page: page - 1, // API is 0-indexed
    };

    const headers = { ...this.getHeaders(), "Content-Type": "application/json" };
    const res = await this.client.post(apiUrl, headers, payload);
    const searchResult = JSON.parse(res.body);

    const list = [];
    const titles = new Set();

    try {
      const hits = JSON.parse(searchResult.hits);
      for (const hit of hits) {
        const title = this.getTitle(hit.name);
        if (!titles.has(title)) {
          titles.add(title);
          list.push({
            name: title,
            link: `/videos/hentai/${hit.slug}?id=${hit.id}`,
            imageUrl: hit.cover_url,
          });
        }
      }
    } catch (e) {
        // Fallback for empty or malformed hits
    }
    
    const hasNextPage = page < searchResult.nbPages;
    return { list, hasNextPage };
  }

  async getLatestUpdates(page) {
    // "Latest" is the search endpoint sorted by creation date.
    return this.search("", page, []);
  }

  async search(query, page, filters) {
    const apiUrl = "https://search.htv-services.com/search";
    const payload = {
      search_text: query,
      tags: [],
      tags_mode: "AND",
      brands: [],
      blacklist: [],
      // Use 'relevance' for search, and 'created_at_unix' for latest
      order_by: query ? "relevance" : "created_at_unix",
      ordering: "desc",
      page: page - 1, // API is 0-indexed
    };

    const headers = { ...this.getHeaders(), "Content-Type": "application/json" };
    const res = await this.client.post(apiUrl, headers, payload);
    const searchResult = JSON.parse(res.body);

    const list = [];
    const titles = new Set();

    try {
      // The 'hits' property is a JSON string, so it needs to be parsed again.
      const hits = JSON.parse(searchResult.hits);
      for (const hit of hits) {
        const title = this.getTitle(hit.name);
        if (!titles.has(title)) {
          titles.add(title);
          list.push({
            name: title,
            link: `/videos/hentai/${hit.slug}?id=${hit.id}`,
            imageUrl: hit.cover_url,
          });
        }
      }
    } catch (e) {
      // Fallback for empty or malformed 'hits'
    }
    const hasNextPage = page < searchResult.nbPages;
    return { list, hasNextPage };
  }

  async getDetail(url) {
    const id = url.split("?id=")[1];
    const apiUrl = `${this.source.baseUrl}/api/v8/video?id=${id}`;
    const res = await this.client.get(apiUrl, this.getHeaders());

    // Structure: { hentai_video, hentai_tags, hentai_franchise_hentai_videos, ... }
    const data = JSON.parse(res.body);

    const name = this.getTitle(data.hentai_video.name);
    const imageUrl = data.hentai_video.cover_url;
    const description = (data.hentai_video.description || "").replace(
      /<\/?p>/g,
      ""
    );
    const genre = data.hentai_tags.map((tag) => tag.text);
    const status = 1; // Completed, as most are single videos/short series.

    const chapters = data.hentai_franchise_hentai_videos.map((ep) => ({
      name: ep.name,
      // The URL for getVideoList will be the API endpoint for that specific episode
      url: `${this.source.baseUrl}/api/v8/video?id=${ep.id}`,
    }));

    chapters.reverse();

    return {
      name,
      imageUrl,
      description,
      genre,
      status,
      chapters,
      link: this.source.baseUrl + url,
    };
  }

  async getVideoList(url) {
    const res = await this.client.get(url, this.getHeaders());
    // Structure: { videos_manifest: { servers: [] }, ... }
    const data = JSON.parse(res.body);

    const streams = [];
    if (data.videos_manifest && data.videos_manifest.servers) {
      for (const server of data.videos_manifest.servers) {
        for (const stream of server.streams) {
          if (stream.url) {
            streams.push({
              url: stream.url,
              originalUrl: stream.url,
              quality: `${server.name} - ${stream.height}p`,
              headers: this.getHeaders(),
            });
          }
        }
      }
    }

    // Sort by quality descending
    streams.sort((a, b) => {
        const qualityA = parseInt(a.quality.split(" - ")[1].replace('p', '')) || 0;
        const qualityB = parseInt(b.quality.split(" - ")[1].replace('p', '')) || 0;
        return qualityB - qualityA;
    });

    return streams;
  }

  getSourcePreferences() {
    return [];
  }
}
