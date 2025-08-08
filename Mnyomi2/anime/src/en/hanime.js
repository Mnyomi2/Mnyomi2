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

  async getPopular(page) {
    // "Popular" is the search endpoint sorted by likes.
    return await this.search("", page, [
      null,
      null,
      { state: { index: 2, ascending: false } },
    ]);
  }

  async getLatestUpdates(page) {
    // "Latest" is the search endpoint sorted by creation date.
    return this.search("", page, []);
  }

  async search(query, page, filters) {
    function getCheckBox(state) {
      if (!state) return [];
      return state.filter((item) => item.state).map((item) => item.value);
    }
    
    const isFiltersAvailable = !filters || filters.length != 0;

    const tags = isFiltersAvailable ? getCheckBox(filters[0]?.state) : [];
    const brands = isFiltersAvailable ? getCheckBox(filters[1]?.state) : [];
    const sortState = isFiltersAvailable ? filters[2]?.state : null;

    const sortables = [
      { name: "Uploads", value: "created_at_unix" },
      { name: "Views", value: "views" },
      { name: "Likes", value: "likes" },
      { name: "Release", value: "released_at_unix" },
      { name: "Alphabetical", value: "title_sortable" },
    ];
    
    let orderBy = "relevance";
    let ordering = "desc";

    if (sortState) {
        orderBy = sortables[sortState.index].value;
        ordering = sortState.ascending ? "asc" : "desc";
    } else if (!query) {
        orderBy = "created_at_unix"; // Default for latest
    }
    
    const apiUrl = "https://search.htv-services.com/search";
    const payload = {
      search_text: query,
      tags: tags,
      tags_mode: "AND",
      brands: brands,
      blacklist: [],
      order_by: orderBy,
      ordering: ordering,
      page: page - 1,
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
    const formateState = (type_name, items) => {
      return items.map(item => ({ type_name, name: item, value: item }));
    };

    const tags = [ "3D", "Ahegao", "Anal", "Animation", "BDSM", "Big Tits", "Cosplay", "Creampie", "Dark Skin", "Elf", "Futanari", "Gender Bender", "Handjob", "Harem", "Incest", "Inflation", "Loli", "Maid", "Milf", "Mind Break", "Mind Control", "Monster", "NTR", "Nakadashi", "No Penetration", "Oppai", "POV", "Pregnant", "Rape", "Reverse Rape", "Rimjob", "Schoolgirl", "Shota", "Stockings", "Succubus", "Tentacles", "Threesome", "Toy", "Trap", "Tsundere", "Ugly Bastard", "Vanilla", "X-Ray", "Yaoi", "Yuri" ];
    const brands = [ "37c-Binetsu", "Anime-Koubou-Ram", "Antechinus", "BOMB! CUTE! BOMB!", "Bootleg", "BreakBottle", "Bunnywalker", "Digital-Works", "EDGE", "First-Star", "Front-Line", "G-Collections", "Garden", "General-Entertainment", "Gold-Bear", "Himajin", "Hooligan", "Horipro", "Hot-Bear", "Jumondo", "Majin", "Media-Bank", "Moon-Night-Lady", "Mu", "Natural-High", "Nihikime-no-dozeu", "nur", "Pashmina", "Poro", "Sesso-Esotico", "Shouten", "Studio-1", "Studio-Deen", "Suzuki-Mirano", "Toratepotto", "Union-Chooser", "White-Bear", "ZIZ", "Zyc" ];
    const sortables = ["Uploads", "Views", "Likes", "Release", "Alphabetical"];

    return [
      {
        type_name: "GroupFilter",
        name: "Tags",
        state: formateState("CheckBox", tags),
      },
      {
        type_name: "GroupFilter",
        name: "Brands",
        state: formateState("CheckBox", brands),
      },
      {
        type_name: "SortFilter",
        name: "Sort by",
        state: { index: 2, ascending: false },
        values: sortables
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
          summary: "Select the quality to prioritize",
          valueIndex: 0,
          entries: ["1080p", "720p", "480p", "360p"],
          entryValues: ["1080", "720", "480", "360"],
        },
      },
    ];
  }
}
