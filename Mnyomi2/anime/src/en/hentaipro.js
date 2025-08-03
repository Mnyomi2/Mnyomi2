const mangayomiSources = [{
    "name": "HentaiPro",
    "id": 7531902468,
    "lang": "en",
    "baseUrl": "https://hentai.pro",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://hentai.pro",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.4.1",
    "pkgPath": "anime/src/en/hentaipro.js"
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

    getBaseUrl() {
        return this.getPreference("override_base_url") || this.source.baseUrl;
    }

    getHeaders(url) {
        return {
            "Referer": this.getBaseUrl(),
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        };
    }

    decodeBase64(f) {
        var g = {}, b = 65, d = 0, a, c = 0, h, e = "", k = String.fromCharCode, l = f.length;
        for (a = ""; 91 > b;) a += k(b++);
        a += a.toLowerCase() + "0123456789+/";
        for (b = 0; 64 > b; b++) g[a.charAt(b)] = b;
        for (a = 0; a < l; a++)
            for (b = g[f.charAt(a)], d = (d << 6) + b, c += 6; 8 <= c;)((h = (d >>> (c -= 8)) & 255) || a < l - 2) && (e += k(h));
        return e;
    }

    // MODIFIED helper function to handle different page structures.
    async _parsePage(url, isFilterPage = false) {
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        const list = [];

        // Choose the correct selector based on whether it's a filter page or not.
        const itemSelector = isFilterPage
            ? "section#wdgt_home_post-3 div.thumb.article-post"
            : "div.thumb.article-post";

        const thumbs = doc.select(itemSelector);

        for (const thumb of thumbs) {
            const name = thumb.selectFirst("div.thumb__title")?.text.trim() || "";
            const poster = thumb.selectFirst("div.thumb__img > img")?.attr("src");
            const link = thumb.selectFirst("a")?.attr("href") || "";
            if (name && link) list.push({ name: name, imageUrl: poster || "", link: link });
        }
        const hasNextPage = doc.selectFirst("div.pagination a.next") != null;
        return { list, hasNextPage };
    }

    async getPopular(page) {
        const popularSection = this.getPreference("popular_section_content") || "popular-animes";
        const url = `${this.getBaseUrl()}/${popularSection}/page/${page}`;
        // This is not a filter page, so we don't pass any extra argument.
        return await this._parsePage(url);
    }

    async getLatestUpdates(page) {
        const url = `${this.getBaseUrl()}/latest-animes/page/${page}`;
        // This is not a filter page.
        return await this._parsePage(url);
    }

    async search(query, page, filters) {
        if (query) {
            const url = page > 1 ?
                `${this.getBaseUrl()}/page/${page}/?s=${encodeURIComponent(query)}` :
                `${this.getBaseUrl()}/?s=${encodeURIComponent(query)}`;
            // Pass `false` for text search, as it uses the general selector.
            return await this._parsePage(url, false);
        }

        if (filters && filters.length > 0) {
            const selectedTag = filters[0].values[filters[0].state].value;
            if (selectedTag) {
                const url = `${this.getBaseUrl()}/videotag/${selectedTag}/page/${page}/`;
                // Pass `true` for filter search, as it uses the specific selector.
                return await this._parsePage(url, true);
            }
        }

        return { list: [], hasNextPage: false };
    }

    async getDetail(url) {
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);

        let background = doc.selectFirst("div.backdrop")
            ?.attr("style")
            ?.match(/url\(['"]?(.+?)['"]?\)/)?.[1];

        if (!background) {
            background = doc.selectFirst("meta[property=og:image]")?.attr("content")?.trim();
        }

        if (!background) {
            const scripts = doc.select('script[type="application/ld+json"]');
            for (const script of scripts) {
                try {
                    const json = JSON.parse(script.text);
                    if (json['@type'] === 'VideoObject' && json.thumbnailUrl) {
                        background = json.thumbnailUrl;
                        break;
                    }
                } catch (e) {}
            }
        }
        
        const description = doc.select("div.entry-content > p")
            .map(p => p.text.trim())
            .join("\n\n") || "";
            
        const name = doc.selectFirst("div.headline > h1")?.text || "";

        const genre = [];
        const genreElements = doc.select("div.video-page__categories a");
        for (const tag of genreElements) {
            const genreName = tag.text?.trim();
            if (genreName) genre.push(genreName);
        }
        const uniqueGenre = [...new Set(genre)];

        const chapters = [{
            name: name || "Episode",
            url: url,
            dateUpload: "",
            scanlator: ""
        }];

        return {
            name: name,
            imageUrl: background || "",
            description: description,
            link: url,
            status: 5,
            genre: uniqueGenre.length > 0 ? uniqueGenre : ["Adult", "Hentai"],
            chapters: chapters
        };
    }

    async getVideoList(url) {
        const res = await this.client.get(url, this.getHeaders(url));
        const doc = new Document(res.body);
        const videos = [];
        try {
            const iframe = doc.selectFirst("div.videoplayer-container > iframe")?.attr("src") || "";
            if (!iframe) return videos;

            const iframeRes = await this.client.get(iframe, this.getHeaders(iframe));
            const iframeDoc = new Document(iframeRes.body);
            const playerId = iframeDoc.selectFirst("div.servers li")?.attr("data-id") || "";
            if (!playerId) return videos;

            const playerUrl = `https://nhplayer.com/${playerId}`;
            const playerRes = await this.client.get(playerUrl, this.getHeaders(playerUrl));
            const playerBody = playerRes.body;

            const videoMatch = playerBody.match(/file:\s*["']([^"']+)["']/);
            const videoUrl = videoMatch ? videoMatch[1] : "";

            let subtitleUrl = "";

            const subtitleMatch1 = playerBody.match(/"file":\s*"([^"]+\.vtt[^"]*)"/);
            if (subtitleMatch1 && subtitleMatch1[1]) {
                subtitleUrl = subtitleMatch1[1];
            } else {
                const subtitleMatch2 = playerId.match(/s=([^&]+)/);
                if (subtitleMatch2 && subtitleMatch2[1]) {
                    try {
                        subtitleUrl = this.decodeBase64(subtitleMatch2[1]);
                    } catch (e) {
                        console.error("Failed to decode subtitle URL from data-id:", e);
                    }
                }
            }

            if (videoUrl) {
                const video = {
                    url: videoUrl,
                    originalUrl: videoUrl,
                    quality: "Default",
                    headers: { "Referer": "https://nhplayer.com/" }
                };

                if (this.getPreference("enable_subtitles") && subtitleUrl) {
                    video.subtitles = [{ file: subtitleUrl, label: "English" }];
                }
                videos.push(video);
            }
        } catch (e) {
            console.error("Error extracting video for HentaiPro:", e);
        }
        return videos;
    }

    getFilterList() {
        const tags = [
            { "name": "2024", "value": "2024" },
            { "name": "3P", "value": "3p" },
            { "name": "Action", "value": "action" },
            { "name": "Adventure", "value": "adventure" },
            { "name": "Age Difference Romance", "value": "age-difference-romance" },
            { "name": "Ahegao", "value": "ahegao" },
            { "name": "Alcohol", "value": "alcohol" },
            { "name": "Aliens", "value": "aliens" },
            { "name": "All-Girls School", "value": "all-girls-school" },
            { "name": "Alternative Past", "value": "alternative-past" },
            { "name": "Anal", "value": "anal" },
            { "name": "Anal Fingering", "value": "anal-fingering" },
            { "name": "Anal Pissing", "value": "anal-pissing" },
            { "name": "Androids", "value": "androids" },
            { "name": "Angels", "value": "angels" },
            { "name": "Angst", "value": "angst" },
            { "name": "Anthropomorphism", "value": "anthropomorphism" },
            { "name": "Archery", "value": "archery" },
            { "name": "Art", "value": "art" },
            { "name": "Asia", "value": "asia" },
            { "name": "Assjob", "value": "assjob" },
            { "name": "Aunt-Nephew Incest", "value": "aunt-nephew-incest" },
            { "name": "Autofellatio", "value": "autofellatio" },
            { "name": "Bakumatsu - Meiji Era", "value": "bakumatsu-meiji-era" },
            { "name": "Bakunyuu", "value": "bakunyuu" },
            { "name": "Band", "value": "band" },
            { "name": "Baseball", "value": "baseball" },
            { "name": "BDSM", "value": "bdsm" },
            { "name": "Bestiality", "value": "bestiality" },
            { "name": "big boobs", "value": "big-boobs" },
            { "name": "Big Breasts", "value": "big-breasts" },
            { "name": "Big Dick", "value": "big-dick" },
            { "name": "Big tits", "value": "big-tits" },
            { "name": "Bikini", "value": "bikini" },
            { "name": "Bishoujo", "value": "bishoujo" },
            { "name": "Blackmail", "value": "blackmail" },
            { "name": "Blow Job", "value": "blow-job" },
            { "name": "Blowjob", "value": "blowjob" },
            { "name": "Body and Host", "value": "body-and-host" },
            { "name": "Body Takeover", "value": "body-takeover" },
            { "name": "Boing", "value": "boing" },
            { "name": "Bondage", "value": "bondage" },
            { "name": "Boob Job", "value": "boob-job" },
            { "name": "Boobs in your Face", "value": "boobs-in-your-face" },
            { "name": "Boy Meets Girl", "value": "boy-meets-girl" },
            { "name": "Brainwashing", "value": "brainwashing" },
            { "name": "Breast Expansion", "value": "breast-expansion" },
            { "name": "Breast Fondling", "value": "breast-fondling" },
            { "name": "Breasts", "value": "breasts" },
            { "name": "Brother-Sister Incest", "value": "brother-sister-incest" },
            { "name": "Bukkake", "value": "bukkake" },
            { "name": "Bullying", "value": "bullying" },
            { "name": "Busty", "value": "busty" },
            { "name": "Catgirls", "value": "catgirls" },
            { "name": "Catholic School", "value": "catholic-school" },
            { "name": "Censored", "value": "censored" },
            { "name": "Censored Hentai", "value": "censored-hentai" },
            { "name": "Cervix Penetration", "value": "cervix-penetration" },
            { "name": "Chikan", "value": "chikan" },
            { "name": "Christmas", "value": "christmas" },
            { "name": "Clone", "value": "clone" },
            { "name": "Clubs", "value": "clubs" },
            { "name": "College", "value": "college" },
            { "name": "Combat", "value": "combat" },
            { "name": "Comedy", "value": "comedy" },
            { "name": "Coming of Age", "value": "coming-of-age" },
            { "name": "Confession", "value": "confession" },
            { "name": "Contemporary Fantasy", "value": "contemporary-fantasy" },
            { "name": "Cops", "value": "cops" },
            { "name": "Cosplay", "value": "cosplay" },
            { "name": "Cosplaying", "value": "cosplaying" },
            { "name": "Cream Pie", "value": "cream-pie" },
            { "name": "creampie", "value": "creampie" },
            { "name": "Cross-Dressing", "value": "cross-dressing" },
            { "name": "Cum Play", "value": "cum-play" },
            { "name": "Cum Swapping", "value": "cum-swapping" },
            { "name": "Cunnilingus", "value": "cunnilingus" },
            { "name": "Cybersex", "value": "cybersex" },
            { "name": "Cyborg", "value": "cyborg" },
            { "name": "Cyborgs", "value": "cyborgs" },
            { "name": "Daily Life", "value": "daily-life" },
            { "name": "Dark Elf", "value": "dark-elf" },
            { "name": "Dark Fantasy", "value": "dark-fantasy" },
            { "name": "Dark Skin", "value": "dark-skin" },
            { "name": "Dark-Skinned Girl", "value": "dark-skinned-girl" },
            { "name": "Dating Sim - Visual ...", "value": "dating-sim-visual" },
            { "name": "Death", "value": "death" },
            { "name": "Deflowering", "value": "deflowering" },
            { "name": "Delinquent", "value": "delinquent" },
            { "name": "Demon", "value": "demon" },
            { "name": "Demons", "value": "demons" },
            { "name": "Desert", "value": "desert" },
            { "name": "Detective", "value": "detective" },
            { "name": "Dildos", "value": "dildos" },
            { "name": "Dildos - Vibrators", "value": "dildos-vibrators" },
            { "name": "Doggy Style", "value": "doggy-style" },
            { "name": "Doggy Syle", "value": "doggy-syle" },
            { "name": "Dominatrix", "value": "dominatrix" },
            { "name": "Double Fellatio", "value": "double-fellatio" },
            { "name": "Double Penetration", "value": "double-penetration" },
            { "name": "Double-Sided Dildo", "value": "double-sided-dildo" },
            { "name": "Dragons", "value": "dragons" },
            { "name": "Drugs", "value": "drugs" },
            { "name": "Dubbed Hentai", "value": "dubbed-hentai" },
            { "name": "Dungeon", "value": "dungeon" },
            { "name": "Dystopia", "value": "dystopia" },
            { "name": "Ecchi", "value": "ecchi" },
            { "name": "Ecchi Anime", "value": "ecchi-anime" },
            { "name": "Elf", "value": "elf" },
            { "name": "Elves", "value": "elves" },
            { "name": "Enema", "value": "enema" },
            { "name": "English Dubbed", "value": "english-dubbed" },
            { "name": "Enjo-Kousai", "value": "enjo-kousai" },
            { "name": "Enjoyable Rape", "value": "enjoyable-rape" },
            { "name": "Erotic Asphyxiation", "value": "erotic-asphyxiation" },
            { "name": "Erotic Game", "value": "erotic-game" },
            { "name": "Erotic Torture", "value": "erotic-torture" },
            { "name": "Everybody Has Sex", "value": "everybody-has-sex" },
            { "name": "Exhibitionism", "value": "exhibitionism" },
            { "name": "Exorcism", "value": "exorcism" },
            { "name": "Facesitting", "value": "facesitting" },
            { "name": "Facial", "value": "facial" },
            { "name": "Fantasy", "value": "fantasy" },
            { "name": "Fantasy World", "value": "fantasy-world" },
            { "name": "Father-Daughter Incest", "value": "father-daughter-incest" },
            { "name": "Felching", "value": "felching" },
            { "name": "Fellatio", "value": "fellatio" },
            { "name": "Female Rapes Female", "value": "female-rapes-female" },
            { "name": "Female Student", "value": "female-student" },
            { "name": "Female Students", "value": "female-students" },
            { "name": "Female Teacher", "value": "female-teacher" },
            { "name": "Female Teachers", "value": "female-teachers" },
            { "name": "Femdom", "value": "femdom" },
            { "name": "FFM Threesome", "value": "ffm-threesome" },
            { "name": "Fictional World", "value": "fictional-world" },
            { "name": "Filmed", "value": "filmed" },
            { "name": "Fingering", "value": "fingering" },
            { "name": "First Kiss.", "value": "first-kiss" },
            { "name": "First Love", "value": "first-love" },
            { "name": "Fisting", "value": "fisting" },
            { "name": "Foot Fetish", "value": "foot-fetish" },
            { "name": "Footjob", "value": "footjob" },
            { "name": "Forbidden Love", "value": "forbidden-love" },
            { "name": "Foursome", "value": "foursome" },
            { "name": "French Kiss", "value": "french-kiss" },
            { "name": "Funny Expressions", "value": "funny-expressions" },
            { "name": "Futa x Female", "value": "futa-x-female" },
            { "name": "Futa x Futa", "value": "futa-x-futa" },
            { "name": "Futa x Male", "value": "futa-x-male" },
            { "name": "Futanari", "value": "futanari" },
            { "name": "Future", "value": "future" },
            { "name": "Game", "value": "game" },
            { "name": "Gang Bang", "value": "gang-bang" },
            { "name": "Gang Rape", "value": "gang-rape" },
            { "name": "Gangbang", "value": "gangbang" },
            { "name": "Gay Hentai", "value": "gay-hentai" },
            { "name": "Gender Bender", "value": "gender-bender" },
            { "name": "Genetic Modification", "value": "genetic-modification" },
            { "name": "Ghost", "value": "ghost" },
            { "name": "Gigantic Breasts", "value": "gigantic-breasts" },
            { "name": "Girl Rapes Girl", "value": "girl-rapes-girl" },
            { "name": "Glasses", "value": "glasses" },
            { "name": "Glory Hole", "value": "glory-hole" },
            { "name": "Goblin", "value": "goblin" },
            { "name": "Goddesses", "value": "goddesses" },
            { "name": "Gokkun", "value": "gokkun" },
            { "name": "Golden Shower", "value": "golden-shower" },
            { "name": "Gore", "value": "gore" },
            { "name": "Groping", "value": "groping" },
            { "name": "Group Sex", "value": "group-sex" },
            { "name": "Gunfights", "value": "gunfights" },
            { "name": "Guy Getting Raped", "value": "guy-getting-raped" },
            { "name": "Gyaru", "value": "gyaru" },
            { "name": "Gymnastics", "value": "gymnastics" },
            { "name": "Hand Job", "value": "hand-job" },
            { "name": "Handjob", "value": "handjob" },
            { "name": "Harem", "value": "harem" },
            { "name": "HD", "value": "hd" },
            { "name": "Hell", "value": "hell" },
            { "name": "Henshin", "value": "henshin" },
            { "name": "Hidden Vibrator", "value": "hidden-vibrator" },
            { "name": "High Fantasy", "value": "high-fantasy" },
            { "name": "High School", "value": "high-school" },
            { "name": "Historical", "value": "historical" },
            { "name": "Horny Nosebleed", "value": "horny-nosebleed" },
            { "name": "Horror", "value": "horror" },
            { "name": "Hospital", "value": "hospital" },
            { "name": "Housewives", "value": "housewives" },
            { "name": "Huge Breasts", "value": "huge-breasts" },
            { "name": "Human Enhancement", "value": "human-enhancement" },
            { "name": "Human Sacrifice", "value": "human-sacrifice" },
            { "name": "Humanoid", "value": "humanoid" },
            { "name": "Idol", "value": "idol" },
            { "name": "Impregnation", "value": "impregnation" },
            { "name": "Incest", "value": "incest" },
            { "name": "Infidelity", "value": "infidelity" },
            { "name": "Internal Shots", "value": "internal-shots" },
            { "name": "Jealousy", "value": "jealousy" },
            { "name": "JK", "value": "jk" },
            { "name": "Josei", "value": "josei" },
            { "name": "Juujin", "value": "juujin" },
            { "name": "Lactation", "value": "lactation" },
            { "name": "Large Breasts", "value": "large-breasts" },
            { "name": "Law and Order", "value": "law-and-order" },
            { "name": "Licking", "value": "licking" },
            { "name": "Lingerie", "value": "lingerie" },
            { "name": "Loli", "value": "loli" },
            { "name": "Lolicon", "value": "lolicon" },
            { "name": "Love Polygon", "value": "love-polygon" },
            { "name": "Lrge Breasts", "value": "lrge-breasts" },
            { "name": "Mafia", "value": "mafia" },
            { "name": "Magic", "value": "magic" },
            { "name": "Magic Circles", "value": "magic-circles" },
            { "name": "Magic Weapons", "value": "magic-weapons" },
            { "name": "Magical Girl", "value": "magical-girl" },
            { "name": "Mahou Shoujo", "value": "mahou-shoujo" },
            { "name": "Maid", "value": "maid" },
            { "name": "Maids", "value": "maids" },
            { "name": "Male Rape Victim", "value": "male-rape-victim" },
            { "name": "Mammary Intercourse", "value": "mammary-intercourse" },
            { "name": "Manga", "value": "manga" },
            { "name": "Married", "value": "married" },
            { "name": "Martial Arts", "value": "martial-arts" },
            { "name": "Master-Servant Relat...", "value": "master-servant-relat" },
            { "name": "Master-Slave Relation", "value": "master-slave-relation" },
            { "name": "Masturbation", "value": "masturbation" },
            { "name": "Mature", "value": "mature" },
            { "name": "Mecha", "value": "mecha" },
            { "name": "Mechanical Tentacle", "value": "mechanical-tentacle" },
            { "name": "Mechanical Tentacles", "value": "mechanical-tentacles" },
            { "name": "Mermaid", "value": "mermaid" },
            { "name": "Middle School", "value": "middle-school" },
            { "name": "milf", "value": "milf" },
            { "name": "Military", "value": "military" },
            { "name": "Mind Control", "value": "mind-control" },
            { "name": "MMF Threesome", "value": "mmf-threesome" },
            { "name": "Molestation", "value": "molestation" },
            { "name": "Monster", "value": "monster" },
            { "name": "Mother-Daughter Incest", "value": "mother-daughter-incest" },
            { "name": "Mother-Son Incest", "value": "mother-son-incest" },
            { "name": "Multiple Couples", "value": "multiple-couples" },
            { "name": "Murder", "value": "murder" },
            { "name": "Music", "value": "music" },
            { "name": "Mutilation", "value": "mutilation" },
            { "name": "Naked Apron", "value": "naked-apron" },
            { "name": "Netorare", "value": "netorare" },
            { "name": "Netori", "value": "netori" },
            { "name": "Ninja", "value": "ninja" },
            { "name": "Ninjas", "value": "ninjas" },
            { "name": "Nipple Penetration", "value": "nipple-penetration" },
            { "name": "Nostril Hook", "value": "nostril-hook" },
            { "name": "Novel", "value": "novel" },
            { "name": "NTR", "value": "ntr" },
            { "name": "Nudity", "value": "nudity" },
            { "name": "Nun", "value": "nun" },
            { "name": "Nuns", "value": "nuns" },
            { "name": "Nurse", "value": "nurse" },
            { "name": "Nurses", "value": "nurses" },
            { "name": "Nyotaimori", "value": "nyotaimori" },
            { "name": "Office Lady", "value": "office-lady" },
            { "name": "Onahole", "value": "onahole" },
            { "name": "Oral", "value": "oral" },
            { "name": "Oral sex", "value": "oral-sex" },
            { "name": "Orgy", "value": "orgy" },
            { "name": "Other Planet", "value": "other-planet" },
            { "name": "Outdoor Sex", "value": "outdoor-sex" },
            { "name": "Oyakodon", "value": "oyakodon" },
            { "name": "Paizuri", "value": "paizuri" },
            { "name": "Pantsu", "value": "pantsu" },
            { "name": "Pantyjob", "value": "pantyjob" },
            { "name": "Paper Clothes", "value": "paper-clothes" },
            { "name": "Parallel Universe", "value": "parallel-universe" },
            { "name": "Parasites", "value": "parasites" },
            { "name": "Parody", "value": "parody" },
            { "name": "Pegging", "value": "pegging" },
            { "name": "Pillory", "value": "pillory" },
            { "name": "Plot", "value": "plot" },
            { "name": "Plot With Porn", "value": "plot-with-porn" },
            { "name": "Point of View", "value": "point-of-view" },
            { "name": "Pornography", "value": "pornography" },
            { "name": "Post-apocalyptic", "value": "post-apocalyptic" },
            { "name": "POV", "value": "pov" },
            { "name": "Predominantly Female...", "value": "predominantly-female" },
            { "name": "Pregnant", "value": "pregnant" },
            { "name": "Pregnant Sex", "value": "pregnant-sex" },
            { "name": "Princess", "value": "princess" },
            { "name": "Prostate Massage", "value": "prostate-massage" },
            { "name": "Prostitution", "value": "prostitution" },
            { "name": "Proxy Battles", "value": "proxy-battles" },
            { "name": "Psychological Sexual...", "value": "psychological-sexual" },
            { "name": "Public Sex", "value": "public-sex" },
            { "name": "Pussy in your Face", "value": "pussy-in-your-face" },
            { "name": "Pussy Sandwich", "value": "pussy-sandwich" },
            { "name": "Rape", "value": "rape" },
            { "name": "Revenge", "value": "revenge" },
            { "name": "rimjob", "value": "rimjob" },
            { "name": "Rimming", "value": "rimming" },
            { "name": "Romance", "value": "romance" },
            { "name": "RPG", "value": "rpg" },
            { "name": "Safer Sex", "value": "safer-sex" },
            { "name": "Samurai", "value": "samurai" },
            { "name": "Scat", "value": "scat" },
            { "name": "School", "value": "school" },
            { "name": "School Clubs", "value": "school-clubs" },
            { "name": "school girl", "value": "school-girl" },
            { "name": "School Life", "value": "school-life" },
            { "name": "School Swimsuit", "value": "school-swimsuit" },
            { "name": "Sci-Fi", "value": "sci-fi" },
            { "name": "Science Fiction", "value": "science-fiction" },
            { "name": "Scissoring", "value": "scissoring" },
            { "name": "Seinen", "value": "seinen" },
            { "name": "Sex", "value": "sex" },
            { "name": "Sex Change", "value": "sex-change" },
            { "name": "Sex Tape", "value": "sex-tape" },
            { "name": "Sex Toys", "value": "sex-toys" },
            { "name": "Sex While on the Phone", "value": "sex-while-on-the-phone" },
            { "name": "Sexual Abuse", "value": "sexual-abuse" },
            { "name": "Sexual Fantasies", "value": "sexual-fantasies" },
            { "name": "Sexually Dominant", "value": "sexually-dominant" },
            { "name": "Shibari", "value": "shibari" },
            { "name": "Shipboard", "value": "shipboard" },
            { "name": "Shool Life", "value": "shool-life" },
            { "name": "Short", "value": "short" },
            { "name": "Short Episodes", "value": "short-episodes" },
            { "name": "short hair", "value": "short-hair" },
            { "name": "Shota", "value": "shota" },
            { "name": "Shotacon", "value": "shotacon" },
            { "name": "Shoujo", "value": "shoujo" },
            { "name": "Shounen Ai", "value": "shounen-ai" },
            { "name": "Sibling Yin Yang", "value": "sibling-yin-yang" },
            { "name": "Sister-Sister Incest", "value": "sister-sister-incest" },
            { "name": "Sixty-Nine", "value": "sixty-nine" },
            { "name": "Skimpy Clothing", "value": "skimpy-clothing" },
            { "name": "Slapstick", "value": "slapstick" },
            { "name": "Slavery", "value": "slavery" },
            { "name": "Sleeping Sex", "value": "sleeping-sex" },
            { "name": "Slut", "value": "slut" },
            { "name": "Small Breasts", "value": "small-breasts" },
            { "name": "Small tits", "value": "small-tits" },
            { "name": "Soapland", "value": "soapland" },
            { "name": "Space", "value": "space" },
            { "name": "Space Travel", "value": "space-travel" },
            { "name": "Spanking", "value": "spanking" },
            { "name": "Special Squads", "value": "special-squads" },
            { "name": "Speculative Fiction", "value": "speculative-fiction" },
            { "name": "Spellcasting", "value": "spellcasting" },
            { "name": "Sports", "value": "sports" },
            { "name": "Squirt", "value": "squirt" },
            { "name": "Squirting", "value": "squirting" },
            { "name": "Stereotypes", "value": "stereotypes" },
            { "name": "Stomach Bulge", "value": "stomach-bulge" },
            { "name": "Stomach Stretch", "value": "stomach-stretch" },
            { "name": "Strapon", "value": "strapon" },
            { "name": "Strappado", "value": "strappado" },
            { "name": "Strappado Bondage", "value": "strappado-bondage" },
            { "name": "Student Government", "value": "student-government" },
            { "name": "Subbed Hentai", "value": "subbed-hentai" },
            { "name": "Submission", "value": "submission" },
            { "name": "Succubus", "value": "succubus" },
            { "name": "Sudden Girlfriend Ap...", "value": "sudden-girlfriend-ap" },
            { "name": "Sumata", "value": "sumata" },
            { "name": "Super Deformed", "value": "super-deformed" },
            { "name": "Super Power", "value": "super-power" },
            { "name": "Swimsuit", "value": "swimsuit" },
            { "name": "Swordplay", "value": "swordplay" },
            { "name": "Teacher", "value": "teacher" },
            { "name": "Teacher x Student", "value": "teacher-x-student" },
            { "name": "Telepathy", "value": "telepathy" },
            { "name": "Tennis", "value": "tennis" },
            { "name": "Tentacle", "value": "tentacle" },
            { "name": "Tentacles", "value": "tentacles" },
            { "name": "Thigh Sex", "value": "thigh-sex" },
            { "name": "Threesome", "value": "threesome" },
            { "name": "Threesome With Sisters", "value": "threesome-with-sisters" },
            { "name": "Thriller", "value": "thriller" },
            { "name": "Throat Fucking", "value": "throat-fucking" },
            { "name": "Time Travel", "value": "time-travel" },
            { "name": "Torture", "value": "torture" },
            { "name": "Toys", "value": "toys" },
            { "name": "Tragedy", "value": "tragedy" },
            { "name": "Transfer Student", "value": "transfer-student" },
            { "name": "Trap", "value": "trap" },
            { "name": "Traps", "value": "traps" },
            { "name": "Triple Penetration", "value": "triple-penetration" },
            { "name": "Tropes", "value": "tropes" },
            { "name": "Tsundere", "value": "tsundere" },
            { "name": "Twincest", "value": "twincest" },
            { "name": "Twisted", "value": "twisted" },
            { "name": "Uncensored", "value": "uncensored" },
            { "name": "Uncensored Hentai", "value": "uncensored-hentai" },
            { "name": "Uncle-Niece Incest", "value": "uncle-niece-incest" },
            { "name": "Undead", "value": "undead" },
            { "name": "Under One Roof", "value": "under-one-roof" },
            { "name": "Underworld", "value": "underworld" },
            { "name": "Uniform Fetish", "value": "uniform-fetish" },
            { "name": "Unrequited Love", "value": "unrequited-love" },
            { "name": "Urethra Penetration", "value": "urethra-penetration" },
            { "name": "Urination", "value": "urination" },
            { "name": "Urophagia", "value": "urophagia" },
            { "name": "Vampire", "value": "vampire" },
            { "name": "vanilla", "value": "vanilla" },
            { "name": "Vibrators", "value": "vibrators" },
            { "name": "Violence", "value": "violence" },
            { "name": "Violent Retribution ...", "value": "violent-retribution" },
            { "name": "virgen", "value": "virgen" },
            { "name": "Virgin", "value": "virgin" },
            { "name": "Virginity", "value": "virginity" },
            { "name": "Virgins", "value": "virgins" },
            { "name": "Virtual Reality", "value": "virtual-reality" },
            { "name": "Visible Aura", "value": "visible-aura" },
            { "name": "Visual Novel", "value": "visual-novel" },
            { "name": "Volleyball", "value": "volleyball" },
            { "name": "Voyeurism", "value": "voyeurism" },
            { "name": "Vulgar", "value": "vulgar" },
            { "name": "Waitress", "value": "waitress" },
            { "name": "Waitresses", "value": "waitresses" },
            { "name": "Wakamezake", "value": "wakamezake" },
            { "name": "Water Sex", "value": "water-sex" },
            { "name": "watersports", "value": "watersports" },
            { "name": "Wax Play", "value": "wax-play" },
            { "name": "Whip", "value": "whip" },
            { "name": "Whipping", "value": "whipping" },
            { "name": "Whips", "value": "whips" },
            { "name": "Window Fuck", "value": "window-fuck" },
            { "name": "Wrestling", "value": "wrestling" },
            { "name": "X-ray", "value": "x-ray" },
            { "name": "Yakuza", "value": "yakuza" },
            { "name": "Yaoi", "value": "yaoi" },
            { "name": "Yuri", "value": "yuri" },
            { "name": "Zettai Ryouiki", "value": "zettai-ryouiki" },
            { "name": "Zombie", "value": "zombie" }
        ];

        const filterValues = tags.map(tag => ({
            type_name: "SelectOption",
            name: tag.name,
            value: tag.value
        }));

        filterValues.unshift({
            type_name: "SelectOption",
            name: "None",
            value: ""
        });

        return [{
            type_name: "SelectFilter",
            name: "Tag",
            state: 0,
            values: filterValues
        }];
    }

    getSourcePreferences() {
        return [{
            key: "override_base_url",
            editTextPreference: {
                title: "Override Base URL",
                summary: "Use a different mirror/domain for the source",
                value: this.source.baseUrl,
                dialogTitle: "Enter new Base URL",
                dialogMessage: "Default: " + this.source.baseUrl,
            }
        }, {
            key: "popular_section_content",
            listPreference: {
                title: "Popular Tab Content",
                summary: "Choose what to display on the Popular tab",
                valueIndex: 0,
                entries: ["Popular Animes", "Most Rated Animes"],
                entryValues: ["popular-animes", "animes-most-rated"]
            }
        }, {
            key: "enable_subtitles",
            switchPreferenceCompat: {
                title: "Enable Subtitles",
                summary: "Loads subtitles when available. Disable if you prefer no subtitles.",
                value: true,
            }
        }, {
            key: "preferred_quality",
            listPreference: {
                title: "Preferred Quality",
                summary: "Select preferred video quality (currently not implemented)",
                valueIndex: 0,
                entries: ["Default", "High", "Medium", "Low"],
                entryValues: ["default", "high", "medium", "low"]
            }
        }];
    }
}