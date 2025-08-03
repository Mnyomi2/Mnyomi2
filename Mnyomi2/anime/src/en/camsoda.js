const mangayomiSources = [{
    "name": "Camsoda",
    "id": 163467482,
    "lang": "en",
    "baseUrl": "https://www.camsoda.com",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://www.camsoda.com",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.5.3",
    "pkgPath": "anime/src/en/camsoda.js"
}];



class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();

    this.CATEGORY_GIRLS = "/api/v1/browse/react?gender-hide=m,t,c&perPage=98";
    this.CATEGORY_MALE = "/api/v1/browse/react?gender-hide=c,f,t&perPage=98";
    this.CATEGORY_TRANS = "/api/v1/browse/react?gender-hide=c,f,m&perPage=98";
    this.CATEGORY_COUPLES = "/api/v1/browse/react?gender-hide=m,f,t&perPage=98";

    this.CATEGORY_FEMALE_NA = "/api/v1/browse/react/girls/region/usa?gender-hide=c,t,m&perPage=98";
    this.CATEGORY_FEMALE_SA = "/api/v1/browse/react/girls/region/central-south-america?gender-hide=c,t,m&perPage=98";
    this.CATEGORY_FEMALE_EU = "/api/v1/browse/react/girls/region/europe?gender-hide=c,t,m&perPage=98";
    this.CATEGORY_FEMALE_EE = "/api/v1/browse/react/girls/region/eastern-europe?gender-hide=c,t,m&perPage=98";
    this.CATEGORY_FEMALE_AS = "/api/v1/browse/react/girls/region/asia?gender-hide=c,t,m&perPage=98";
  }

  getPreference(key) {
    return new SharedPreferences().get(key);
  }

  async _getCategoryPage(apiEndpoint, page) {
    const apiUrl = `${this.source.baseUrl}${apiEndpoint}&p=${page}`;
    const res = await this.client.get(apiUrl);
    if (!res.body.startsWith('{')) throw new Error("Invalid response format.");
    const responseData = JSON.parse(res.body);
    const list = responseData?.userList?.map(user => ({
      name: user.username,
      link: `${this.source.baseUrl}/${user.username}`,
      imageUrl: user.thumbUrl || user.offlinePictureUrl,
    })) || [];
    return { list, hasNextPage: list.length > 0 };
  }

  async getPopular(page) {
    const endpoint = this.getPreference("camsoda_popular_category") || this.CATEGORY_COUPLES;
    return this._getCategoryPage(endpoint, page);
  }

  async getLatestUpdates(page) {
    const endpoint = this.getPreference("camsoda_latest_category") || this.CATEGORY_GIRLS;
    return this._getCategoryPage(endpoint, page);
  }

  // ✅ تم إصلاحها بالكامل
  async search(query, page, filters) {
    let apiEndpoint;

    if (query) {
      apiEndpoint = `/api/v1/browse/react/search/${encodeURIComponent(query)}?perPage=98`;
    } else {
      const categoryFilter = filters?.find(f => f.name === "Category");
      const selectedOption = categoryFilter?.values?.[categoryFilter.state];
      apiEndpoint = selectedOption?.value || this.CATEGORY_GIRLS;
    }

    return this._getCategoryPage(apiEndpoint, page);
  }

  async getDetail(url) {
    const res = await this.client.get(url);
    const doc = new Document(res.body);
    const name = doc.selectFirst("meta[property='og:title']")?.attr("content")?.trim();
    const imageUrl = doc.selectFirst("meta[property='og:image']")?.attr("content");
    const description = doc.selectFirst("meta[property='og:description']")?.attr("content")?.trim();
    return { name, imageUrl, description, link: url, chapters: [{ name: "Live Stream", url }], status: 0 };
  }

  async _extractQualitiesFromM3U8(masterUrl, headers) {
    const qualities = [];
    try {
      const res = await this.client.get(masterUrl, { headers });
      const lines = res.body.split("\n");
      const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
          const resolutionMatch = lines[i].match(/RESOLUTION=\d+x(\d+)/);
          const qualityLabel = resolutionMatch ? `${resolutionMatch[1]}p` : "Stream";
          let mediaPlaylistUrl = lines[i + 1]?.trim();
          if (mediaPlaylistUrl && !mediaPlaylistUrl.startsWith("http")) {
            mediaPlaylistUrl = baseUrl + mediaPlaylistUrl;
          }
          qualities.push({ url: mediaPlaylistUrl, originalUrl: mediaPlaylistUrl, quality: qualityLabel, headers });
        }
      }
    } catch (e) {
      console.error("Error parsing m3u8:", e);
    }
    return qualities.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
  }

  async getVideoList(url) {
    const username = url.split("/").pop();
    const apiUrl = `${this.source.baseUrl}/api/v1/video/vtoken/${username}`;
    const res = await this.client.get(apiUrl);
    const streamData = JSON.parse(res.body);
    if (streamData.status !== 1) throw new Error("Stream offline");

    const servers = streamData.edge_servers;
    const streamKey = streamData.stream_name;
    const token = streamData.token;
    const headers = {};
    const videoStreams = [];
    const streamType = this.getPreference("camsoda_stream_type") || "manual_quality";

    if (streamType === 'manual_quality') {
      const server = servers[0];
      const qualityCodes = ['v4', 'v3', 'v2', 'v1'];
      const qualityLabels = ['Highest', 'Medium-High', 'Medium-Low', 'Lowest'];
      for (let i = 0; i < qualityCodes.length; i++) {
        const quality = qualityCodes[i];
        const url = `https://${server}/${streamKey}_v1/tracks-${quality}a2/index.ll.m3u8?token=${token}`;
        videoStreams.push({ url, originalUrl: url, quality: qualityLabels[i], headers });
      }
      return videoStreams;
    }

    let urlTemplate, qualityLabel;
    if (streamType === 'll_hls') {
      urlTemplate = `https://{server}/${streamKey}_v1/tracks-v3a2/index.ll.m3u8?filter.tracks=v4v3v2v1a1a2&multitrack=true&token=${token}`;
      qualityLabel = 'LL-HLS';
    } else if (streamType === 'default') {
      urlTemplate = `https://{server}/${streamKey}_v1/tracks-v4a2/index.ll.m3u8`;
      qualityLabel = 'Default';
    } else {
      urlTemplate = `https://{server}/${streamKey}_v1/index.m3u8?token=${token}`;
      qualityLabel = 'Auto Live';
    }

    servers.forEach((server, i) => {
      const url = urlTemplate.replace("{server}", server);
      videoStreams.push({ url, originalUrl: url, quality: `${qualityLabel} (Server ${i + 1})`, headers });
    });

    if (streamType === 'default') return videoStreams;
    const individualQualities = await this._extractQualitiesFromM3U8(videoStreams[0].url, headers);
    return [...individualQualities, ...videoStreams];
  }

  getSourcePreferences() {
    const categoryEntries = [
      "Girls (All)", "Girls (North America)", "Girls (Central/South America)",
      "Girls (Europe)", "Girls (Eastern Europe)", "Girls (Asia)",
      "Couples", "Male", "Transgender"
    ];
    const categoryValues = [
      this.CATEGORY_GIRLS, this.CATEGORY_FEMALE_NA, this.CATEGORY_FEMALE_SA,
      this.CATEGORY_FEMALE_EU, this.CATEGORY_FEMALE_EE, this.CATEGORY_FEMALE_AS,
      this.CATEGORY_COUPLES, this.CATEGORY_MALE, this.CATEGORY_TRANS
    ];

    return [
      {
        key: "camsoda_popular_category",
        listPreference: {
          title: "Popular Category", summary: "Select a category for the Popular tab",
          valueIndex: 6, entries: categoryEntries, entryValues: categoryValues
        }
      },
      {
        key: "camsoda_latest_category",
        listPreference: {
          title: "Latest Category", summary: "Select a category for the Latest tab",
          valueIndex: 0, entries: categoryEntries, entryValues: categoryValues
        }
      },
      {
        key: "camsoda_stream_type",
        listPreference: {
          title: "Stream URL Type", summary: "Select a stream type. Manual is recommended.",
          valueIndex: 0,
          entries: ["Manual Quality", "Auto Live", "LL-HLS", "Default"],
          entryValues: ["manual_quality", "auto_live", "ll_hls", "default"]
        }
      }
    ];
  }

  getFilterList() {
    const categories = [
      { name: "Girls (All)", value: this.CATEGORY_GIRLS },
      { name: "Girls (North America)", value: this.CATEGORY_FEMALE_NA },
      { name: "Girls (Central/South America)", value: this.CATEGORY_FEMALE_SA },
      { name: "Girls (Europe)", value: this.CATEGORY_FEMALE_EU },
      { name: "Girls (Eastern Europe)", value: this.CATEGORY_FEMALE_EE },
      { name: "Girls (Asia)", value: this.CATEGORY_FEMALE_AS },
      { name: "Couples", value: this.CATEGORY_COUPLES },
      { name: "Male", value: this.CATEGORY_MALE },
      { name: "Transgender", value: this.CATEGORY_TRANS },
    ];

    return [{
      type_name: "SelectFilter",
      name: "Category",
      state: 0,
      values: categories.map(cat => ({
        type_name: "SelectOption",
        name: cat.name,
        value: cat.value
      }))
    }];
  }
}
