# 🇫🇷 Stremio Subtitle Translator

Bienvenue sur le dépôt de l'addon Stremio Subtitle Translator, qui utilise un puissant modèle de langage (LLM) pour fournir des sous-titres traduits dans n'importe quelle langue.

Cet addon est conçu pour :

1. **Prioriser** les sous-titres natifs.

2. **Traduire** à la volée en utilisant une source fiable (Anglais).

3. **Mettre en cache** les traductions pour une réutilisation immédiate.

## 🚀 Logique de Recherche et de Traduction (Stratégie en 8 Étapes)

Pour offrir la meilleure expérience possible, notre add-on utilise une **stratégie de recherche en 8 étapes** hautement optimisée. Cette logique garantit que nous privilégions toujours la langue cible native si disponible, et si la traduction est nécessaire, nous choisissons la source (généralement l'anglais) de la plus haute qualité.

Notre objectif principal est de trouver le sous-titre de la plus haute qualité disponible, en hiérarchisant les fournisseurs et les langues.

### Phase 1 : Retour Immédiat (Langue Cible)

Nous tentons d'abord de trouver directement le sous-titre dans la langue demandée par l'utilisateur (ex: Français, Allemand, etc.). Si l'une de ces étapes est réussie, le sous-titre est retourné **immédiatement** sans traduction.

| Étape | Fournisseur | Contenu | Langue recherchée | Résultat | 
| ----- | ----- | ----- | ----- | ----- | 
| **1** | **Gestdown** | Séries seulement | Langue Cible (ex: `fr`) | **Succès :** Sous-titre natif retourné. | 
| **2** | **OpenSubtitles V3 (OSV3)** | Films & Séries | Langue Cible | **Succès :** Sous-titre natif retourné. | 
| **3** | **Wyzie** | Films & Séries | Langue Cible | **Succès :** Sous-titre natif retourné. | 

### Phase 2 : Traduction Prioritaire (Langue Source Anglaise)

Si la langue cible n'est pas disponible, nous recherchons un sous-titre en **Anglais (`ENG`)**, car il est la source de traduction la plus fiable. Si l'une de ces étapes est réussie, le sous-titre est téléchargé et **traduit** avant d'être renvoyé à Stremio.

| Étape | Fournisseur | Contenu | Langue recherchée | Résultat | 
| ----- | ----- | ----- | ----- | ----- | 
| **4** | **Gestdown** | Séries seulement | Anglais (`eng`) | **Succès :** Sous-titre Anglais trouvé et traduit. | 
| **5** | **OpenSubtitles V3 (OSV3)** | Films & Séries | Anglais (`eng`) | **Succès :** Sous-titre Anglais trouvé et traduit. | 
| **6** | **Wyzie** | Films & Séries | Anglais (`eng`) | **Succès :** Sous-titre Anglais trouvé et traduit. | 

### Phase 3 : Traduction de Dernier Recours (Première Langue)

Si même la source anglaise est introuvable, nous prenons le **tout premier sous-titre de n'importe quelle langue** disponible. Bien que la qualité de la traduction puisse varier, cela garantit que l'utilisateur reçoit quelque chose plutôt que rien.

| Étape | Fournisseur | Contenu | Langue recherchée | Résultat | 
| ----- | ----- | ----- | ----- | ----- | 
| **7** | **OpenSubtitles V3 (OSV3)** | Films & Séries | Première langue disponible | **Succès :** Sous-titre trouvé (langue inconnue) et traduit. | 
| **8** | **Wyzie** | Films & Séries | Première langue disponible | **Succès :** Sous-titre trouvé (langue inconnue) et traduit. | 

Si toutes les 8 étapes échouent, aucun sous-titre n'est retourné.

*Note : Cette documentation est en cours de développement. Référez-vous aux logs et au code pour la configuration des clés API (OpenAI/Gemini, OpenSubtitles V3, etc.)*

# 
# 🇬🇧 Stremio Subtitle Translator

Welcome to the Stremio Subtitle Translator addon repository. This addon utilizes a powerful Large Language Model (LLM) to provide translated subtitles in any language.

This addon is designed to:

1. **Prioritize** native language subtitles.

2. **Translate** on the fly using a reliable source (English).

3. **Cache** translations for immediate reuse.

## 🚀 Search and Translation Logic (8-Step Strategy)

To offer the best possible experience, our addon uses a highly optimized **8-step search strategy**. This logic ensures that we always prioritize the native target language if available, and if translation is necessary, we select the highest quality source (typically English).

Our main goal is to find the highest quality available subtitle, prioritizing providers and languages.

### Phase 1: Immediate Return (Target Language)

We first attempt to find the subtitle directly in the language requested by the user (e.g., French, German, etc.). If any of these steps succeed, the subtitle is returned **immediately** without translation.

| Step | Provider | Content | Language Searched | Result | 
| ----- | ----- | ----- | ----- | ----- | 
| **1** | **Gestdown** | Series only | Target Language (e.g., `fr`) | **Success:** Native subtitle returned. | 
| **2** | **OpenSubtitles V3 (OSV3)** | Movies & Series | Target Language | **Success:** Native subtitle returned. | 
| **3** | **Wyzie** | Movies & Series | Target Language | **Success:** Native subtitle returned. | 

### Phase 2: Priority Translation (English Source Language)

If the target language is unavailable, we search for a subtitle in **English (`ENG`)**, as it is the most reliable translation source. If any of these steps succeed, the subtitle is downloaded and **translated** before being sent back to Stremio.

| Step | Provider | Content | Language Searched | Result | 
| ----- | ----- | ----- | ----- | ----- | 
| **4** | **Gestdown** | Series only | English (`eng`) | **Success:** English subtitle found and translated. | 
| **5** | **OpenSubtitles V3 (OSV3)** | Movies & Series | English (`eng`) | **Success:** English subtitle found and translated. | 
| **6** | **Wyzie** | Movies & Series | English (`eng`) | **Success:** English subtitle found and translated. | 

### Phase 3: Last Resort Translation (First Language)

If even the English source cannot be found, we take the **very first subtitle in any language** that is available. Although the translation quality may vary, this ensures the user receives something rather than nothing.

| Step | Provider | Content | Language Searched | Result | 
| ----- | ----- | ----- | ----- | ----- | 
| **7** | **OpenSubtitles V3 (OSV3)** | Movies & Series | First available language | **Success:** Subtitle found (unknown language) and translated. | 
| **8** | **Wyzie** | Movies & Series | First available language | **Success:** Subtitle found (unknown language) and translated. | 

If all 8 steps fail, no subtitle is returned.

*Note: This documentation is under development. Refer to the logs and code for API key configuration (OpenAI/Gemini, OpenSubtitles V3, etc.)*

Thanks to @sonsuzanime @HimAndRobot @heavy-baby for providing the original implementation that made this project possible.
