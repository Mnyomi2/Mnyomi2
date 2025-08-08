const mangayomiSources = [
  {
    "name": "Animeblkom",
    "id": 958063683,
    "baseUrl": "https://animeblkom.net",
    "lang": "ar",
    "typeSource": "single",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=animeblkom.net",
    "itemType": 1,
    "version": "1.5.2",
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
    return this.getPreference("animeblkom_base_url") ?? "https://animeblkom.net";
  }

  getHeaders() {
    return { "Referer": this.getBaseUrl() };
  }

  async requestDoc(url) {
    const res = await this.client.get(url, this.getHeaders());
    return new Document(res.body);
  }

  async getPopular(page) {
    const url = `${this.getBaseUrl()}/animes-list?sort_by=rate&page=${page}`;
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
    const url = `${this.getBaseUrl()}/animes-list?sort_by=created_at&page=${page}`;
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
    const endpoint = query ? `/search?query=${encodeURIComponent(query)}` : '/animes-list';
    let url = this.getBaseUrl() + endpoint;
    const params = [];
    params.push(`page=${page}`);

    if (filters && filters.length > 0) {
        function getSelectValue(filter) { return filter.values[filter.state].value; }
        function getGroupValues(filter) { return filter.state.filter(item => item.state).map(item => item.value); }

        const sortBy = getSelectValue(filters[0]);
        const sortDir = getSelectValue(filters[1]);
        const statuses = getGroupValues(filters[2]);
        const genres = getGroupValues(filters[3]);
        const studios = getGroupValues(filters[4]);
        const ageRange = getSelectValue(filters[5]);
        const ratingRange = getSelectValue(filters[6]);
        const yearRange = getSelectValue(filters[7]);
        const episodesRange = getSelectValue(filters[8]);
        
        if (sortBy) params.push(`sort_by=${sortBy}`);
        if (sortDir) params.push(`sort_dir=${sortDir}`);
        
        if (statuses.length > 0) params.push(`status=${statuses.join('_')}`);
        if (genres.length > 0) params.push(`genres=${genres.join('_')}`);
        if (studios.length > 0) params.push(`studios=${studios.join('_')}`);

        if (ageRange) params.push(`age=${ageRange}`);
        if (ratingRange) params.push(`rate=${ratingRange}`);
        if (yearRange) params.push(`year=${yearRange}`);
        if (episodesRange) params.push(`videos_count=${episodesRange}`);
    }
    
    if (params.length > 0) {
        url += (url.includes('?') ? '&' : '?') + params.join('&');
    }
    
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
        return { "مستمر": 0, "منتهي": 1, "لم يعرض بعد": 4 }[status] ?? 5;
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
    doc.select(".info-table > div").forEach(row => {
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
    doc.select("div.direct-download a[target='_blank']").forEach(link => {
        const videoUrl = link.getHref;
        const quality = link.text.trim();
        if (videoUrl) {
            videos.push({ url: videoUrl, originalUrl: videoUrl, quality: quality, headers: { "Referer": url } });
        }
    });
    if (videos.length === 0) { throw new Error("No direct download links found."); }
    const preferredQuality = this.getPreference("animeblkom_preferred_quality");
    return videos.sort((a, b) => {
        const aIsPreferred = a.quality.includes(preferredQuality);
        const bIsPreferred = b.quality.includes(preferredQuality);
        if (aIsPreferred && !bIsPreferred) return -1;
        if (!aIsPreferred && bIsPreferred) return 1;
        const aQualityNum = parseInt(a.quality);
        const bQualityNum = parseInt(b.quality);
        return bQualityNum - aQualityNum;
    });
  }
  
  getFilterList() {
    function f(n, v) { return { type_name: "SelectOption", name: n, value: v }; }
    function g(n, v) { return { type_name: "CheckBox", name: n, value: v }; }

    const ageMap = { "الكل": "G", "الاطفال": "PG", "+13": "PG-13", "+17": "R", "+18": "R+" };
    const ageLabels = Object.keys(ageMap);
    
    function createRanges(labels, map = null) {
        const ranges = [f("الكل", "")];
        for (let i = 0; i < labels.length; i++) {
            for (let j = i + 1; j < labels.length; j++) {
                const startLabel = labels[i];
                const endLabel = labels[j];
                const startValue = map ? map[startLabel] : startLabel;
                const endValue = map ? map[endLabel] : endLabel;
                ranges.push(f(`${startLabel} - ${endLabel}`, `${startValue}-${endValue}`));
            }
        }
        return ranges;
    }

    return [
        { type_name: "SelectFilter", name: "الترتيب حسب", state: 0, values: [ f("آخر الإضافات", "created_at"), f("التقييم", "rate"), f("الاسم", "name"), f("تاريخ الانتاج", "released_at") ] },
        { type_name: "SelectFilter", name: "اتجاه الترتيب", state: 0, values: [ f("تنازلي", "desc"), f("تصاعدي", "asc") ] },
        { type_name: "GroupFilter", name: "الحالة", state: [ g("مكتمل", "finished"), g("مستمر", "running"), g("قادم", "upcomming") ] },
        { type_name: "GroupFilter", name: "التصنيفات", state: [
            g("أكشن", "action"), g("مغامرة", "adventure"), g("سيارات", "cars"), g("كوميدي", "comedy"), g("جنون", "dementia"), g("شياطين", "demons"),
            g("دراما", "drama"), g("إيتشي", "ecchi"), g("خيال", "fantasy"), g("لعبة", "game"), g("حريم", "harem"), g("هينتاي", "hentai"),
            g("تاريخي", "historical"), g("رعب", "horror"), g("جوسي", "josei"), g("أطفال", "kids"), g("سحر", "magic"), g("فنون عسكرية", "martial-arts"),
            g("ميكا", "mecha"), g("عسكري", "military"), g("موسيقى", "music"), g("غموض", "mystery"), g("ساخر", "parody"), g("بوليسي", "police"),
            g("نفسي", "psychological"), g("رومانسي", "romance"), g("ساموراي", "samurai"), g("مدرسي", "school"), g("خيال علمي", "sci-fi"),
            g("سينين", "seinen"), g("شوجو", "shoujo"), g("شوجو آي", "shoujo-ai"), g("شونين", "shounen"), g("شونين آي", "shounen-ai"),
            g("شريحة من الحياة", "slice-of-life"), g("فضاء", "space"), g("رياضي", "sports"), g("قوى خارقة", "super-power"),
            g("خارق للطبيعة", "supernatural"), g("إثارة", "thriller"), g("مصاصي دماء", "vampire")
        ]},
        { type_name: "GroupFilter", name: "الاستديو", state: [
            g("8bit", "8bit"), g("A-1 Pictures", "a-1-pictures"), g("A.C.G.T.", "acgt"), g("AIC", "aic"), g("APPP", "appp"), g("AXsiZ", "axsiz"),
            g("Actas", "actas"), g("Ajia-Do", "ajia-do"), g("Arms", "arms"), g("Artland", "artland"), g("Arvo Animation", "arvo-animation"),
            g("Asahi Production", "asahi-production"), g("Asread", "asread"), g("Atelier Pontdarc", "atelier-pontdarc"), g("BUG FILMS", "bug-films"),
            g("Bakken Record", "bakken-record"), g("Bandai Namco Pictures", "bandai-namco-pictures"), g("Bibury Animation Studios", "bibury-animation-studios"),
            g("Bones", "bones"), g("Brain's Base", "brains-base"), g("Bridge", "bridge"), g("C-Station", "c-station"), g("C2C", "c2c"),
            g("CloverWorks", "cloverworks"), g("CoMix Wave Films", "comix-wave-films"), g("Connect", "connect"), g("Creators in Pack", "creators-in-pack"),
            g("CygamesPictures", "cygamespictures"), g("DLE", "dle"), g("David Production", "david-production"), g("Diomedea", "diomedea"),
            g("Doga Kobo", "doga-kobo"), g("Drive", "drive"), g("EMT Squared", "emt-squared"), g("ENGI", "engi"), g("Encourage Films", "encourage-films"),
            g("EzÏŒla", "ezila"), g("Felix Film", "felix-film"), g("GEEK TOYS", "geek-toys"), g("Gainax", "gainax"), g("Gallop", "gallop"),
            g("GoHands", "gohands"), g("Gonzo", "gonzo"), g("Graphinica", "graphinica"), g("Hoods Entertainment", "hoods-entertainment"),
            g("J.C.Staff", "jcstaff"), g("Kinema Citrus", "kinema-citrus"), g("Kyoto Animation", "kyoto-animation"), g("LIDENFILMS", "lidenfilms"),
            g("Lapin Track", "lapin-track"), g("Lay-duce", "lay-duce"), g("Lerche", "lerche"), g("MAPPA", "mappa"), g("Madhouse", "madhouse"),
            g("Maho Film", "maho-film"), g("Millepensee", "millepensee"), g("NAZ", "naz"), g("NUT", "nut"), g("Nexus", "nexus"), g("Nomad", "nomad"),
            g("OLM", "olm"), g("Okuruto Noboru", "okuruto-noboru"), g("Orange", "orange"), g("P.A. Works", "pa-works"), g("Passione", "passione"),
            g("Pierrot", "pierrot"), g("Pine Jam", "pine-jam"), g("Platinum Vision", "platinum-vision"), g("Polygon Pictures", "polygon-pictures"),
            g("Production I.G", "production-ig"), g("Production Reed", "production-reed"), g("Project No.9", "project-no9"), g("Quad", "quad"),
            g("Revoroot", "revoroot"), g("SILVER LINK.", "silver-link-mku"), g("Satelight", "satelight"), g("Science SARU", "science-saru"),
            g("Seven Arcs", "seven-arcs"), g("Shaft", "shaft"), g("Signal.MD", "signalmd"), g("Silver Link.", "silver-link"), g("Sola Digital Arts", "sola-digital-arts"),
            g("Studio 3Hz", "studio-3hz"), g("Studio 4°C", "studio-4c"), g("Studio Bind", "studio-bind"), g("Studio Comet", "studio-comet"),
            g("Studio Deen", "studio-deen"), g("Studio Ghibli", "studio-ghibli"), g("Studio Gokumi", "studio-gokumi"), g("Studio Kai", "studio-kai"),
            g("Studio MOTHER", "studio-mother"), g("Studio Pierrot", "studio-pierrot"), g("Studio VOLN", "studio-voln"), g("Sunrise", "sunrise"),
            g("SynergySP", "synergysp"), g("TMS Entertainment", "tms-entertainment"), g("TNK", "tnk"), g("TROYCA", "troyca"), g("Tatsunoko Production", "tatsunoko-production"),
            g("Telecom Animation Film", "telecom-animation-film"), g("Tezuka Productions", "tezuka-productions"), g("Toei Animation", "toei-animation"),
            g("Trigger", "trigger"), g("Typhoon Graphics", "typhoon-graphics"), g("ufotable", "ufotable"), g("White Fox", "white-fox"),
            g("Wit Studio", "wit-studio"), g("Wolfsbane", "wolfsbane"), g("Xebec", "xebec"), g("Yokohama Animation Lab", "yokohama-animation-lab"),
            g("Yumeta Company", "yumeta-company"), g("Zero-G", "zero-g"), g("Zexcs", "zexcs"), g("feel.", "feel")
        ]},
        { type_name: "SelectFilter", name: "التصنيف العمري", state: 0, values: createRanges(ageLabels, ageMap) },
        { type_name: "SelectFilter", name: "التقييم", state: 0, values: createRanges(["1", "3", "6", "8", "10"]) },
        { type_name: "SelectFilter", name: "سنة الانتاج", state: 0, values: createRanges(["1950", "1969", "1988", "2006", "2025"]) },
        { type_name: "SelectFilter", name: "عدد الحلقات", state: 0, values: createRanges(["1", "251", "501", "750", "1000"]) },
    ];
  }
  
  getSourcePreferences() {
      return [
          {
              key: "animeblkom_base_url",
              editTextPreference: { title: "Override Base URL", summary: "For temporary changes.", defaultValue: "https://animeblkom.net", dialogTitle: "Override Base URL", dialogMessage: "Default: https://animeblkom.net" }
          },
          {
              key: "animeblkom_preferred_quality",
              listPreference: { title: "Preferred Video Quality", summary: "Select your preferred quality. It will be prioritized.", valueIndex: 0, entries: ["1080p", "720p", "480p", "360p"], entryValues: ["1080p", "720p", "480p", "360p"] }
          }
      ];
  }
}


