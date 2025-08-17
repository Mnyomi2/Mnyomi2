const mangayomiSources = [{
    "name": "YTS",
    "id": 891234567,
    "lang": "en",
    "baseUrl": "https://yts.mx",
    "iconUrl": "https://yts.mx/assets/images/website/favicon.ico",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.0",
    "pkgPath": "anime/src/en/yts.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.apiBaseUrl = "https://yts.mx/api/v2";
    }

    // Helper to parse the movie list from the API response
    _parseMovieList(resBody) {
        const data = JSON.parse(resBody).data;
        if (!data || !data.movies) {
            return { list: [], hasNextPage: false };
        }

        const list = data.movies.map(movie => ({
            name: movie.title_long,
            // Use a link format that getDetail can parse for the movie ID
            link: `${this.source.baseUrl}/movies/id/${movie.id}`,
            imageUrl: movie.large_cover_image
        }));

        const hasNextPage = (data.movie_count || 0) > ((data.page_number || 1) * (data.limit || 20));
        return { list, hasNextPage };
    }

    async getPopular(page) {
        const url = `${this.apiBaseUrl}/list_movies.json?page=${page}&sort_by=like_count&limit=20`;
        const res = await this.client.get(url);
        return this._parseMovieList(res.body);
    }

    async getLatestUpdates(page) {
        const url = `${this.apiBaseUrl}/list_movies.json?page=${page}&sort_by=date_added&limit=20`;
        const res = await this.client.get(url);
        return this._parseMovieList(res.body);
    }

    async search(query, page, filters) {
        let url = `${this.apiBaseUrl}/list_movies.json?page=${page}&limit=20`;

        if (query) {
            url += `&query_term=${encodeURIComponent(query)}`;
        }

        const genreFilter = filters.find(f => f.name === "Genre");
        if (genreFilter && genreFilter.state > 0) {
            url += `&genre=${genreFilter.values[genreFilter.state].value}`;
        }

        const qualityFilter = filters.find(f => f.name === "Quality");
        if (qualityFilter && qualityFilter.state > 0) {
            url += `&quality=${qualityFilter.values[qualityFilter.state].value}`;
        }
        
        const ratingFilter = filters.find(f => f.name === "Minimum Rating");
        if (ratingFilter && ratingFilter.state > 0) {
            url += `&minimum_rating=${ratingFilter.values[ratingFilter.state].value}`;
        }

        const sortFilter = filters.find(f => f.type_name === "SortFilter");
        if (sortFilter) {
            const sort = sortFilter.values[sortFilter.state.index];
            const sortBy = sort.value;
            const orderBy = sortFilter.state.ascending ? 'asc' : 'desc';
            url += `&sort_by=${sortBy}&order_by=${orderBy}`;
        }

        const res = await this.client.get(url);
        return this._parseMovieList(res.body);
    }

    async getDetail(url) {
        const movieId = url.split("/id/").pop();
        const apiUrl = `${this.apiBaseUrl}/movie_details.json?movie_id=${movieId}&with_images=true&with_cast=true`;
        const res = await this.client.get(apiUrl);
        const movie = JSON.parse(res.body).data.movie;

        let description = `${movie.description_full}\n\n`;
        description += `Year: ${movie.year}\n`;
        description += `Rating: ${movie.rating} / 10\n`;
        description += `Runtime: ${movie.runtime} minutes\n`;
        description += `Genres: ${movie.genres.join(", ")}\n`;
        if (movie.cast && movie.cast.length > 0) {
            description += `Cast: ${movie.cast.map(c => c.name).join(", ")}\n`;
        }
        
        return {
            name: movie.title_long,
            imageUrl: movie.large_cover_image,
            description: description.trim(),
            link: url,
            chapters: [{
                name: "Torrents",
                url: url // Pass the same URL to getVideoList
            }],
            status: 0 // Completed
        };
    }

    async getVideoList(url) {
        const movieId = url.split("/id/").pop();
        const apiUrl = `${this.apiBaseUrl}/movie_details.json?movie_id=${movieId}`;
        const res = await this.client.get(apiUrl);
        const movie = JSON.parse(res.body).data.movie;
        
        if (!movie || !movie.torrents) {
            throw new Error("No torrents found for this movie.");
        }

        const trackers = [
            "udp://open.demonii.com:1337/announce", "udp://tracker.openbittorrent.com:80",
            "udp://tracker.coppersurfer.tk:6969", "udp://glotorrents.pw:6969/announce",
            "udp://tracker.opentrackr.org:1337/announce", "udp://torrent.gresille.org:80/announce",
            "udp://p4p.arenabg.com:1337", "udp://tracker.leechers-paradise.org:6969"
        ];
        const encodedTrackers = trackers.map(tr => `tr=${encodeURIComponent(tr)}`).join("&");
        const encodedTitle = encodeURIComponent(movie.title_long);

        return movie.torrents.map(torrent => {
            const magnetUrl = `magnet:?xt=urn:btih:${torrent.hash}&dn=${encodedTitle}&${encodedTrackers}`;
            const quality = `${torrent.quality} (${torrent.type}) | Size: ${torrent.size} | S:${torrent.seeds}/P:${torrent.peers}`;

            return {
                url: magnetUrl,
                originalUrl: magnetUrl,
                quality: quality,
                headers: {}
            };
        }).sort((a, b) => b.quality.localeCompare(a.quality)); // Sort by quality descending
    }

    getFilterList() {
        const genres = [
            "All", "Action", "Adventure", "Animation", "Biography", "Comedy", "Crime",
            "Documentary", "Drama", "Family", "Fantasy", "Film-Noir", "Game-Show",
            "History", "Horror", "Music", "Musical", "Mystery", "News", "Reality-TV",
            "Romance", "Sci-Fi", "Sport", "Talk-Show", "Thriller", "War", "Western"
        ];
        
        const qualities = ["All", "480p", "720p", "1080p", "2160p", "3D"];
        const ratings = ["All", "9+", "8+", "7+", "6+", "5+", "4+", "3+", "2+", "1+"];
        const ratingValues = ["0", "9", "8", "7", "6", "5", "4", "3", "2", "1"];

        const sortOptions = [
            { name: "Date Added", value: "date_added" }, { name: "Like Count", value: "like_count" },
            { name: "Title", value: "title" }, { name: "Year", value: "year" },
            { name: "Rating", value: "rating" }, { name: "Peers", value: "peers" },
            { name: "Seeds", value: "seeds" }, { name: "Download Count", value: "download_count" }
        ];
        
        return [
            {
                type_name: "SelectFilter", name: "Genre", state: 0,
                values: genres.map(g => ({ type_name: "SelectOption", name: g, value: g.toLowerCase() === 'all' ? '' : g }))
            },
            {
                type_name: "SelectFilter", name: "Quality", state: 0,
                values: qualities.map(q => ({ type_name: "SelectOption", name: q, value: q.toLowerCase() === 'all' ? '' : q }))
            },
            {
                type_name: "SelectFilter", name: "Minimum Rating", state: 0,
                values: ratings.map((r, i) => ({ type_name: "SelectOption", name: r, value: ratingValues[i] }))
            },
            {
                type_name: "SortFilter", name: "Sort By", state: { index: 0, ascending: false },
                values: sortOptions.map(s => ({ type_name: "SelectOption", name: s.name, value: s.value }))
            }
        ];
    }
}