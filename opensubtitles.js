const axios = require("axios");
const fs = require("fs").promises;
// IMPORTANT : Assurez-vous que le fichier tmdb.js existe dans le même répertoire
const { getTvdbIdFromImdbId } = require("./tmdb"); 

// URLs de base des fournisseurs de sous-titres
const opensubtitlesbaseurl = "https://opensubtitles-v3.strem.io/subtitles/";
const wyziebaseurl = "https://sub.wyzie.ru/";
const GESTDOWN_API_URL = "https://api.gestdown.info"; 

const isoCodeMapping = require("./langs/iso_code_mapping.json");

// --- FONCTIONS UTILITAIRES (De la Version A) ---

/**
 * Convertit un code de langue en code ISO 639-1 (2 lettres) si nécessaire.
 */
function to2LetterCode(langCode) {
    if (langCode.length === 2) {
        return langCode.toLowerCase();
    }
    
    const twoLetterCode = isoCodeMapping[langCode.toLowerCase()];
    
    return twoLetterCode || langCode.substring(0, 2).toLowerCase();
}

/**
 * Convertit un code de langue en code ISO 639-2/3 (3 lettres) si nécessaire.
 */
function to3LetterCode(langCode) {
     if (langCode.length === 3) {
        return langCode.toLowerCase();
    }
    
    const invertedMapping = Object.fromEntries(
        Object.entries(isoCodeMapping).map(([key, value]) => [value, key])
    );

    const threeLetterCode = invertedMapping[langCode.toLowerCase()];
    
    return threeLetterCode || langCode.toLowerCase(); 
}


// --- FONCTIONS DE RECHERCHE SPÉCIFIQUES AUX SOURCES ---

/**
 * Recherche des sous-titres via l'API Wyzie. 
 */
async function findSubtitleUrlsWyzie(imdbId, langCode = null) {
    let url = `${wyziebaseurl}search?id=${imdbId}&format=srt`;
    let logMessage = '[Wyzie] Searching for ALL languages (First Language Fallback)';
    let expectedLangCode3Letter = null;

    if (langCode) {
        const finalLangCode2Letter = to2LetterCode(langCode);
        url += `&language=${finalLangCode2Letter}`;
        logMessage = `[Wyzie] Searching for specific language: ${finalLangCode2Letter}`;
        expectedLangCode3Letter = to3LetterCode(finalLangCode2Letter);
    }
    
    try {
        console.log(`${logMessage} with URL: ${url}`);
        
        const response = await axios.get(url, {
            timeout: 5000 
        });

        const results = Array.isArray(response.data) ? response.data : response.data.data;

        if (results && results.length > 0) {
            console.log(`[Wyzie] API response: Found ${results.length} results.`);
            const subtitle = results[0];
            
            const resultLang2Letter = subtitle.language || 'unk'; 
            const resultLang3Letter = to3LetterCode(resultLang2Letter);
            
            const finalLang = expectedLangCode3Letter || resultLang3Letter;
            
            console.log(`[Wyzie SUCCESS] Found subtitle URL: ${subtitle.url} in language: ${finalLang}`);

            return { 
                url: subtitle.url, 
                lang: finalLang
            };
        }
    } catch (error) {
        console.error(`[Wyzie ERROR] Search failed for IMDB ID ${imdbId} (Lang: ${langCode || 'ALL'}): Request failed with status code ${error.response?.status || 'N/A'}`);
    }
    
    return null;
}

/**
 * Recherche des sous-titres via Gestdown (SÉRIES utilisant TVDB ID).
 */
async function findSubtitleUrlsGestdown(imdbId, season, episode, langCode, tmdbApiKey) {
    if (!season || !episode || !tmdbApiKey) {
        return null;
    }

    try {
        // --- Étape 1: Conversion IMDB -> TVDB (via tmdb.js) ---
        const ids = await getTvdbIdFromImdbId(imdbId, 'series', tmdbApiKey);

        if (!ids || !ids.tvdbId) {
            console.log(`[Gestdown] Conversion IMDB ${imdbId} -> TVDB ID échouée. Skip Gestdown.`);
            return null;
        }

        const tvdbId = ids.tvdbId;
        const finalLangCode2Letter = to2LetterCode(langCode); 

        // --- Étape 2: Obtention de l'ID SHOWS Gestdown via ID TVDB ---
        const showIdUrl = `${GESTDOWN_API_URL}/shows/external/tvdb/${tvdbId}`;
        console.log(`[Gestdown] Requête Gestdown Show ID: ${showIdUrl}`);
        const showIdResponse = await axios.get(showIdUrl, { timeout: 8000 });

        const showUniqueId = showIdResponse.data?.shows?.[0]?.id; 

        if (!showUniqueId) {
            console.log(`[Gestdown] Show Unique ID non trouvé pour TVDB ID ${tvdbId}.`);
            return null;
        }
        
        // --- Étape 3: Recherche du sous-titre Gestdown ---
        const searchSubUrl = `${GESTDOWN_API_URL}/subtitles/get/${showUniqueId}/${season}/${episode}/${finalLangCode2Letter}`;
        console.log(`[Gestdown] Searching for subtitles with URL: ${searchSubUrl}`);
        
        const subResponse = await axios.get(searchSubUrl, { timeout: 8000 });
        
        const matchingSubtitles = subResponse.data?.matchingSubtitles;
        
        if (matchingSubtitles && matchingSubtitles.length > 0) {
            const bestMatch = matchingSubtitles[0]; 
            
            const downloadUri = bestMatch.downloadUri;
            const subtitleUrl = `${GESTDOWN_API_URL}${downloadUri}`;
            
            console.log(`[Gestdown SUCCESS] Subtitle found for language ${langCode}: ${subtitleUrl}`);
            
            const resultLangCode = to3LetterCode(finalLangCode2Letter);

            return {
                url: subtitleUrl,
                lang: resultLangCode,
            };
        }

    } catch (error) {
        if (error.response && error.response.status === 404) {
             console.log(`[Gestdown] Aucun sous-titre trouvé (404) pour ${langCode}.`);
        } else {
             console.error(`[Gestdown ERROR] Échec de la recherche Gestdown pour ${langCode}: ${error.message}`);
        }
    }

    return null;
}


// --- FONCTION DE TÉLÉCHARGEMENT ---

const downloadSubtitles = async (
  subtitles,
  imdbid,
  season = null,
  episode = null,
  oldisocode
) => {
  let uniqueTempFolder = null;
  // Déterminer le chemin de sauvegarde local
  if (season && episode) {
    await fs.mkdir(`subtitles/${oldisocode}/${imdbid}/season${season}`, {
      recursive: true,
    });
    uniqueTempFolder = `subtitles/${oldisocode}/${imdbid}/season${season}`;
  } else {
    await fs.mkdir(`subtitles/${oldisocode}/${imdbid}`, { recursive: true });
    uniqueTempFolder = `subtitles/${oldisocode}/${imdbid}`;
  }

  let filepaths = [];

  for (let i = 0; i < subtitles.length; i++) {
    const url = subtitles[i].url;
    try {
      console.log(`Attempting to download subtitle from: ${url}`);
      const response = await axios.get(url, { responseType: "arraybuffer" });
      const subtitleData = response.data;

      // VÉRIFICATION: Vérifier si les données de sous-titres ne sont pas vides
      if (!subtitleData || subtitleData.length === 0) {
        console.warn(`Subtitle file from ${url} was empty or corrupted. Skipping.`);
        continue; 
      }

      let filePath = null;
      // Nommage du fichier
      if (episode) {
        filePath = `${uniqueTempFolder}/${imdbid}-subtitle_${episode}-${
          i + 1
        }.srt`;
      } else {
        filePath = `${uniqueTempFolder}/${imdbid}-subtitle-${i + 1}.srt`;
      }
      console.log(`Saving subtitle to: ${filePath}`);
      await fs.writeFile(filePath, subtitleData);
      console.log(`Subtitle downloaded and saved: ${filePath}`);
      filepaths.push(filePath);
    } catch (error) {
      console.error(`Subtitle download error for URL ${url}: ${error.message}`);
    }
  }
  
  // Si le téléchargement a échoué pour tous les sous-titres
  if (filepaths.length === 0 && subtitles.length > 0) {
     throw new Error("Failed to download any valid subtitle files for translation.");
  }
  
  return filepaths;
};


// --- FONCTION PRINCIPALE DE RECHERCHE (Version A, Stratégie complète) ---

const getsubtitles = async (
  type,
  imdbid,
  season = null,
  episode = null,
  targetLangCode3Letter, // Langue cible de la traduction (ex: 'fra')
  tmdbApiKey // La clé TMDb passée depuis index.js (NÉCESSAIRE pour Gestdown)
) => {
  // CONSTRUIRE L'ENDPOINT RELATIF pour OSV3
  let endpoint = '';
  if (type === "series" && season && episode) {
    endpoint = `${type}/${imdbid}:${season}:${episode}.json`;
  } else {
    endpoint = `${type}/${imdbid}.json`;
  }
  
  const url = new URL(endpoint, opensubtitlesbaseurl).toString();
  const englishCode3Letter = 'eng'; 

  // Helper pour trouver les sous-titres dans la liste de OSV3
  const findSubtitleInList = (subtitles, langCode3Letter) => {
    return subtitles.find((subtitle) => {
      // OSV3 utilise le code 2 lettres dans la propriété 'lang'. On compare en 3 lettres.
      const subtitleLang3Letter = to3LetterCode(subtitle.lang) || subtitle.lang;
      return subtitleLang3Letter === langCode3Letter;
    });
  };

  // Tenter de récupérer les données OSV3 une seule fois
  let subtitlesFromOSV3 = [];
  try {
    const response = await axios.get(url, { timeout: 8000 });
    subtitlesFromOSV3 = response.data.subtitles || []; 
  } catch(error) {
    console.warn("Error fetching subtitles from OpenSubtitles V3. Continuing with Gestdown/Wyzie. Request failed with status code 400", error.message);
  }


  // ==============================================================================
  // STRATÉGIE DE RECHERCHE (8 étapes: Cible > ENG > All)
  // ==============================================================================
  
  // ------------------------------------------------------------------------------
  // --- PARTIE 1: RECHERCHE de la LANGUE CIBLE (Target) -> RETOUR IMMÉDIAT ---
  // ------------------------------------------------------------------------------

  // 1. Gestdown (SÉRIES SEULEMENT) - Langue Cible
  if (type === 'series' && season && episode && tmdbApiKey) {
      let gestdownTargetSubtitle = await findSubtitleUrlsGestdown(imdbid, season, episode, targetLangCode3Letter, tmdbApiKey);
      if (gestdownTargetSubtitle) {
          console.log(`[STRATEGY 1/8] Gestdown found the target language subtitle (${targetLangCode3Letter}).`);
          return [gestdownTargetSubtitle];
      }
  }

  // 2. OSV3 - Langue Cible
  const targetLangSubtitleOSV3 = findSubtitleInList(subtitlesFromOSV3, targetLangCode3Letter);
  if (targetLangSubtitleOSV3) {
    console.log(`[STRATEGY 2/8] OSV3 found the target language subtitle (${targetLangCode3Letter}).`);
    return [{ url: targetLangSubtitleOSV3.url, lang: targetLangSubtitleOSV3.lang }];
  }

  // 3. Wyzie - Langue Cible
  let wyzieTargetSubtitle = await findSubtitleUrlsWyzie(imdbid, targetLangCode3Letter);
  if (wyzieTargetSubtitle) {
      console.log(`[STRATEGY 3/8] Wyzie found the target language subtitle (${targetLangCode3Letter}).`);
      return [wyzieTargetSubtitle];
  }


  // ------------------------------------------------------------------------------
  // --- PARTIE 2: RECHERCHE de la LANGUE SOURCE (Anglais - ENG) -> TRADUCTION ---
  // ------------------------------------------------------------------------------
  
  // 4. Gestdown (SÉRIES SEULEMENT) - Anglais
  if (type === 'series' && season && episode && tmdbApiKey) {
      let gestdownEnglishSubtitle = await findSubtitleUrlsGestdown(imdbid, season, episode, englishCode3Letter, tmdbApiKey);
      if (gestdownEnglishSubtitle) {
          console.log('[STRATEGY 4/8] Gestdown found an English subtitle (source for translation).');
          return [gestdownEnglishSubtitle];
      }
  }

  // 5. OSV3 - Anglais
  const englishSubtitleOSV3 = findSubtitleInList(subtitlesFromOSV3, englishCode3Letter);
  if (englishSubtitleOSV3) {
    console.log('[STRATEGY 5/8] OSV3 found an English subtitle (source for translation).');
    return [{ url: englishSubtitleOSV3.url, lang: englishSubtitleOSV3.lang }];
  }
  
  // 6. Wyzie - Anglais
  let wyzieEnglishSubtitle = await findSubtitleUrlsWyzie(imdbid, englishCode3Letter);
  if (wyzieEnglishSubtitle) {
      console.log('[STRATEGY 6/8] Wyzie found an English subtitle (source for translation).');
      return [wyzieEnglishSubtitle];
  }

  // ------------------------------------------------------------------------------
  // --- PARTIE 3: RECHERCHE ULTIME (First Language) -> TRADUCTION ---
  // ------------------------------------------------------------------------------

  // 7. Premier sous-titre disponible sur OSV3 (n'importe quelle langue)
  if (subtitlesFromOSV3.length > 0) {
      const firstAvailableSubtitle = subtitlesFromOSV3[0];
      const lang3LetterFallback = to3LetterCode(firstAvailableSubtitle.lang) || firstAvailableSubtitle.lang;
      console.log(`[STRATEGY 7/8] OSV3 returned a subtitle in a different language (${lang3LetterFallback}) as last resort for translation.`);
      return [{ url: firstAvailableSubtitle.url, lang: lang3LetterFallback }];
  }
  
  // 8. Wyzie - Premier sous-titre disponible (n'importe quelle langue)
  let wyzieFirstLangSubtitle = await findSubtitleUrlsWyzie(imdbid, null); 
  if (wyzieFirstLangSubtitle) {
       console.log(`[STRATEGY 8/8] Wyzie found a subtitle in a different language (${wyzieFirstLangSubtitle.lang}) as last resort.`);
       return [wyzieFirstLangSubtitle];
  }


  // Si rien n'est trouvé après toutes les tentatives
  console.log('No subtitles found on any source after exhausting all strategies.');
  return null;
};

module.exports = { getsubtitles, downloadSubtitles };
