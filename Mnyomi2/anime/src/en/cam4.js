const mangayomiSources = [{
    "name": "Cam4",
    "id": 42069420,
    "lang": "en",
    "baseUrl": "https://www.cam4.com",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://www.cam4.com/",
    "typeSource": "multi",
    "itemType": 1,
    "version": "1.1.1",
    "pkgPath": "anime/src/en/cam4.js"
}];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  getPreference(key) {
    const preferences = new SharedPreferences();
    return preferences.get(key);
  }

  // Generic method to fetch a category page
  async _getCategoryPage(preferenceKey, page) {
    const baseUrl = this.source.baseUrl;
    const apiEndpoint = this.getPreference(preferenceKey);

    const apiUrl = `${baseUrl}${apiEndpoint}&page=${page}`;
    const res = await this.client.get(apiUrl);
    const responseData = JSON.parse(res.body);

    const list = [];
    if (responseData && responseData.users) {
      responseData.users.forEach((user) => {
        list.push({
          name: user.username,
          link: `${baseUrl}/${user.username}`,
          imageUrl: user.snapshotImageLink,
        });
      });
    }

    // The API doesn't provide a total page count, but it's a live directory,
    // so we can assume there's always a next page if results are returned.
    const hasNextPage = list.length > 0;

    return { list, hasNextPage };
  }

  async getPopular(page) {
    return this._getCategoryPage("cam4_popular_category", page);
  }



  async getLatestUpdates(page) {
    // Cam4 doesn't have a dedicated "new" or "latest" API endpoint,
    // so we provide a separate preference for user flexibility.
    return this._getCategoryPage("cam4_latest_category", page);
  }

  async search(query, page, filters) {
    // Search functionality is not available for this source.
    return {
      list: [],
      hasNextPage: false,
    };
  }

  async getDetail(url) {
    const res = await this.client.get(url);
    const doc = new Document(res.body);

    const name = doc
      .selectFirst("meta[property='og:title']")
      ?.attr("content")
      .trim();
    const imageUrl = doc
      .selectFirst("meta[property='og:image']")
      ?.attr("content");
    const description = doc
      .selectFirst("meta[property='og:description']")
      ?.attr("content")
      .trim();

    const chapters = [
      {
        name: "Live Stream",
        url: url, // Pass the detail URL to getVideoList
      },
    ];

    return {
      name,
      imageUrl,
      description,
      link: url,
      chapters,
      status: 0, // Live
    };
  }

  /**
   * Fetches and parses a master M3U8 playlist to extract individual quality streams.
   * @param {string} masterUrl - The URL of the master M3U8 file.
   * @param {Object} headers - The headers to use for the request.
   * @returns {Promise<Array<Object>>} A list of stream objects for individual qualities.
   */
  async _extractQualitiesFromM3U8(masterUrl, headers) {
    const qualities = [];
    try {
      const res = await this.client.get(masterUrl, { headers });
      const masterContent = res.body;

      const lines = masterContent.split("\n");
      const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("#EXT-X-STREAM-INF")) {
          const resolutionMatch = line.match(/RESOLUTION=\d+x(\d+)/);
          const qualityLabel = resolutionMatch ? `${resolutionMatch[1]}p` : "Stream";

          if (i + 1 < lines.length && lines[i + 1].trim().length > 0) {
            // Check if the media playlist URL is absolute or relative
            let mediaPlaylistUrl = lines[i + 1].trim();
            if (!mediaPlaylistUrl.startsWith("http")) {
              mediaPlaylistUrl = baseUrl + mediaPlaylistUrl;
            }
            qualities.push({
              url: mediaPlaylistUrl,
              originalUrl: mediaPlaylistUrl,
              quality: qualityLabel,
              headers: headers,
            });
          }
        }
      }
    } catch (e) {
      console.error("Failed to extract qualities from M3U8:", e);
      return [];
    }
    // Sort qualities from highest to lowest
    return qualities.sort((a, b) => {
      const aRes = parseInt(a.quality) || 0;
      const bRes = parseInt(b.quality) || 0;
      return bRes - aRes;
    });
  }

  async getVideoList(url) {
    const urlParts = url.split("/");
    const username = urlParts[urlParts.length - 1];
    const streamInfoUrl = `${this.source.baseUrl}/rest/v1.0/profile/${username}/streamInfo`;

    let masterM3u8Url;
    try {
      const res = await this.client.get(streamInfoUrl);
      const json = JSON.parse(res.body);
      masterM3u8Url = json.cdnURL;
    } catch (e) {
      throw new Error("Failed to fetch stream. The user might be offline.");
    }

    if (!masterM3u8Url) {
      throw new Error("Could not find M3U8 stream URL in the API response.");
    }

    const streamHeaders = {
      Referer: this.source.baseUrl,
      Origin: this.source.baseUrl,
    };

    // The main "Auto" stream which points to the master playlist
    const masterStream = {
      url: masterM3u8Url,
      originalUrl: masterM3u8Url,
      quality: "Auto (Live)",
      headers: streamHeaders,
    };

    // Extract individual quality streams from the master playlist
    const individualQualities = await this._extractQualitiesFromM3U8(
      masterM3u8Url,
      streamHeaders
    );

    const allStreams = [masterStream, ...individualQualities];

    // Reorder streams based on user preference
    const preferredQuality = this.getPreference("preferred_quality") || "auto";

    if (preferredQuality === "auto") {
      return allStreams;
    }

    const foundIndex = allStreams.findIndex((stream) =>
      stream.quality.includes(preferredQuality)
    );

    if (foundIndex > -1) {
      const [preferredStream] = allStreams.splice(foundIndex, 1);
      allStreams.unshift(preferredStream);
    }

    return allStreams;
  }

  getSourcePreferences() {
    const categoryEntries = ["All", "Female", "Male", "Transgender", "Couples"];
    const categoryValues = [
      "/api/directoryCams?directoryJson=true&online=true&url=true&orderBy=VIDEO_QUALITY&resultsPerPage=60",
      "/api/directoryCams?directoryJson=true&online=true&url=true&orderBy=VIDEO_QUALITY&gender=female&broadcastType=female_group&broadcastType=solo&broadcastType=male_female_group&resultsPerPage=60",
      "/api/directoryCams?directoryJson=true&online=true&url=true&orderBy=VIDEO_QUALITY&gender=male&broadcastType=male_group&broadcastType=solo&broadcastType=male_female_group&resultsPerPage=60",
      "/api/directoryCams?directoryJson=true&online=true&url=true&orderBy=VIDEO_QUALITY&gender=shemale&resultsPerPage=60",
      "/api/directoryCams?directoryJson=true&online=true&url=true&orderBy=VIDEO_QUALITY&broadcastType=male_group&broadcastType=female_group&broadcastType=male_female_group&resultsPerPage=60",
    ];

    return [
      {
        key: "cam4_popular_category",
        listPreference: {
          title: "Popular Category",
          summary: "Select the category for the Popular tab",
          valueIndex: 0,
          entries: categoryEntries,
          entryValues: categoryValues,
        },
      },
      {
        key: "cam4_latest_category",
        listPreference: {
          title: "Latest Category",
          summary: "Select the category for the Latest tab",
          valueIndex: 0,
          entries: categoryEntries,
          entryValues: categoryValues,
        },
      },
      {
        key: "preferred_quality",
        listPreference: {
          title: "Preferred Video Quality",
          summary: "The app will try to select this quality by default.",
          valueIndex: 0,
          entries: ["Auto (Live)", "1080p", "720p", "480p", "360p", "240p"],
          entryValues: ["auto", "1080", "720", "480", "360", "240"],
        },
      },
    ];
  }
}
