const mangayomiSources = [{
    "name": "AnimeBlkom",
    "id": 1732644849,
    "lang": "ar",
    "baseUrl": "https://animeblkom.net",
    "iconUrl": "https://www.google.com/s2/favicons?sz=128&domain=https://animeblkom.net",
    "typeSource": "multi",
    "itemType": 1,
    "version": "1.0.3",
    "pkgPath": "anime/src/ar/animeblkom.js"
}];


class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this.CATEGORY_GIRLS = "/api/v1/browse/react?gender-hide=m,t,c&perPage=98";
    this.CATEGORY_MALE = "/api/v1/browse/react?gender-hide=c,f,t&perPage=98";
    this.CATEGORY_TRANS = "/api/v1/browse/react?gender-hide=c,f,m&perPage=98";
    this.CATEGORY_COUPLES = "/api/v1/browse/react?gender-hide=m,f,t&perPage=98";
  }

  getPreference(key) {
    const preferences = new SharedPreferences();
    // For switches, check against the string 'true'
    return preferences.get(key) === 'true';
  }

  async _getCategoryPage(apiEndpoint, page) {
    const baseUrl = this.source.baseUrl;
    const apiUrl = `${baseUrl}${apiEndpoint}&p=${page}`;
    const res = await this.client.get(apiUrl);
    const responseData = JSON.parse(res.body);
    const list = [];
    if (responseData?.userList) {
      responseData.userList.forEach((user) => {
        list.push({
          name: user.username,
          link: `${baseUrl}/${user.username}`,
          imageUrl: user.thumbUrl || user.offlinePictureUrl,
        });
      });
    }
    return { list, hasNextPage: list.length > 0 };
  }

  async getPopular(page) {
    const endpoint = new SharedPreferences().get("camsoda_popular_category") || this.CATEGORY_GIRLS;
    return this._getCategoryPage(endpoint, page);
  }

  async getLatestUpdates(page) {
    const endpoint = new SharedPreferences().get("camsoda_latest_category") || this.CATEGORY_COUPLES;
    return this._getCategoryPage(endpoint, page);
  }

  async search(query, page) {
    const baseUrl = this.source.baseUrl;
    const apiUrl = `${baseUrl}/api/v1/browse/react/search/${encodeURIComponent(query)}?p=${page}&perPage=98`;
    const res = await this.client.get(apiUrl);
    const responseData = JSON.parse(res.body);
    const list = [];
    if (responseData?.userList) {
      responseData.userList.forEach((user) => {
        list.push({
          name: user.username,
          link: `${baseUrl}/${user.username}`,
          imageUrl: user.thumbUrl || user.offlinePictureUrl,
        });
      });
    }
    return { list, hasNextPage: list.length > 0 };
  }

  async getDetail(url) {
    const res = await this.client.get(url);
    const doc = new Document(res.body);
    const name = doc.selectFirst("meta[property='og:title']")?.attr("content")?.trim();
    const imageUrl = doc.selectFirst("meta[property='og:image']")?.attr("content");
    const description = doc.selectFirst("meta[property='og:description']")?.attr("content")?.trim();
    const chapters = [{ name: "Live Stream", url }];
    return { name, imageUrl, description, link: url, chapters, status: 0 };
  }

  async _extractQualitiesFromM3U8(masterUrl, headers) {
    const qualities = [];
    try {
      const res = await this.client.get(masterUrl, { headers });
      const masterContent = res.body;
      const lines = masterContent.split("\n");
      const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
          const resolutionMatch = lines[i].match(/RESOLUTION=\d+x(\d+)/);
          const qualityLabel = resolutionMatch ? `${resolutionMatch[1]}p` : "Stream";
          if (i + 1 < lines.length && lines[i + 1].trim().length > 0) {
            let mediaPlaylistUrl = lines[i + 1].trim();
            if (!mediaPlaylistUrl.startsWith("http")) {
              mediaPlaylistUrl = baseUrl + mediaPlaylistUrl;
            }
            qualities.push({ url: mediaPlaylistUrl, originalUrl: mediaPlaylistUrl, quality: qualityLabel, headers });
          }
        }
      }
    } catch (e) {
      console.error("Could not extract individual qualities from M3U8:", e);
      return [];
    }
    return qualities.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
  }

  async getVideoList(url) {
    const username = url.split("/").pop();
    if (!username) throw new Error("Could not extract username from URL.");

    const apiUrl = `${this.source.baseUrl}/api/v1/video/vtoken/${username}`;
    const res = await this.client.get(apiUrl);
    const streamData = JSON.parse(res.body);

    if (streamData.status !== 1) throw new Error("Stream is offline.");
    
    const servers = streamData.edge_servers;
    const streamKey = streamData.stream_name;
    const token = streamData.token;

    if (!servers?.length || !streamKey || !token) {
        throw new Error("API response is missing required stream parameters.");
    }

    const headers = {};
    const allStreams = [];
    
    // Check if the user has enabled the non-working "Default" stream for testing
    const showDefaultStream = this.getPreference("camsoda_show_default_stream");
    
    const workingUrlTemplate = `https://{server}/${streamKey}_v1/tracks-v3a2/index.ll.m3u8?filter.tracks=v4v3v2v1a1a2&multitrack=true&token=${token}`;
    
    servers.forEach((server, idx) => {
        const workingM3u8 = workingUrlTemplate.replace("{server}", server);
        allStreams.push({
            url: workingM3u8,
            originalUrl: workingM3u8,
            quality: `Auto (Server ${idx + 1})`,
            headers,
        });

        // Only add the non-working "Default" stream if the user has enabled it in settings
        if (showDefaultStream) {
            const defaultUrlTemplate = `https://{server}/${streamKey}_v1/tracks-v3a2/index.ll.m3u8?`;
            const defaultM3u8 = defaultUrlTemplate.replace("{server}", server);
            allStreams.push({
                url: defaultM3u8,
                originalUrl: defaultM3u8,
                quality: `Default (Server ${idx + 1})`,
                headers,
            });
        }
    });

    if (allStreams.length === 0) throw new Error("No video servers found.");

    const individualQualities = await this._extractQualitiesFromM3U8(allStreams[0].url, headers);
    
    return [...individualQualities, ...allStreams];
  }
  
  getSourcePreferences() {
    const categoryEntries = ["Girls", "Male", "Transgender", "Couples"];
    const categoryValues = [this.CATEGORY_GIRLS, this.CATEGORY_MALE, this.CATEGORY_TRANS, this.CATEGORY_COUPLES];
    return [
      {
        key: "camsoda_popular_category",
        listPreference: {
          title: "Popular Category",
          summary: "Select the category for the Popular tab",
          valueIndex: 0,
          entries: categoryEntries,
          entryValues: categoryValues,
        },
      },
      {
        key: "camsoda_latest_category",
        listPreference: {
          title: "Latest Category",
          summary: "Select the category for the Latest tab",
          valueIndex: 3,
          entries: categoryEntries,
          entryValues: categoryValues,
        },
      },
      {
        key: "camsoda_show_default_stream",
        switchPreference: {
          title: "Show 'Default' Stream (for testing)",
          summary: "Adds a non-working 'Default' stream for testing. This stream will fail to play.",
          value: false, // Default is OFF
        },
      },
    ];
  }
}
