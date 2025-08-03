const mangayomiSources = [{
    "name": "IPTV-Org",
    "id": 2198784567,
    "lang": "all",
    "baseUrl": "https://iptv-org.github.io",
    "iconUrl": "https://raw.githubusercontent.com/iptv-app/iptv-desktop/refs/heads/main/build/icon.png",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.6.5",
    "pkgPath": "anime/src/all/iptv-org.js"
}];


class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.apiCache = new Map();
        this.iptvUrl = "https://iptv-org.github.io/iptv/";

        this.filterData = {
            category: [
                { name: "Animation", file: "animation.m3u" },
                { name: "Auto", file: "auto.m3u" },
                { name: "Business", file: "business.m3u" },
                { name: "Classic", file: "classic.m3u" },
                { name: "Comedy", file: "comedy.m3u" },
                { name: "Cooking", file: "cooking.m3u" },
                { name: "Culture", file: "culture.m3u" },
                { name: "Documentary", file: "documentary.m3u" },
                { name: "Education", file: "education.m3u" },
                { name: "Entertainment", file: "entertainment.m3u" },
                { name: "Family", file: "family.m3u" },
                { name: "General", file: "general.m3u" },
                { name: "Kids", file: "kids.m3u" },
                { name: "Legislative", file: "legislative.m3u" },
                { name: "Lifestyle", file: "lifestyle.m3u" },
                { name: "Movies", file: "movies.m3u" },
                { name: "Music", file: "music.m3u" },
                { name: "News", file: "news.m3u" },
                { name: "Outdoor", file: "outdoor.m3u" },
                { name: "Relax", file: "relax.m3u" },
                { name: "Religious", file: "religious.m3u" },
                { name: "Science", file: "science.m3u" },
                { name: "Series", file: "series.m3u" },
                { name: "Shop", file: "shop.m3u" },
                { name: "Sports", file: "sports.m3u" },
                { name: "Travel", file: "travel.m3u" },
                { name: "Weather", file: "weather.m3u" },
                { name: "XXX", file: "xxx.m3u" },
                { name: "Undefined", file: "undefined.m3u" },
              ],
            language: [
                { name: "Acoli", file: "ach.m3u" },
                { name: "Adhola", file: "adh.m3u" },
                { name: "Afar", file: "aar.m3u" },
                { name: "Afrikaans", file: "afr.m3u" },
                { name: "Albanian", file: "sqi.m3u" },
                { name: "Algerian Sign Language", file: "asp.m3u" },
                { name: "Alur", file: "alz.m3u" },
                { name: "Amharic", file: "amh.m3u" },
                { name: "Arabic", file: "ara.m3u" },
                { name: "Armenian", file: "hye.m3u" },
                { name: "Assamese", file: "asm.m3u" },
                { name: "Assyrian Neo-Aramaic", file: "aii.m3u" },
                { name: "Ayizo Gbe", file: "ayb.m3u" },
                { name: "Aymara", file: "aym.m3u" },
                { name: "Azerbaijani", file: "aze.m3u" },
                { name: "Baatonum", file: "bba.m3u" },
                { name: "Bambara", file: "bam.m3u" },
                { name: "Bashkir", file: "bak.m3u" },
                { name: "Basque", file: "eus.m3u" },
                { name: "Belarusian", file: "bel.m3u" },
                { name: "Bengali", file: "ben.m3u" },
                { name: "Bhojpuri", file: "bho.m3u" },
                { name: "Bosnian", file: "bos.m3u" },
                { name: "Bulgarian", file: "bul.m3u" },
                { name: "Burmese", file: "mya.m3u" },
                { name: "Catalan", file: "cat.m3u" },
                { name: "Central Atlas Tamazight", file: "tzm.m3u" },
                { name: "Central Kurdish", file: "ckb.m3u" },
                { name: "Chhattisgarhi", file: "hne.m3u" },
                { name: "Chiga", file: "cgg.m3u" },
                { name: "Chinese", file: "zho.m3u" },
                { name: "Croatian", file: "hrv.m3u" },
                { name: "Czech", file: "ces.m3u" },
                { name: "Danish", file: "dan.m3u" },
                { name: "Dari (Parsi)", file: "prd.m3u" },
                { name: "Dendi (Benin)", file: "ddn.m3u" },
                { name: "Dhanwar (Nepal)", file: "dhw.m3u" },
                { name: "Dhivehi", file: "div.m3u" },
                { name: "Dholuo", file: "luo.m3u" },
                { name: "Dimili", file: "zza.m3u" },
                { name: "Dutch", file: "nld.m3u" },
                { name: "Egyptian Arabic", file: "arz.m3u" },
                { name: "English", file: "eng.m3u" },
                { name: "Estonian", file: "est.m3u" },
                { name: "Ewe", file: "ewe.m3u" },
                { name: "Faroese", file: "fao.m3u" },
                { name: "Fataleka", file: "far.m3u" },
                { name: "Filipino", file: "fil.m3u" },
                { name: "Finnish", file: "fin.m3u" },
                { name: "Fon", file: "fon.m3u" },
                { name: "French", file: "fra.m3u" },
                { name: "Fulah", file: "ful.m3u" },
                { name: "Gaelic", file: "gla.m3u" },
                { name: "Galician", file: "glg.m3u" },
                { name: "Ganda", file: "lug.m3u" },
                { name: "Gen", file: "gej.m3u" },
                { name: "Georgian", file: "kat.m3u" },
                { name: "German", file: "deu.m3u" },
                { name: "Gikuyu", file: "kik.m3u" },
                { name: "Goan Konkani", file: "gom.m3u" },
                { name: "Greek", file: "ell.m3u" },
                { name: "Guadeloupean Creole French", file: "gcf.m3u" },
                { name: "Gujarati", file: "guj.m3u" },
                { name: "Gun", file: "guw.m3u" },
                { name: "Haitian", file: "hat.m3u" },
                { name: "Hausa", file: "hau.m3u" },
                { name: "Hebrew", file: "heb.m3u" },
                { name: "Hindi", file: "hin.m3u" },
                { name: "Hmong", file: "hmn.m3u" },
                { name: "Hungarian", file: "hun.m3u" },
                { name: "Icelandic", file: "isl.m3u" },
                { name: "Indonesian", file: "ind.m3u" },
                { name: "Inuktitut", file: "iku.m3u" },
                { name: "Irish", file: "gle.m3u" },
                { name: "Isekiri", file: "its.m3u" },
                { name: "Italian", file: "ita.m3u" },
                { name: "Japanese", file: "jpn.m3u" },
                { name: "Javanese", file: "jav.m3u" },
                { name: "Kabiyè", file: "kbp.m3u" },
                { name: "Kabyle", file: "kab.m3u" },
                { name: "Kannada", file: "kan.m3u" },
                { name: "Kapampangan", file: "pam.m3u" },
                { name: "Kazakh", file: "kaz.m3u" },
                { name: "Khmer", file: "khm.m3u" },
                { name: "Khorasani Turkish", file: "kmz.m3u" },
                { name: "Kinyarwanda", file: "kin.m3u" },
                { name: "Kirghiz", file: "kir.m3u" },
                { name: "Kituba (Congo)", file: "mkw.m3u" },
                { name: "Kongo", file: "kon.m3u" },
                { name: "Konkani (macrolanguage)", file: "kok.m3u" },
                { name: "Korean", file: "kor.m3u" },
                { name: "Kumam", file: "kdi.m3u" },
                { name: "Kurdish", file: "kur.m3u" },
                { name: "Lango (Uganda)", file: "laj.m3u" },
                { name: "Lao", file: "lao.m3u" },
                { name: "Latin", file: "lat.m3u" },
                { name: "Latvian", file: "lav.m3u" },
                { name: "Letzeburgesch", file: "ltz.m3u" },
                { name: "Lingala", file: "lin.m3u" },
                { name: "Lithuanian", file: "lit.m3u" },
                { name: "Luba-Lulua", file: "lua.m3u" },
                { name: "Macedonian", file: "mkd.m3u" },
                { name: "Malay", file: "msa.m3u" },
                { name: "Malayalam", file: "mal.m3u" },
                { name: "Maltese", file: "mlt.m3u" },
                { name: "Mandarin Chinese", file: "cmn.m3u" },
                { name: "Mandinka", file: "mnk.m3u" },
                { name: "Maori", file: "mri.m3u" },
                { name: "Marathi", file: "mar.m3u" },
                { name: "Min Nan Chinese", file: "nan.m3u" },
                { name: "Mongolian", file: "mon.m3u" },
                { name: "Montenegrin", file: "cnr.m3u" },
                { name: "Morisyen", file: "mfe.m3u" },
                { name: "Moroccan Sign Language", file: "xms.m3u" },
                { name: "Mycenaean Greek", file: "gmy.m3u" },
                { name: "Nepali", file: "nep.m3u" },
                { name: "Norwegian", file: "nor.m3u" },
                { name: "Nyankole", file: "nyn.m3u" },
                { name: "Nyoro", file: "nyo.m3u" },
                { name: "Oriya (macrolanguage)", file: "ori.m3u" },
                { name: "Panjabi", file: "pan.m3u" },
                { name: "Papiamento", file: "pap.m3u" },
                { name: "Pashto", file: "pus.m3u" },
                { name: "Persian", file: "fas.m3u" },
                { name: "Polish", file: "pol.m3u" },
                { name: "Portuguese", file: "por.m3u" },
                { name: "Pulaar", file: "fuc.m3u" },
                { name: "Quechua", file: "que.m3u" },
                { name: "Romanian", file: "ron.m3u" },
                { name: "Romany", file: "rom.m3u" },
                { name: "Russian", file: "rus.m3u" },
                { name: "Saint Lucian Creole French", file: "acf.m3u" },
                { name: "Samoan", file: "smo.m3u" },
                { name: "Santali", file: "sat.m3u" },
                { name: "Serbian", file: "srp.m3u" },
                { name: "Serbo-Croatian", file: "hbs.m3u" },
                { name: "Sinhala", file: "sin.m3u" },
                { name: "Slovak", file: "slk.m3u" },
                { name: "Slovenian", file: "slv.m3u" },
                { name: "Somali", file: "som.m3u" },
                { name: "South African Sign Language", file: "sfs.m3u" },
                { name: "South Ndebele", file: "nbl.m3u" },
                { name: "Spanish", file: "spa.m3u" },
                { name: "Swahili", file: "swa.m3u" },
                { name: "Swati", file: "ssw.m3u" },
                { name: "Swedish", file: "swe.m3u" },
                { name: "Syriac", file: "syr.m3u" },
                { name: "Tachawit", file: "shy.m3u" },
                { name: "Tachelhit", file: "shi.m3u" },
                { name: "Tagalog", file: "tgl.m3u" },
                { name: "Tahitian", file: "tah.m3u" },
                { name: "Tajik", file: "tgk.m3u" },
                { name: "Tamashek", file: "tmh.m3u" },
                { name: "Tamasheq", file: "taq.m3u" },
                { name: "Tamil", file: "tam.m3u" },
                { name: "Tarifit", file: "rif.m3u" },
                { name: "Tatar", file: "tat.m3u" },
                { name: "Telugu", file: "tel.m3u" },
                { name: "Thai", file: "tha.m3u" },
                { name: "Tibetan", file: "bod.m3u" },
                { name: "Tigre", file: "tig.m3u" },
                { name: "Tigrinya", file: "tir.m3u" },
                { name: "Tooro", file: "ttj.m3u" },
                { name: "Tsonga", file: "tso.m3u" },
                { name: "Turkish", file: "tur.m3u" },
                { name: "Turkmen", file: "tuk.m3u" },
                { name: "Uighur", file: "uig.m3u" },
                { name: "Ukrainian", file: "ukr.m3u" },
                { name: "Urdu", file: "urd.m3u" },
                { name: "Uzbek", file: "uzb.m3u" },
                { name: "Venda", file: "ven.m3u" },
                { name: "Vietnamese", file: "vie.m3u" },
                { name: "Welsh", file: "cym.m3u" },
                { name: "Western Frisian", file: "fry.m3u" },
                { name: "Western Niger Fulfulde", file: "fuh.m3u" },
                { name: "Wolof", file: "wol.m3u" },
                { name: "Xhosa", file: "xho.m3u" },
                { name: "Yakut", file: "sah.m3u" },
                { name: "Yoruba", file: "yor.m3u" },
                { name: "Yucatec Maya", file: "yua.m3u" },
                { name: "Yue Chinese", file: "yue.m3u" },
                { name: "Zarma", file: "dje.m3u" },
                { name: "Zulu", file: "zul.m3u" },
                { name: "Undefined", file: "undefined.m3u" },
            ],
            region: [
                { name: "Africa", file: "afr.m3u" },
                { name: "Americas", file: "amer.m3u" },
                { name: "Arab world", file: "arab.m3u" },
                { name: "Asia", file: "asia.m3u" },
                { name: "Asia-Pacific", file: "apac.m3u" },
                { name: "Association of Southeast Asian Nations", file: "asean.m3u" },
                { name: "Balkan", file: "balkan.m3u" },
                { name: "Benelux", file: "benelux.m3u" },
                { name: "Caribbean", file: "carib.m3u" },
                { name: "Central America", file: "cenamer.m3u" },
                { name: "Central and Eastern Europe", file: "cee.m3u" },
                { name: "Central Asia", file: "cas.m3u" },
                { name: "Commonwealth of Independent States", file: "cis.m3u" },
                { name: "Europe", file: "eur.m3u" },
                { name: "Europe, the Middle East and Africa", file: "emea.m3u" },
                { name: "European Union", file: "eu.m3u" },
                { name: "Gulf Cooperation Council", file: "gcc.m3u" },
                { name: "Hispanic America", file: "hispam.m3u" },
                { name: "Latin America", file: "latam.m3u" },
                { name: "Latin America and the Caribbean", file: "lac.m3u" },
                { name: "Maghreb", file: "maghreb.m3u" },
                { name: "Middle East", file: "mideast.m3u" },
                { name: "Middle East and North Africa", file: "mena.m3u" },
                { name: "Nordics", file: "nord.m3u" },
                { name: "North America", file: "noram.m3u" },
                { name: "Northern America", file: "nam.m3u" },
                { name: "Northern Europe", file: "neur.m3u" },
                { name: "Oceania", file: "oce.m3u" },
                { name: "South America", file: "southam.m3u" },
                { name: "South Asia", file: "sas.m3u" },
                { name: "Southeast Asia", file: "sea.m3u" },
                { name: "Southern Europe", file: "ser.m3u" },
                { name: "Sub-Saharan Africa", file: "ssa.m3u" },
                { name: "West Africa", file: "wafr.m3u" },
                { name: "Western Europe", file: "wer.m3u" },
                { name: "Worldwide", file: "int.m3u" },
                { name: "Undefined", file: "undefined.m3u" },
            ],
        };
    }

    getPreference(key, defaultValue = null) {
        const preferences = new SharedPreferences();
        const value = preferences.get(key);
        if (value === null || value === undefined || value === "") {
            return defaultValue;
        }
        return value;
    }

    // --- API HELPER ---
    async _getAPI(endpoint) {
        if (this.apiCache.has(endpoint)) {
            return this.apiCache.get(endpoint);
        }
        const url = `${this.source.baseUrl}/api/${endpoint}.json`;
        try {
            const res = await this.client.get(url);
            const data = JSON.parse(res.body);
            this.apiCache.set(endpoint, data);
            return data;
        } catch (e) {
            this.apiCache.delete(endpoint);
            return [];
        }
    }

    async _parseM3U(m3uContent) {
        const channels = [];
        const lines = m3uContent.split('\n');
        let currentChannel = {};

        for (const line of lines) {
            if (line.startsWith('#EXTINF:')) {
                const info = line.substring(line.indexOf(',') + 1).trim();
                const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                const nameMatch = line.match(/tvg-name="([^"]*)"/);

                currentChannel = {
                    name: nameMatch ? nameMatch[1] : info,
                    imageUrl: logoMatch ? logoMatch[1] : "",
                };
            } else if (line.trim() && !line.startsWith('#')) {
                currentChannel.url = line.trim();
                if (currentChannel.name && currentChannel.url) {
                    channels.push(currentChannel);
                }
                currentChannel = {};
            }
        }
        return channels;
    }

    // --- MPROVIDER METHODS ---

    get supportsLatest() {
        return false;
    }

    getHeaders(url) {
        return {};
    }

    async getPopular(page) {
        if (page > 1) {
            return { list: [], hasNextPage: false };
        }

        const countries = await this._getAPI('countries');
        const list = countries.map(country => {
            const flagUrl = `https://github.com/emcrisostomo/flags/raw/master/png/256/${country.code}.png`;
            const data = JSON.stringify({
                type: 'country',
                code: country.code,
                name: country.name,
                poster: flagUrl
            });
            return {
                name: country.name,
                imageUrl: flagUrl,
                link: data,
            };
        });

        return { list, hasNextPage: false };
    }

    async search(query, page, filters) {
        if (page > 1) {
            return { list: [], hasNextPage: false };
        }

        let list = [];
        // Handle text-based search by fetching the main index
        if (query) {
             const m3uUrl = `${this.iptvUrl}index.m3u`;
             const m3uContent = (await this.client.get(m3uUrl)).body;
             const allChannels = await this._parseM3U(m3uContent);
             const lowerQuery = query.toLowerCase();
             const results = allChannels.filter(channel =>
                 channel.name.toLowerCase().includes(lowerQuery)
             );
             list = results.map(channel => ({
                 name: channel.name,
                 imageUrl: channel.imageUrl,
                 link: JSON.stringify({
                     type: 'channel-m3u',
                     name: channel.name,
                     poster: channel.imageUrl,
                     streamUrl: channel.url
                 })
             }));
        }
        // Handle filter-based search
        else if (filters && filters.length > 0) {
            const filterType = this.getPreference("iptv_primary_filter", "region");
            const selectedFile = filters[0].values[filters[0].state].value;

            if (selectedFile === 'all') {
                return { list: [], hasNextPage: false };
            }

            const folderMap = {
                region: 'regions',
                language: 'languages',
                category: 'categories'
            };
            const folder = folderMap[filterType];
            const m3uUrl = `${this.iptvUrl}${folder}/${selectedFile}`;
            const m3uContent = (await this.client.get(m3uUrl)).body;
            const parsedChannels = await this._parseM3U(m3uContent);

            list = parsedChannels.map(channel => ({
                name: channel.name,
                imageUrl: channel.imageUrl,
                link: JSON.stringify({
                    type: 'channel-m3u',
                    name: channel.name,
                    poster: channel.imageUrl,
                    streamUrl: channel.url
                })
            }));
        }

        return { list, hasNextPage: false };
    }

    async getDetail(url) {
        const data = JSON.parse(url);
        let chapters = [];
        let description = "";

        switch (data.type) {
            case 'country':
                description = `A list of live TV channels from ${data.name}.`;
                const m3uUrl = `${this.iptvUrl}countries/${data.code.toLowerCase()}.m3u`;
                const m3uContent = (await this.client.get(m3uUrl)).body;
                const parsedChannels = await this._parseM3U(m3uContent);

                chapters = parsedChannels.map(channel => {
                    const chapterData = JSON.stringify({
                        type: 'channel-m3u',
                        name: channel.name,
                        poster: channel.imageUrl,
                        streamUrl: channel.url
                    });
                    return {
                        name: channel.name,
                        url: chapterData,
                    };
                });
                break;
            case 'channel-m3u':
                description = `Live stream for the channel: ${data.name}.`;
                chapters.push({
                    name: "Play Stream",
                    url: url,
                });
                break;
        }

        return {
            name: data.name,
            imageUrl: data.poster,
            link: url,
            description: description,
            status: 0, // 0 = Ongoing
            chapters
        };
    }

    async getVideoList(url) {
        const data = JSON.parse(url);
        let initialVideos = [];

        if (data.type === 'channel-m3u') {
            initialVideos.push({
                url: data.streamUrl,
                originalUrl: data.streamUrl,
                quality: "default",
                headers: {}
            });
        }

        if (initialVideos.length === 0) {
            throw new Error(`No streams found for channel: ${data.name}`);
        }

        if (!this.getPreference("iptv_extract_qualities", false)) {
            return initialVideos;
        }

        const finalVideos = [];
        for (const video of initialVideos) {
            if (video.url && video.url.toLowerCase().includes('.m3u8')) {
                try {
                    const masterPlaylistContent = (await this.client.get(video.url, video.headers)).body;
                    const regex = /#EXT-X-STREAM-INF:.*(?:RESOLUTION=(\d+x\d+)|BANDWIDTH=(\d+)).*\n(?!#)(.+)/g;
                    let match;
                    const parsedQualities = [];
                    const baseUrl = video.url.substring(0, video.url.lastIndexOf('/') + 1);

                    while ((match = regex.exec(masterPlaylistContent)) !== null) {
                        const resolution = match[1];
                        const bandwidth = match[2];
                        let qualityName = resolution ? resolution : `${Math.round(parseInt(bandwidth) / 1000)}kbps`;
                        
                        let streamUrl = match[3].trim();
                        if (!streamUrl.startsWith('http')) {
                            streamUrl = baseUrl + streamUrl;
                        }

                        parsedQualities.push({
                            url: streamUrl,
                            originalUrl: streamUrl,
                            quality: qualityName,
                            headers: video.headers
                        });
                    }
                    
                    if(parsedQualities.length > 0){
                        finalVideos.push({ ...video, quality: `Auto (HLS)` });
                        finalVideos.push(...parsedQualities);
                    } else {
                         finalVideos.push(video);
                    }

                } catch (e) {
                    finalVideos.push(video); // Failsafe
                }
            } else {
                finalVideos.push(video);
            }
        }

        return finalVideos;
    }

    getSourcePreferences() {
        return [{
            key: "iptv_primary_filter",
            listPreference: {
                title: "Primary Filter",
                summary: "Choose which filter to display in the search/filter screen.",
                valueIndex: 0,
                entries: ["Region", "Language", "Category"],
                entryValues: ["region", "language", "category"],
            },
        }, {
            key: "iptv_extract_qualities",
            switchPreferenceCompat: {
                title: "Enable Stream Quality Extraction",
                summary: "If a channel provides multiple qualities, this will list them. May not work for all streams.",
                value: false, 
            }
        }];
    }

    getFilterList() {
        const filterType = this.getPreference("iptv_primary_filter", "region");

        const createOptions = (items, valueExtractor) => {
            const options = [{
                type_name: "SelectOption",
                name: "All",
                value: "all"
            }];
            items.forEach(item => {
                options.push({
                    type_name: "SelectOption",
                    name: item.name,
                    value: valueExtractor(item)
                });
            });
            return options;
        };

        const useFileAsValue = (item) => item.file;

        switch (filterType) {
            case "region":
                return [{
                    type_name: "SelectFilter",
                    name: "Region",
                    state: 0,
                    values: createOptions(this.filterData.region, useFileAsValue)
                }];
            case "language":
                return [{
                    type_name: "SelectFilter",
                    name: "Language",
                    state: 0,
                    values: createOptions(this.filterData.language, useFileAsValue)
                }];
            case "category":
                return [{
                    type_name: "SelectFilter",
                    name: "Category",
                    state: 0,
                    values: createOptions(this.filterData.category, useFileAsValue)
                }];
            default:
                return [];
        }
    }
}


