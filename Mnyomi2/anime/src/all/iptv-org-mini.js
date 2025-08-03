const mangayomiSources = [{
    "name": "IPTV-Org-Mini",
    "id": 2198139468,
    "lang": "all",
    "baseUrl": "https://iptv-org.github.io",
    "iconUrl": "https://raw.githubusercontent.com/iptv-app/iptv-desktop/refs/heads/main/build/icon.png",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.2.6",
    "pkgPath": "anime/src/all/iptv-org-mini.js"
}];


class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.apiCache = new Map();
    }

    getPreference(key, defaultValue = null) {
        // Helper function to get settings, needed for the quality extraction toggle.
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
            console.error(`Failed to fetch API endpoint: ${endpoint}`);
            return [];
        }
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

        const channels = await this._getAPI('channels');
        const lowerQuery = query.toLowerCase();

        const list = channels
            .filter(channel =>
                channel.name.toLowerCase().includes(lowerQuery) ||
                (channel.alt_names && channel.alt_names.some(alt => alt.toLowerCase().includes(lowerQuery)))
            )
            .map(channel => {
                const data = JSON.stringify({
                    type: 'channel',
                    id: channel.id,
                    name: channel.name,
                    poster: channel.logo || ""
                });
                return {
                    name: channel.name,
                    imageUrl: channel.logo || "",
                    link: data,
                };
            });

        return { list, hasNextPage: false };
    }

    async getDetail(url) {
        const data = JSON.parse(url);
        let chapters = [];
        let description = "";

        const [allChannels, allStreams, blocklist] = await Promise.all([
            this._getAPI('channels'),
            this._getAPI('streams'),
            this._getAPI('blocklist')
        ]);

        const blockedChannelIds = new Set(blocklist.map(item => item.channel).filter(Boolean));

        if (data.type === 'country') {
            description = `A list of live TV channels from ${data.name}.`;
            const countryChannels = allChannels.filter(channel =>
                channel.country === data.code && !blockedChannelIds.has(channel.id)
            );
            const channelMap = new Map(countryChannels.map(channel => [channel.id, channel]));

            for (const stream of allStreams) {
                if (channelMap.has(stream.channel)) {
                    const channel = channelMap.get(stream.channel);
                    const chapterName = stream.quality ? `${channel.name} (${stream.quality})` : channel.name;
                    const chapterData = JSON.stringify({
                        streamUrl: stream.url,
                        quality: stream.quality || "default",
                        headers: {
                            ...(stream.referrer && { 'Referer': stream.referrer }),
                            ...(stream.user_agent && { 'User-Agent': stream.user_agent })
                        }
                    });
                    chapters.push({ name: chapterName, url: chapterData });
                }
            }
        } else if (data.type === 'channel') {
            description = `Live stream for the channel: ${data.name}.`;
            const channelStreams = allStreams.filter(stream => stream.channel === data.id);
            for (const stream of channelStreams) {
                const chapterName = stream.quality ? `Play (${stream.quality})` : "Play Stream";
                const chapterData = JSON.stringify({
                    streamUrl: stream.url,
                    quality: stream.quality || "default",
                    headers: {
                        ...(stream.referrer && { 'Referer': stream.referrer }),
                        ...(stream.user_agent && { 'User-Agent': stream.user_agent })
                    }
                });
                chapters.push({ name: chapterName, url: chapterData });
            }
        }

        chapters.sort((a, b) => a.name.localeCompare(b.name));

        return {
            name: data.name,
            imageUrl: data.poster,
            link: url,
            description: description,
            status: 0,
            chapters
        };
    }

    // **MODIFIED TO EXTRACT QUALITIES**
    async getVideoList(url) {
        // The URL is the JSON string we created in getDetail.
        const videoData = JSON.parse(url);
        const originalVideo = {
            url: videoData.streamUrl,
            originalUrl: videoData.streamUrl,
            quality: videoData.quality,
            headers: videoData.headers || {}
        };

        // 1. Check if user wants to extract qualities and if it's an M3U8 playlist.
        if (!this.getPreference("iptv_extract_qualities", false) || !originalVideo.url.toLowerCase().includes('.m3u8')) {
            return [originalVideo]; // Return the single stream if disabled or not M3U8.
        }

        // 2. If enabled, attempt to fetch and parse the M3U8 playlist.
        try {
            const masterPlaylistContent = (await this.client.get(originalVideo.url, originalVideo.headers)).body;
            
            // This regex finds stream info (resolution/bandwidth) and the URL on the next line.
            const regex = /#EXT-X-STREAM-INF:.*?(?:RESOLUTION=(\d+x\d+)|BANDWIDTH=(\d+)).*\n(?!#)(.+)/g;
            let match;
            const parsedQualities = [];
            const finalVideos = [];
            const baseUrl = originalVideo.url.substring(0, originalVideo.url.lastIndexOf('/') + 1);

            while ((match = regex.exec(masterPlaylistContent)) !== null) {
                const resolution = match[1];
                const bandwidth = match[2];
                let qualityName = resolution ? resolution : `${Math.round(parseInt(bandwidth) / 1000)}kbps`;
                
                let streamUrl = match[3].trim();
                if (!streamUrl.startsWith('http')) {
                    streamUrl = baseUrl + streamUrl; // Handle relative URLs
                }

                parsedQualities.push({
                    url: streamUrl,
                    originalUrl: streamUrl,
                    quality: qualityName,
                    headers: originalVideo.headers
                });
            }
            
            if (parsedQualities.length > 0) {
                // Add the original link as an "Auto" option
                finalVideos.push({ ...originalVideo, quality: `Auto (HLS)` });
                // Add all the specific qualities found
                finalVideos.push(...parsedQualities);
                return finalVideos;
            } else {
                // If regex found no streams, return the original.
                return [originalVideo];
            }
        } catch (e) {
            console.error("Failed to extract M3U8 qualities:", e);
            // On any error, safely fall back to the original stream.
            return [originalVideo];
        }
    }

    // **ADDED TO SUPPORT THE SETTING**
    getSourcePreferences() {
        return [{
            key: "iptv_extract_qualities",
            switchPreferenceCompat: {
                title: "Enable Stream Quality Extraction",
                summary: "If a channel provides multiple qualities (HLS/m3u8), this will list them. May not work for all streams.",
                value: false, // Default to off
            }
        }];
    }
}

