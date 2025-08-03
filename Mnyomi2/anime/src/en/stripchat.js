const mangayomiSources = [{
    "name": "Stripchat",
    "id": 987654573,
    "lang": "en",
    "baseUrl": "https://stripchat.com",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://stripchat.com",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.4.8",
    "pkgPath": "anime/src/en/stripchat.js"
}];



// --- SOURCE LOGIC ---
class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    getPreference(key) {
        return new SharedPreferences().get(key);
    }

    _mapModelToListItem(model) {
        const imageUrl = model.snapshotTimestamp 
            ? `https://img.strpst.com/thumbs/${model.snapshotTimestamp}/${model.id}_webp` 
            : model.avatarUrl;

        let description = "";
        if (model.groupShowTopic) description += `${model.groupShowTopic}\n`;
        if (model.country) description += `Location: ${model.country}\n`;
        if (model.viewersCount > 0) description += `Watching: ${model.viewersCount}\n\n`;
        if (model.tags && model.tags.length > 0) description += `#${model.tags.join(' #')}`;
        
        return {
            name: model.username,
            link: `${this.source.baseUrl}/${model.username}`,
            imageUrl: imageUrl,
            description: description.trim()
        };
    }

    async _getCategoryPage(categoryTag, selectedTag, page) {
        const offset = (page - 1) * 80;
        const isHD = categoryTag.endsWith("_hd");
        const primaryTag = categoryTag.replace("_hd", "");
        
        let apiUrl = `${this.source.baseUrl}/api/front/models?limit=80&sortBy=trending&primaryTag=${primaryTag}&offset=${offset}`;
        if (isHD) {
            apiUrl += "&broadcastHD=true";
        }
        
        if (selectedTag) {
            const filterValue = `[["${selectedTag}"]]`;
            apiUrl += `&parentTag=${selectedTag}&filterGroupTags=${encodeURIComponent(filterValue)}`;
        }

        const res = await this.client.get(apiUrl);
        const responseData = JSON.parse(res.body);
        if (!responseData.models) {
             return { list: [], hasNextPage: false };
        }

        const list = responseData.models.map(model => this._mapModelToListItem(model));
        const totalItems = responseData.filteredCount || 0;
        const hasNextPage = (page * 80) < totalItems;
        return { list, hasNextPage };
    }
    
    /**
     * If false, the "Latest" tab will be hidden in the app for this source.
     * This is now controlled by a user preference.
     */
    get supportsLatest() {
        // Reads the value from the switch preference defined in getSourcePreferences()
        return this.getPreference("enable_latest_tab");
    }

    async getPopular(page) {
        const categoryTag = this.getPreference("stripchat_popular_category") || "couples_hd";
        return this._getCategoryPage(categoryTag, "", page);
    }

    async getLatestUpdates(page) {
        const categoryTag = this.getPreference("stripchat_latest_category") || "girls_hd";
        return this._getCategoryPage(categoryTag, "", page);
    }

    async search(query, page, filters) {
        const categoryFilter = filters.find(f => f.name === "Category");
        const tagFilter = filters.find(f => f.name === "All Tags");

        const categoryTag = categoryFilter ? categoryFilter.values[categoryFilter.state].value : "girls_hd";
        const selectedTag = tagFilter ? tagFilter.values[tagFilter.state].value : "";

        if (query) {
            if (page > 1) {
                return { list: [], hasNextPage: false };
            }
            const primaryTag = categoryTag.replace("_hd", "");
            let apiUrl = `${this.source.baseUrl}/api/front/v4/models/search/suggestion?query=${encodeURIComponent(query)}&limit=80&primaryTag=${primaryTag}`;
            if (selectedTag) {
                apiUrl += `&parentTag=${selectedTag}`;
            }
            
            const res = await this.client.get(apiUrl);
            const responseData = JSON.parse(res.body);
            const models = responseData.models;

            if (!models || !Array.isArray(models)) {
                return { list: [], hasNextPage: false };
            }
            
            const list = models.map(model => this._mapModelToListItem(model));
            return { list, hasNextPage: false };
        }

        return this._getCategoryPage(categoryTag, selectedTag, page);
    }

    async getDetail(url) {
        const username = url.split("/").pop();
        return { name: username, link: url, description: `Live stream for model: ${username}. Click to play.`, chapters: [{ name: "Live Stream", url: url }], status: 0 };
    }

    async getVideoList(url) {
        const username = url.split("/").pop();
        if (!username) throw new Error("Invalid model URL provided.");
        const apiUrl = `${this.source.baseUrl}/api/front/models/username/${username}/`;
        const apiRes = await this.client.get(apiUrl);
        const data = JSON.parse(apiRes.body);
        if (!data.isLive || data.status !== 'public') throw new Error(`Model '${username}' is offline or in a private show.`);
        const modelId = data.id;
        if (!modelId) throw new Error("Could not find the model's ID in the API response.");
        const qualityMode = this.getPreference("stripchat_quality_mode") || "manual";
        const preferredQuality = this.getPreference("stripchat_preferred_quality") || "ask";
        const masterPlaylistUrl = `https://edge-hls.doppiocdn.live/hls/${modelId}/master/${modelId}_auto.m3u8`;
        const headers = { "Referer": this.source.baseUrl };
        if (qualityMode === "auto") return [{ url: masterPlaylistUrl, originalUrl: masterPlaylistUrl, quality: "Auto (HLS)", headers: headers }];
        let parsedVideos = [];
        try {
            const playlistRes = await this.client.get(masterPlaylistUrl);
            const playlistContent = playlistRes.body;
            const regex = /#EXT-X-STREAM-INF:.*NAME="([^"]+)".*\n(https?:\/\/[^\s]+)/g;
            let match;
            while ((match = regex.exec(playlistContent)) !== null) parsedVideos.push({ url: match[2], originalUrl: match[2], quality: match[1], headers: headers });
        } catch (e) { return [{ url: masterPlaylistUrl, originalUrl: masterPlaylistUrl, quality: "Auto (Failsafe)", headers: headers }]; }
        if (parsedVideos.length === 0) return [{ url: masterPlaylistUrl, originalUrl: masterPlaylistUrl, quality: "Auto (Failsafe)", headers: headers }];
        const fullVideoList = [{ url: masterPlaylistUrl, originalUrl: masterPlaylistUrl, quality: "Auto (HLS)", headers: headers }, ...parsedVideos];
        if (preferredQuality === "ask") return fullVideoList;
        let chosenVideo;
        if (preferredQuality === "best") {
            const qualityOrder = ["1080p60", "1080p", "960p", "720p60", "720p", "480p", "240p", "160p"];
            for (const q of qualityOrder) {
                chosenVideo = parsedVideos.find(v => v.quality === q);
                if (chosenVideo) break;
            }
        } else {
            chosenVideo = parsedVideos.find(v => v.quality === preferredQuality);
        }
        return chosenVideo ? [chosenVideo] : fullVideoList;
    }
    
    getSourcePreferences() {
        const categories = ["Female (HD)", "Couples (HD)", "Male (HD)", "Trans (HD)"];
        const categoryValues = ["girls_hd", "couples_hd", "men_hd", "trans_hd"];
        const qualityEntries = ["Always ask", "Best Available", "1080p60", "1080p", "960p", "720p60", "720p", "480p", "240p", "160p"];
        const qualityValues = ["ask", "best", "1080p60", "1080p", "960p", "720p60", "720p", "480p", "240p", "160p"];

        return [
            // NEW PREFERENCE SWITCH ADDED HERE
            { 
                key: "enable_latest_tab",
                switchPreferenceCompat: {
                    title: "Enable 'Latest' Tab",
                    summary: "This source does not have a true 'Latest' sort. Enabling this will show the tab, but it will behave like 'Popular'.",
                    value: false, // Default value is 'off'
                }
            },
            { key: "stripchat_quality_mode", listPreference: { title: "Video Quality Mode", summary: "Choose how to select video quality.", valueIndex: 0, entries: ["Let me choose (Manual Selection)", "Auto (HLS Player Decides)"], entryValues: ["manual", "auto"] }},
            { key: "stripchat_preferred_quality", listPreference: { title: "Preferred Manual Quality", summary: "Only applies if 'Video Quality Mode' is 'Manual'.", valueIndex: 0, entries: qualityEntries, entryValues: qualityValues }},
            { key: "stripchat_popular_category", listPreference: { title: "Popular Category", summary: "", valueIndex: 0, entries: categories, entryValues: categoryValues }}, 
            // UPDATED SUMMARY FOR THIS PREFERENCE
            { key: "stripchat_latest_category", listPreference: { title: "Latest Category", summary: "Used only when the 'Latest' tab is enabled above.", valueIndex: 0, entries: categories, entryValues: categoryValues }}
        ];
    }

    getFilterList() {
        const categories = [
            { name: "Female (HD)", value: "girls_hd" }, { name: "Couples (HD)", value: "couples_hd" }, { name: "Male (HD)", value: "men_hd" }, { name: "Trans (HD)", value: "trans_hd" }
        ];
        
	const allTags = [
            "tagLanguageAfrican","tagLanguageArgentinian","tagLanguageArmenian","tagLanguageBangladeshi","tagLanguageBelgian","tagLanguageBengali","tagLanguageBrazilian","tagLanguageBulgarian","tagLanguageCanadian","tagLanguageChilean","tagLanguageChinese","tagLanguageColombian","tagLanguageCzech","tagLanguageDanish","tagLanguageDutch","tagLanguageEcuadorian","tagLanguageFrench","tagLanguageGermanSpeaking","tagLanguageGreek","tagLanguageHindi","tagLanguageHungarian","tagLanguageIrish","tagLanguageItalian","tagLanguageJapanese","tagLanguageKenyan","tagLanguageMalagasy","tagLanguageMalayalam","tagLanguageMexican","tagLanguageNigerian","tagLanguageNordic","tagLanguagePeruvian","tagLanguagePolish","tagLanguagePortuguese","tagLanguagePortugueseSpeaking","tagLanguagePunjabi","tagLanguageRomanian","tagLanguageRussianSpeaking","tagLanguageSerbian","tagLanguageSlovakian","tagLanguageSouthAfrican","tagLanguageSpanish","tagLanguageSpanishSpeaking","tagLanguageSriLankan","tagLanguageSwiss","tagLanguageTaiwanese","tagLanguageTamil","tagLanguageThai","tagLanguageTurkish","tagLanguageUKModels","tagLanguageUSModels","tagLanguageUkrainian","tagLanguageVenezuelan","tagLanguageVietnamese","tagLanguageZimbabwean",
            "ethnicityMiddleEastern","ethnicityAsian","ethnicityEbony","ethnicityIndian","ethnicityLatino","ethnicityMultiracial","ethnicityWhite",
            "ageTeen","ageYoung","ageMilf","ageMature","ageOld",
            "bodyTypePetite","bodyTypeAthletic","bodyTypeMedium","bodyTypeCurvy","bodyTypeBBW","bodyTypeBig",
            "latex","do69Position","doAnal","doAssToMouth","doBlowjob","doCamelToe","doCreamPie","doCumshot","doDeepThroat","doDildoOrVibrator","doDoggyStyle","doDoublePenetration","doEjaculation","doFacesitting","doFacial","doFingering","doFisting","doFootFetish","doGagging","doGangbang","doGape","doHandjob","doHardcore","doHumiliation","doKissing","doMassage","doMasturbation","doNippleToys","doOilShow","doOrgasm","doPegging","doPublicPlace","doPussyLicking","doRimming","doRolePlay","doSelfsucking","doSexToys","doShower","doSmoking","doSpanking","doSph","doSquirt","doStrapon","doStriptease","doSwallow","doTalk","doTittyFuck","doTopless","doTwerk","doUpskirt","doYoga","fuckMachine","jerkOffInstruction","specificPOV",
            "ageTeen", "cosplayCon","autoTagNew","autoTagVr","subcultureBdsm","autoTagRecordablePrivate","leather","corset","heels","nylon","subcultureBdsm","subcultureCuckold","subcultureEmo","subcultureGoth","subcultureMistresses","subcultureSwingers","specificBeardy","specificBigBalls","specificBigClit","specificBigNipples","specificCD","specificFtM","specificHairyArmpits","specificInterracial","specificLesbians","specificMtF","specificMustache","specificPregnant","specificShemale","specificSmallTits","specificTG","specificTS","specificTV","specificTomboy","specificTrimmed","specificsBigAss","specificsBigTits","specificsHairy","specificsPiercing","specificsTattoos","asmr","cockRating","doCei","doFlexing"
       ];
        
        const formatName = (tag) => {
            let name = tag.replace("tagLanguage", "").replace("ethnicity", "").replace("do", "").replace("specific", "").replace("sub", "");
            name = name.replace(/([A-Z])/g, ' $1').trim();
            return name.charAt(0).toUpperCase() + name.slice(1);
        };

        const allTagOptions = [
            { type_name: "SelectOption", name: "All Tags", value: "" },
            ...allTags.map(tag => ({
                type_name: "SelectOption",
                name: formatName(tag),
                value: tag
            }))
        ];

        return [
            { type_name: "SelectFilter", name: "Category", state: 0, values: categories.map(cat => ({ type_name: "SelectOption", name: cat.name, value: cat.value })) },
            { type_name: "SelectFilter", name: "All Tags", state: 0, values: allTagOptions }
        ];
    }
}
// --- END SOURCE LOGIC ---
