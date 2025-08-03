const mangayomiSources = [{
    "name": "HStream",
    "id": 987654321,
    "lang": "en",
    "baseUrl": "https://hstream.moe",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://hstream.moe",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.5.4",
    "pkgPath": "anime/src/en/hstream.js"
}];


class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  // Helper for parsing home and search pages
  parseHomepage(doc) {
    const list = [];
    doc.select("div.items-center div.w-full > a").forEach(it => {
      const name = it.selectFirst("img")?.attr("alt") ?? "No Title";
      const link = it.attr("href");
      const imageUrl = it.selectFirst("img")?.attr("src");
      if (link) {
        list.push({ name, link, imageUrl });
      }
    });
    return list;
  }

  async getPopular(page) {
    const url = `${this.source.baseUrl}/search?order=view-count&page=${page}`;
    const doc = new Document((await this.client.get(url)).body);
    const list = this.parseHomepage(doc);
    return { list, hasNextPage: list.length > 0 };
  }

  async getLatestUpdates(page) {
    const url = `${this.source.baseUrl}/search?order=recently-uploaded&page=${page}`;
    const doc = new Document((await this.client.get(url)).body);
    const list = this.parseHomepage(doc);
    return { list, hasNextPage: list.length > 0 };
  }

  async search(query, page, filters) {
    const url = `${this.source.baseUrl}/search?search=${query}&page=${page}`;
    const doc = new Document((await this.client.get(url)).body);
    const list = this.parseHomepage(doc);
    return { list, hasNextPage: list.length > 0 };
  }

  async getDetail(url) {
    const doc = new Document((await this.client.get(url)).body);
    const name = doc.selectFirst("div.relative h1")?.text?.trim() ?? "No Title";
    const imageUrl = doc.selectFirst("meta[property=og:image]")?.attr("content");
    const description = doc.selectFirst("meta[property=og:description]")?.attr("content");
    const genre = doc.select("ul.list-none.text-center li a").map(it => it.text);
    
    // For single-video sources like this, create one "chapter" representing the movie.
    const chapters = [{
      name: "Movie",
      url: url
    }];
    
    // The source seems to have only completed movies.
    const status = 1; // Completed
    
    return { name, imageUrl, description, genre, status, chapters, link: url };
  }

  // Helper to determine the video file path based on resolution and legacy status.
  getVideoUrlPath(isLegacy, resolution) {
    if (isLegacy) {
      return resolution === "720" ? "/x264.720p.mp4" : `/av1.${resolution}.webm`;
    }
    return `/${resolution}/manifest.mpd`;
  }

  async getVideoList(url) {
    const res = await this.client.get(url);
    if (res.statusCode !== 200) {
        throw new Error(`Failed to load page: ${url}`);
    }

    // Handle cookies and extract the XSRF-TOKEN.
    const cookies = res.headers['Set-Cookie'] || [];
    const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

    let token = '';
    const tokenCookie = cookies.find(c => c.trim().startsWith("XSRF-TOKEN="));
    if (tokenCookie) {
        token = decodeURIComponent(tokenCookie.split(';')[0].split('=')[1]);
    }

    if (!token) {
        throw new Error("XSRF-TOKEN not found. VPN might be required.");
    }

    const doc = new Document(res.body);
    const episodeId = doc.selectFirst("input#e_id")?.attr("value");
    if (!episodeId) {
        throw new Error("Episode ID not found on the page.");
    }

    // Make a POST request to the player API to get stream details.
    const postUrl = `${this.source.baseUrl}/player/api`;
    const postBody = JSON.stringify({ "episode_id": episodeId });
    const headers = {
        "Referer": url,
        "Origin": this.source.baseUrl,
        "X-Requested-With": "XMLHttpRequest",
        "X-XSRF-TOKEN": token,
        "Cookie": cookieHeader,
        "content-type": "application/json"
    };

    const playerApiRes = await this.client.post(postUrl, headers, postBody);
    if (playerApiRes.statusCode !== 200) {
        throw new Error(`Failed to fetch player API: ${playerApiRes.statusText}`);
    }
    const req = JSON.parse(playerApiRes.body);

    const streams = [];
    const subtitles = [];

    if (!req.stream_domains || req.stream_domains.length === 0 || !req.stream_url) {
        throw new Error("Stream domain or URL not found in API response.");
    }

    const randomDomain = req.stream_domains[Math.floor(Math.random() * req.stream_domains.length)];
    const urlBase = `${randomDomain}/${req.stream_url}`;
    
    const resolutions = ["720", "1080"];
    if (req.resolution === "4k") {
        resolutions.push("2160");
    }

    // Generate stream links for each resolution.
    resolutions.forEach(resolution => {
        const videoPath = this.getVideoUrlPath(req.legacy !== 0, resolution);
        const streamUrl = urlBase + videoPath;
        streams.push({
            url: streamUrl,
            originalUrl: streamUrl,
            quality: `${resolution}p`,
            headers: { "Referer": "" } // Set empty Referer as per original logic
        });
    });

    if (streams.length === 0) {
        throw new Error("No streams were extracted.");
    }

    // Add subtitle file.
    subtitles.push({
        file: `${urlBase}/eng.ass`,
        label: "English"
    });

    streams[0].subtitles = subtitles;

    return streams;
  }
}
