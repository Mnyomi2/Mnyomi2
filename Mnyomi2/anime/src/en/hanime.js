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
    return this.getPreference("hanime_base_url") || this.source.baseUrl;
  }

  getHeaders() {
    const baseUrl = this.getBaseUrl();
    return {
      "Referer": baseUrl,
      "Origin": baseUrl,
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

  async _executeSearch(payload) {
    const apiUrl = "https://search.htv-services.com/search";
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
      // Fallback for empty or malformed 'hits'
    }
    
    const hasNextPage = (payload.page + 1) < searchResult.nbPages;
    return { list, hasNextPage };
  }

  async getPopular(page) {
    const payload = {
      search_text: "",
      tags: [],
      tags_mode: "AND",
      brands: [],
      blacklist: [],
      order_by: "likes",
      ordering: "desc",
      page: page - 1,
    };
    return this._executeSearch(payload);
  }

  async getLatestUpdates(page) {
    const payload = {
      search_text: "",
      tags: [],
      tags_mode: "AND",
      brands: [],
      blacklist: [],
      order_by: "created_at_unix",
      ordering: "desc",
      page: page - 1,
    };
    return this._executeSearch(payload);
  }

  async search(query, page, filters) {
    const getCheckBoxValues = (state) => {
      if (!state) return [];
      return state.filter((item) => item.state).map((item) => item.value);
    };
    const getSelectValue = (filter, defaultValue) => {
      if (!filter || typeof filter.state !== 'number') return defaultValue;
      return filter.values[filter.state]?.value ?? defaultValue;
    };

    const isFiltersAvailable = filters && filters.length > 0;
    
    const payload = {
      search_text: query,
      tags: isFiltersAvailable ? getCheckBoxValues(filters[0]?.state) : [],
      tags_mode: isFiltersAvailable ? getSelectValue(filters[3], "AND") : "AND",
      brands: isFiltersAvailable ? getCheckBoxValues(filters[2]?.state) : [],
      blacklist: isFiltersAvailable ? getCheckBoxValues(filters[1]?.state) : [],
      order_by: isFiltersAvailable ? getSelectValue(filters[4], "likes") : (query ? "relevance" : "likes"),
      ordering: isFiltersAvailable ? getSelectValue(filters[5], "desc") : "desc",
      page: page - 1,
    };
    
    return this._executeSearch(payload);
  }

  async getDetail(url) {
    const baseUrl = this.getBaseUrl();
    const id = url.split("?id=")[1];
    const apiUrl = `${baseUrl}/api/v8/video?id=${id}`;
    const res = await this.client.get(apiUrl, this.getHeaders());
    const data = JSON.parse(res.body);

    const name = this.getTitle(data.hentai_video.name);
    const imageUrl = data.hentai_video.cover_url;
    const description = (data.hentai_video.description || "").replace(/<\/?p>/g, "");
    const genre = data.hentai_tags.map((tag) => tag.text);
    const status = 1;

    const chapters = data.hentai_franchise_hentai_videos.map((ep) => ({
      name: ep.name,
      url: `${baseUrl}/api/v8/video?id=${ep.id}`,
    }));
    chapters.reverse();

    return {
      name, imageUrl, description, genre, status, chapters, link: baseUrl + url,
    };
  }
  
  sortStreams(streams) {
    const preferredQuality = this.getPreference("hanime_pref_quality") || "1080";
    
    streams.sort((a, b) => {
      const qualityA = parseInt(a.quality.split(" - ")[1].replace('p', '')) || 0;
      const qualityB = parseInt(b.quality.split(" - ")[1].replace('p', '')) || 0;
      
      const isAPreferred = a.quality.includes(preferredQuality);
      const isBPreferred = b.quality.includes(preferredQuality);
      
      if (isAPreferred && !isBPreferred) return -1;
      if (!isAPreferred && isBPreferred) return 1;

      return qualityB - qualityA;
    });

    return streams;
  }

  async getVideoList(url) {
    const res = await this.client.get(url, this.getHeaders());
    const data = JSON.parse(res.body);

    let streams = [];
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

    return this.sortStreams(streams);
  }

  getFilterList() {
    const f = (name, value) => ({ type_name: "SelectOption", name, value });
    const g = (name, value) => ({ type_name: "CheckBox", name, value });

    const createTagState = (items) => items.map(item => g(item, item.toLowerCase()));
    const createBrandState = (items) => items.map(item => g(item, item));

    const tags = ["3D", "Ahegao", "Anal", "Animation", "BDSM", "Big Tits", "Cosplay", "Creampie", "Dark Skin", "Elf", "Futanari", "Gender Bender", "Handjob", "Harem", "Incest", "Inflation", "Loli", "Maid", "Milf", "Mind Break", "Mind Control", "Monster", "NTR", "Nakadashi", "No Penetration", "Oppai", "POV", "Pregnant", "Rape", "Reverse Rape", "Rimjob", "Schoolgirl", "Shota", "Stockings", "Succubus", "Tentacles", "Threesome", "Toy", "Trap", "Tsundere", "Ugly Bastard", "Vanilla", "X-Ray", "Yaoi", "Yuri"];
    const brands = ["37c-Binetsu", "Anime-Koubou-Ram", "Antechinus", "BOMB! CUTE! BOMB!", "Bootleg", "BreakBottle", "Bunnywalker", "Digital-Works", "EDGE", "First-Star", "Front-Line", "G-Collections", "Garden", "General-Entertainment", "Gold-Bear", "Himajin", "Hooligan", "Horipro", "Hot-Bear", "Jumondo", "Majin", "Media-Bank", "Moon-Night-Lady", "Mu", "Natural-High", "Nihikime-no-dozeu", "nur", "Pashmina", "Poro", "Sesso-Esotico", "Shouten", "Studio-1", "Studio-Deen", "Suzuki-Mirano", "Toratepotto", "Union-Chooser", "White-Bear", "ZIZ", "Zyc"];

    return [
      { type_name: "GroupFilter", name: "Include Tags", state: createTagState(tags) },
      { type_name: "GroupFilter", name: "Exclude Tags (Blacklist)", state: createTagState(tags) },
      { type_name: "GroupFilter", name: "Brands", state: createBrandState(brands) },
      {
        type_name: "SelectFilter", name: "Tag Mode", state: 0,
        values: [ f("And", "AND"), f("Or", "OR") ]
      },
      {
        type_name: "SelectFilter", name: "Sort by", state: 2, // Default to Likes
        values: [
            f("Uploads", "created_at_unix"),
            f("Views", "views"),
            f("Likes", "likes"),
            f("Release", "released_at_unix"),
            f("Alphabetical", "title_sortable")
        ]
      },
      {
        type_name: "SelectFilter", name: "Order", state: 1, // Default to Descending
        values: [
            f("Ascending", "asc"),
            f("Descending", "desc")
        ]
      }
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: "hanime_base_url",
        editTextPreference: {
          title: "Override Base URL",
          summary: "Default: https://hanime.tv",
          value: "https://hanime.tv",
          dialogTitle: "Override Base URL",
          dialogMessage: "",
        },
      },
      {
        key: "hanime_pref_quality",
        listPreference: {
          title: "Preferred Video Quality",
          summary: "Select the quality to prioritize in the stream list",
          valueIndex: 0,
          entries: ["1080p", "720p", "480p", "360p"],
          entryValues: ["1080", "720", "480", "360"],
        },
      },
    ];
  }
}
