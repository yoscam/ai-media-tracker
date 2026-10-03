# MediaShelf

A self-hosted tracker for movies, TV shows, anime, manga, books and games, with
recommendations that learn from your ratings.

Everything lives in a single SQLite file you own. There are no accounts and no telemetry.
It has a single optional password (`APP_PASSWORD`); set it, or put the app behind a
reverse proxy with auth, if you expose it beyond your LAN.

## Features

- **Library** for six media types with status (planning, in progress, completed,
  paused, dropped), 1-10 ratings, progress, notes, filters and sorting.
- **Search and add** from public metadata sources: AniList (anime, manga), Open Library
  (books) and, for movies and TV, Cinemeta (the keyless IMDb-backed catalog behind
  Stremio). If you set a free TMDB key it is used for movies and TV instead. Games and
  anything else can be added by hand.
- **Sync** (header button or `POST /api/sync`) fills in posters, genres, descriptions and
  provider ids for hand-added titles without touching your status, rating or notes.
  `POST /api/sync?force=1` refreshes every title.
- **Taste profile** built from your ratings: favourite genres, genres you avoid, creators
  you keep coming back to.
- **Recommendations** in two modes:
  - *AI mode*: any OpenAI-compatible model (OpenAI, OpenRouter, Ollama, LM Studio, ...)
    receives your taste profile and returns picks with a one-line reason each. Every pick
    is verified against a metadata provider where one exists, so invented titles are
    dropped, and anything already in your library or previously dismissed is excluded.
  - *Local mode* (no key needed): candidates are pulled from the metadata providers for
    your top genres and ranked against your taste profile.
- **Export** your whole library as JSON at `/api/export`.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: add AI / TMDB keys
npm run dev                  # http://localhost:47213
```

With an empty library the home page offers a **Load sample library** button so you can
try the recommendations straight away.

Production:

```bash
npm run build
npm start
```

### Docker

```bash
cp .env.example .env   # optional
docker compose up -d --build
```

The database is stored in the `mediashelf-data` volume (`/data/media.db`).

## Configuration

| Variable | Purpose |
| --- | --- |
| `AI_API_KEY` | Key for an OpenAI-compatible API (`OPENAI_API_KEY` also works). Enables AI mode. |
| `AI_BASE_URL` | Custom endpoint, e.g. `http://localhost:11434/v1` for Ollama. Setting it alone also enables AI mode. |
| `AI_MODEL` | Model name. Defaults to `gpt-4o-mini`. |
| `TMDB_API_KEY` | Optional. Use TMDB instead of Cinemeta for movie and TV search and discovery. |
| `APP_PASSWORD` | When set, the whole app (pages and API) requires HTTP Basic auth. `APP_USERNAME` defaults to `admin`. |
| `DATA_DIR` | Directory for the SQLite database. Defaults to `./data`. |

If the AI endpoint fails, MediaShelf falls back to local mode and tells you why.

## HTTP API

| Route | Description |
| --- | --- |
| `GET /api/entries`, `POST /api/entries` | List or create library entries |
| `PATCH /api/entries/:id`, `DELETE /api/entries/:id` | Update or remove an entry |
| `GET /api/search?type=anime&q=...` | Search metadata providers |
| `GET /api/taste` | Computed taste profile |
| `GET /api/recommendations`, `POST /api/recommendations` | Read or generate picks (`{"type":"all","count":8}`) |
| `DELETE /api/recommendations/:id` | Dismiss a pick for good |
| `POST /api/sync` | Enrich hand-added titles from metadata providers (`?force=1` for all) |
| `GET /api/export` | Download everything as JSON |

## How taste is computed

Each title gets an affinity from -1 to 1: a rating of 10 is +1, 5.5 is neutral and 1 is
-1. Unrated completed titles count a little positive, dropped ones negative, planned ones
not at all. Genre scores are the average affinity weighted by how often you consume the
genre. Those scores drive both the local ranking and the profile sent to the model.

## Why not fork Yamtrack or another tracker?

Yamtrack (Django) and similar projects are excellent and more feature-rich in tracking
(calendars, many more providers, imports). This repo starts from a small TypeScript
codebase instead so the recommendation engine can be a first-class part of the data model
rather than a bolt-on. If you want Yamtrack's breadth, its public API could be used as an
import source later.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, SQLite via `better-sqlite3`,
Vercel AI SDK with the OpenAI-compatible provider.
