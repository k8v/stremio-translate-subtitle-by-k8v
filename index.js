const {
  addonBuilder,
  publishToCentral,
} = require("stremio-addon-sdk");
const opensubtitles = require("./opensubtitles");
const connection = require("./connection");
const languages = require("./languages");
const { createOrUpdateMessageSub } = require("./subtitles");
const translationQueue = require("./queues/translationQueue");
const baseLanguages = require("./langs/base.lang.json");
const isoCodeMapping = require("./langs/iso_code_mapping.json");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const SUBTITLES_DIR = path.join(process.cwd(), "subtitles"); // Chemin absolu du dossier de sous-titres

// 💡 NOUVELLE FONCTION : Calcule le chemin local du fichier SRT attendu
function getLocalFilePath(targetLanguage, imdbid, season, episode, provider) {
    const fileName = `${imdbid}-translated-${episode}-1.srt`;
    const folderPath = path.join(
        SUBTITLES_DIR,
        provider,
        targetLanguage,
        imdbid,
        `season${season}`
    );
    return path.join(folderPath, fileName);
}

// 💡 NOUVELLE FONCTION : Vérifie si le fichier existe et contient le message temporaire
function isTemporaryMessageFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return false;
    }
    
    try {
        const content = fs.readFileSync(filePath, "utf8");
        // Le message d'attente est connu et constant, vérifions sa présence.
        const temporaryMessage = "Translating subtitles. Please wait 1 minute and try again.";
        return content.includes(temporaryMessage);
    } catch (e) {
        console.error("Erreur lors de la lecture du fichier pour vérifier le message temporaire:", e.message);
        return false;
    }
}

function generateSubtitleUrl(
  targetLanguage,
  imdbid,
  season,
  episode,
  provider,
  baseUrl = process.env.BASE_URL
) {
  return `${baseUrl}/subtitles/${provider}/${targetLanguage}/${imdbid}/season${season}/${imdbid}-translated-${episode}-1.srt`;
}

const builder = new addonBuilder({
  id: "org.autotranslate.geanpn",
  version: "1.0.2",
  name: "Translate by k8v",
  logo: "https://i.postimg.cc/0y8d3jm0/traduire.png",
  behaviorHints: {
    configurable: true,
    configurationRequired: true,
  },
  config: [
    {
      key: "provider",
      type: "select",
      options: ["Google Translate", "OpenAI", "Google Gemini", "OpenRouter", "Groq", "Together AI", "Custom"],
    },
    {
      key: "translateto",
      type: "select",
      options: baseLanguages,
    },
    {
      key: "apikey",
      type: "text",
    },
    {
      key: "base_url",
      type: "text",
    },
    {
      key: "model_name",
      type: "text",
    },
	{
      key: "tmdb_apikey",
      type: "text",
    },
  ],
  description:
    "This addon takes subtitles from OpenSubtitlesV3 then translates into desired language using Google Translate, or ChatGPT (OpenAI Compatible Providers). For donations:in progress Bug report: geanpn@gmail.com",
  types: ["series", "movie"],
  catalogs: [],
  resources: ["subtitles"],
});

builder.defineSubtitlesHandler(async function (args) {
  console.log("Subtitle request received:", args);
  const { id, config, stream } = args;

  const tmdbApiKey = config.tmdb_apikey;

  const targetLanguage = languages.getKeyFromValue(
    config.translateto,
    config.provider
  );

  if (!targetLanguage) {
    console.log("Unsupported language:", config.translateto);
    return Promise.resolve({ subtitles: [] });
  }

  // Extract imdbid from id
  let imdbid = null;
  if (id.startsWith("dcool-")) {
    imdbid = "tt5994346";
  } else if (id !== null && id.startsWith("tt")) {
    const parts = id.split(":");
    if (parts.length >= 1) {
      imdbid = parts[0];
    } else {
      console.log("Invalid ID format.");
    }
  }

  if (imdbid === null) {
    console.log("Invalid ID format.");
    return Promise.resolve({ subtitles: [] });
  }

  const { type, season = null, episode = null } = parseId(id);

  try {
    // 💡 NOUVEAU: LOGIQUE DE ROBUSTESSE POUR FICHIER TEMPORAIRE
    const tempSrtPath = getLocalFilePath(
        targetLanguage,
        imdbid,
        season,
        episode,
        config.provider
    );

    if (isTemporaryMessageFile(tempSrtPath)) {
        console.log("Fichier temporaire 'en traduction...' trouvé. Suppression pour forcer une nouvelle tentative.");
        try {
            // Supprime le fichier temporaire
            fs.unlinkSync(tempSrtPath);
            // La recherche en DB se fera ensuite et échouera car le fichier n'existe plus,
            // forçant le flow à relancer la recherche OpenSubtitles et la mise en file d'attente.
        } catch (e) {
            // Si la suppression échoue, on continue.
            console.error("Erreur lors de la suppression du fichier temporaire:", e.message);
        }
    }

    // 1. Check if already exists in database
    const existingSubtitle = await connection.getsubtitles(
      imdbid,
      season,
      episode,
      targetLanguage
    );

    if (existingSubtitle.length > 0) {
      console.log(
        "Subtitle found in database:",
        generateSubtitleUrl(
          targetLanguage,
          imdbid,
          season,
          episode,
          config.provider
        )
      );
      return Promise.resolve({
        subtitles: [
          {
            id: `${imdbid}-subtitle`,
            url: generateSubtitleUrl(
              targetLanguage,
              imdbid,
              season,
              episode,
              config.provider
            ),
            lang: `${targetLanguage}-translated`,
          },
        ],
      });
    }

    // 2. If not found, search OpenSubtitles
    const subs = await opensubtitles.getsubtitles(
      type,
      imdbid,
      season,
      episode,
      targetLanguage,
	  tmdbApiKey
    );

    if (!subs || subs.length === 0) {
      await createOrUpdateMessageSub(
        "No subtitles found on OpenSubtitles",
        imdbid,
        season,
        episode,
        targetLanguage,
        config.provider
      );
      return Promise.resolve({
        subtitles: [
          {
            id: `${imdbid}-subtitle`,
            url: generateSubtitleUrl(
              targetLanguage,
              imdbid,
              season,
              episode,
              config.provider
            ),
            lang: `${targetLanguage}-translated`,
          },
        ],
      });
    }

    const foundSubtitle = subs[0];

    const mappedFoundSubtitleLang = isoCodeMapping[foundSubtitle.lang] || foundSubtitle.lang;

    if (mappedFoundSubtitleLang === targetLanguage) {
      console.log(
        "Desired language subtitle found on OpenSubtitles, returning it directly."
      );
      await connection.addsubtitle(
        imdbid,
        type,
        season,
        episode,
        foundSubtitle.url.replace(`${process.env.BASE_URL}/`, ""),
        targetLanguage
      );
      return Promise.resolve({
        subtitles: [
          {
            id: `${imdbid}-subtitle`,
            url: foundSubtitle.url,
            lang: foundSubtitle.lang,
          },
        ],
      });
    }

    console.log(
      "Subtitles found on OpenSubtitles, but not in target language. Translating..."
    );

    await createOrUpdateMessageSub(
      "Translating subtitles. Please wait 1 minute and try again.",
      imdbid,
      season,
      episode,
      targetLanguage,
      config.provider
    );

    // 3. Process and translate subtitles
    translationQueue.push({
      subs: [foundSubtitle], // Pass the found subtitle to the queue
      imdbid: imdbid,
      season: season,
      episode: episode,
      oldisocode: targetLanguage,
      provider: config.provider,
      apikey: config.apikey ?? null,
      base_url: config.base_url ?? "https://api.openai.com/v1/responses",
      model_name: config.model_name ?? "gpt-4o-mini",
    });

    console.log(
      "Subtitles processed",
      generateSubtitleUrl(
        targetLanguage,
        imdbid,
        season,
        episode,
        config.provider
      )
    );

    await connection.addsubtitle(
      imdbid,
      type,
      season,
      episode,
      generateSubtitleUrl(
        targetLanguage,
        imdbid,
        season,
        episode,
        config.provider
      ).replace(`${process.env.BASE_URL}/`, ""),
      targetLanguage
    );

    return Promise.resolve({
      subtitles: [
        {
          id: `${imdbid}-subtitle`,
          url: generateSubtitleUrl(
            targetLanguage,
            imdbid,
            season,
            episode,
            config.provider
          ),
          lang: `${targetLanguage}-translated`,
        },
      ],
    });
  } catch (error) {
    console.error("Error processing subtitles:", error);
    return Promise.resolve({ subtitles: [] });
  }
});

function parseId(id) {
  if (id.startsWith("tt")) {
    const match = id.match(/tt(\d+):(\d+):(\d+)/);
    if (match) {
      const [, , season, episode] = match;
      return {
        type: "series",
        season: Number(season),
        episode: Number(episode),
      };
    } else {
      return { type: "movie", season: 1, episode: 1 };
    }
  } else if (id.startsWith("dcool-")) {
    // New format: dcool-tomorrow-with-you::tomorrow-with-you-episode-1
    const match = id.match(/dcool-(.+)::(.+)-episode-(\d+)/);
    if (match) {
      const [, , title, episode] = match;
      return {
        type: "series",
        title: title,
        episode: Number(episode),
        season: 1, // Assuming season 1 for this format
      };
    }
  }
  return { type: "unknown", season: 0, episode: 0 };
}

// Comment out this line for local execution, uncomment for production deployment
// Cannot publish to central locally as there is no public IP, so it won't show up in the Stremio store

if (process.env.PUBLISH_IN_STREMIO_STORE == "TRUE") {
  publishToCentral(`http://${process.env.ADDRESS}/manifest.json`);
}

const port = process.env.PORT || 3000;
const address = process.env.ADDRESS || "0.0.0.0";
const express = require("express");
const cors = require("cors");
const getRouter = require("stremio-addon-sdk/src/getRouter");

const app = express();

app.use(cors());

app.use((_, res, next) => {
  res.setHeader("Cache-Control", "max-age=10, public");
  next();
});

app.get("/", (_, res) => {
  res.redirect("/configure");
});

app.get("/configure", (_req, res) => {
  fs.readFile("./configure.html", "utf8", (err, data) => {
    if (err) {
      res.status(500).send("Error loading configuration page");
      return;
    }

    const html = data
      .replace("<%= languages %>", JSON.stringify(baseLanguages))
      .replace(
        "<%= baseUrl %>",
        process.env.BASE_URL || `http://${address}:${port}`
      );

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });
});

app.use("/subtitles", express.static("subtitles"));

app.use(getRouter(builder.getInterface()));

const server = app.listen(port, address, () => {
  console.log(`Server started: http://${address}:${port}`);
  console.log("Manifest available:", `http://${address}:${port}/manifest.json`);
  console.log("Configuration:", `http://${address}:${port}/configure`);
});

server.on("error", (error) => {
  console.error("Server startup error:", error);
});
