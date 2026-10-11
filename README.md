# CSE EduDocs

Academic archive for the Department of Computer Science & Engineering, Pabna University of
Science and Technology (PUST): undergraduate/master's theses, conference and journal papers,
student software/hardware projects, faculty researcher profiles, and direct messaging.

## Features

- **Search inside PDFs**: every uploaded PDF is read page by page. Digital PDFs use their text
  layer; scanned theses go through OCR (Tesseract, Bangla + English) in the background. Search
  results show the matching sentence and page number, and open the PDF at that page. Typo- and
  OCR-error tolerant, works for Bangla and English.
- **AI upload assistant**: after choosing a PDF, "Auto-fill with AI" reads the first pages (OCR if
  scanned) and fills title, authors, supervisor, type, year, pages, keywords, abstract and track.
- **Ask the archive (AI)**: open to visitors too (per-IP daily limit). Questions in English or Bangla are answered only from the stored
  theses, with numbered citations that open the exact page. Works with free AI APIs (Groq, Gemini,
  OpenRouter, Cerebras) or a local Ollama server, with automatic fallback and daily limits.
- **Papers library**: upload PDFs with authors, supervisor, co-supervisor, type, keywords and
  abstract; search and filter by type, research track and year; in-browser PDF preview; BibTeX /
  APA / IEEE citations; bookmarks; view and download counts.
- **Projects showcase**: software, hardware and IoT projects with team, supervisor, batch, tech
  stack, image gallery and GitHub/demo links.
- **Profiles**: personal dashboard (my uploads, bookmarks), account settings, researcher profile.
- **Chat**: one-to-one messages between registered users.
- **Admin panel**: manage papers (edit, hide, delete), projects (feature, delete), users (roles,
  block, delete), FAQs and site branding.
- **Roles**: student, teacher, editor, admin. People sign up as student or teacher; admins grant
  editor/admin.

## Tech stack

React 19 · Vite 6 · Tailwind CSS v4 · lucide-react · Express 4 · MongoDB (with a JSON
file copy) · poppler + Tesseract OCR · any OpenAI-compatible LLM API · TypeScript · Docker.

## Project structure

```text
├── src/
│   ├── components/      # One file per page (HomeView, PapersView, ProjectsView, AdminView, ...)
│   ├── lib/api.ts       # All calls to the backend
│   ├── types.ts         # Shared data types (also used by the server)
│   └── App.tsx          # Page switching and global state
├── server.ts            # Express API + serves the built React app
├── server-db.ts         # In-memory state, JSON file, MongoDB sync, password hashing, tokens
├── server-config.ts     # Environment variables and storage folders
├── server-ocr.ts        # PDF text extraction + OCR queue (text stored in DATA_DIR/text)
├── server-search.ts     # Full-text search index (BM25, Bangla tokenizer, typo tolerance)
├── server-ai.ts         # AI providers, daily limits, upload assistant, Ask the archive
├── server-files.ts      # Uploaded files on disk or in MongoDB (GridFS)
├── render.yaml          # Render Blueprint (free hosting from GitHub)
├── Dockerfile           # Production image
├── docker-compose.yml   # App + MongoDB
├── NAS_DEPLOYMENT.md    # QNAP NAS guide
└── CLOUD_DEPLOYMENT.md  # Ubuntu VM / Oracle Cloud guide with HTTPS (Caddy)
```

## Run locally

```bash
npm install
cp .env.example .env     # optional for local dev (AI keys go here)
npm run dev              # http://localhost:3000
```

Searching inside PDFs needs the PDF/OCR tools on your machine (the Docker image already has them):

```bash
sudo apt install poppler-utils tesseract-ocr tesseract-ocr-ben   # Ubuntu/Debian/WSL
```

Without them the site still works; only PDF text search and the upload assistant are disabled.

Without MongoDB running, development uses only the JSON file in `./data/`.
A new local database gets sample papers/projects and an admin account:
`admin@cse.pust.ac.bd` / `adminpassword2026` (dev only).

## Production

```bash
npm run build            # dist/ (React) + dist-server/server.cjs (API)
npm start
```

Free hosting from GitHub (Render + MongoDB Atlas): **[RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md)**.
For a cloud server with HTTPS see **[CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md)**; for a QNAP NAS see **[NAS_DEPLOYMENT.md](NAS_DEPLOYMENT.md)**.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `JWT_SECRET` | random per start (prod) | Signs login tokens. Set it in production. |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/research_archive` | MongoDB connection |
| `REQUIRE_MONGODB` | `false` | Exit if MongoDB is unreachable |
| `DATA_DIR` / `UPLOAD_DIR` / `DB_BACKUP_FILE` | `./data`, `./data/uploads`, `./data/archive-database.json` | Storage |
| `ADMIN_EMAIL` | `admin@cse.pust.ac.bd` | First admin account |
| `ADMIN_DEFAULT_PASSWORD` | random (printed in log) | First admin password |
| `ADMIN_EMAILS` | — | Extra emails that are always admin |
| `SEED_DEMO_DATA` | `true` in dev, `false` in prod | Sample content for a new database |
| `FILE_STORAGE` | `local` | `local` = disk, `mongo` = uploaded files stored in MongoDB (GridFS) |
| `MAX_UPLOAD_MB` | `50` | Largest allowed upload |
| `PDF_TEXT_ENABLED` | `true` | `false` = don't read text inside PDFs (no OCR, no in-PDF search, no AI auto-fill) |
| `OCR_LANGS` | `ben+eng` | Tesseract languages for scanned PDFs |
| `OCR_THREADS` / `OCR_DPI` / `OCR_MAX_PAGES` | `2` / `300` / `400` | OCR speed and limits |
| `AI_PROVIDER_{1,2,3}_{NAME,URL,KEY,MODEL}` | — | OpenAI-compatible AI APIs, tried in order. Empty = AI off |
| `AI_USER_DAILY_LIMIT` / `AI_GLOBAL_DAILY_LIMIT` | `30` / `800` | AI requests per user / per site per day |
| `AI_ALLOW_GUESTS` / `AI_GUEST_DAILY_LIMIT` | `true` / `10` | Ask AI without login, limited per visitor IP per day |
| `AI_CONTEXT_CHARS` / `AI_METADATA_PAGES` | `9000` / `6` | Text sent per question / pages read by auto-fill |

## License

MIT
