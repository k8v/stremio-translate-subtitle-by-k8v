const axios = require('axios');

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

/**
 * Recherche l'ID TVDB (TVDB ID) et l'ID TMDb (TMDb ID) pour une série ou un film
 * en utilisant son ID IMDB (IMDB ID) et la clé API fournie.
 * @param {string} imdbId - L'ID IMDB du contenu (ex: 'tt13159924').
 * @param {string} type - Le type de contenu ('movie' ou 'series').
 * @param {string} tmdbApiKey - La clé d'API TMDb fournie par l'utilisateur.
 * @returns {Promise<{tvdbId: number, tmdbId: number} | null>} L'ID TVDB et TMDb, ou null en cas d'échec.
 */
async function getTvdbIdFromImdbId(imdbId, type, tmdbApiKey) {
    if (!tmdbApiKey || tmdbApiKey === "YOUR_TMDB_API_KEY") {
        console.error("Erreur: Clé d'API TMDb manquante. Impossible de convertir l'ID IMDB.");
        return null;
    }

    // Étape 1: Utiliser l'endpoint /find pour obtenir l'ID TMDb
    const findUrl = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${tmdbApiKey}&external_source=imdb_id`;

    try {
        console.log(`[TMDb] Tentative de conversion de l'ID IMDB ${imdbId} vers l'ID TVDB...`);
        const response = await axios.get(findUrl, { timeout: 8000 });
        
        let result = null;
        let mediaType = '';

        // Déterminer le résultat pertinent en fonction du type
        if (type === 'series' && response.data.tv_results && response.data.tv_results.length > 0) {
            result = response.data.tv_results[0];
            mediaType = 'tv';
        } else if (type === 'movie' && response.data.movie_results && response.data.movie_results.length > 0) {
            result = response.data.movie_results[0];
            mediaType = 'movie';
        }

        if (result) {
            const tmdbId = result.id;
            let tvdbId = null;
            
            // Étape 2: Pour les séries, nous avons besoin d'une requête séparée pour les IDs externes
            if (mediaType === 'tv') {
                 const externalIdsUrl = `${TMDB_BASE_URL}/tv/${tmdbId}/external_ids?api_key=${tmdbApiKey}`;
                 const externalIdsResponse = await axios.get(externalIdsUrl, { timeout: 8000 });
                 tvdbId = externalIdsResponse.data.tvdb_id;
            } else {
                 // Pour les films, l'ID TVDB est rarement utilisé par Gestdown (qui est centré sur les séries)
                 // On laisse le tvdbId à null pour les films, ce qui est acceptable.
                 tvdbId = result.external_ids?.tvdb_id || null;
            }

            if (tmdbId) {
                console.log(`[TMDb SUCCESS] ID IMDB ${imdbId} converti en TVDB ID: ${tvdbId} et TMDb ID: ${tmdbId}`);
                return { tvdbId, tmdbId };
            }
        }
        
        console.log(`[TMDb FAIL] Aucune correspondance TVDB trouvée pour l'ID IMDB ${imdbId} (${type}).`);
        return null;

    } catch (error) {
        console.error(`[TMDb ERROR] Échec de la requête de conversion d'ID pour ${imdbId}: ${error.message}`);
        // Retourne null en cas d'erreur réseau ou autre
        return null;
    }
}

module.exports = { getTvdbIdFromImdbId };