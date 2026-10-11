# CSE EduDocs — QNAP NAS Deployment Guide

How to run CSE EduDocs on a QNAP NAS with **Container Station** and **Docker Compose**.

---

## 1. What runs where

```
 Browser ──► NAS :APP_PORT (default 3000)
                 │
         ┌───────▼─────────────────┐        ┌────────────────────────┐
         │  research_archive_app   │ ─────► │ research_archive_mongo │
         │  Node 22 + Express +    │ (internal Docker network,      │
         │  built React app        │  port not published)           │
         └───────┬─────────────────┘        └──────────┬─────────────┘
                 │ /app-data                           │ /data/db
         NAS: .../app-data                     NAS: .../mongo-data
         ├── uploads/  (PDFs, images)          (MongoDB files)
         └── archive-database.json (JSON copy of the database)
```

- **MongoDB** is the main database. The app keeps everything in memory, writes a JSON
  copy to `app-data/archive-database.json` on every change, and syncs to MongoDB about
  once per second.
- **Uploads** (thesis PDFs, cover images, profile photos) are stored in `app-data/uploads`.
- Both folders live on the NAS, so rebuilding or updating the containers never deletes data.

---

## 2. Prerequisites

1. QNAP NAS with QTS 5.0+ / QuTS hero and **Container Station 3.x** (App Center).
2. A shared folder for containers, e.g. `Container` → `/share/Container`.
3. SSH enabled: *Control Panel → Network & File Services → Telnet / SSH*.
4. **Check the CPU for AVX** (needed by MongoDB 5.0 and newer):
   ```bash
   grep -o -m1 avx /proc/cpuinfo || echo "NO AVX -> use MONGO_IMAGE=mongo:4.4"
   ```
   Many NAS models (Celeron J-series, Atom, ARM) have no AVX. In that case set
   `MONGO_IMAGE=mongo:4.4` in `.env`, otherwise the Mongo container keeps restarting.

---

## 3. Folders and permissions

```bash
mkdir -p /share/Container/research-archive/app-data/uploads
mkdir -p /share/Container/research-archive/mongo-data

# The app runs as uid 1000 (the "node" user), so it must own app-data:
chown -R 1000:1000 /share/Container/research-archive/app-data
```

If you cannot change ownership on your NAS, set `APP_UID=0` and `APP_GID=0` in `.env`
(the app then runs as root inside the container).

> The app refuses to start in production if `app-data` is not writable. Older versions
> silently saved uploads inside the container instead, and they were lost on restart.

---

## 4. Copy the project and configure `.env`

Copy the project folder to the NAS (File Station upload, `scp`, or `git clone`), e.g. to
`/share/Container/research-archive/app`, then:

```bash
cd /share/Container/research-archive/app
cp .env.example .env
openssl rand -hex 32        # paste the output into JWT_SECRET
vi .env                     # or edit with File Station / Text Editor
```

Required values in `.env`:

| Variable | What to put |
|---|---|
| `JWT_SECRET` | Output of `openssl rand -hex 32`. Keep it the same forever, otherwise everyone gets logged out. |
| `MONGO_INITDB_ROOT_PASSWORD` | A strong password. **Only used the first time** Mongo creates its database. |
| `ADMIN_EMAIL` | Email for the first admin account. |
| `NAS_APP_DATA_PATH` / `NAS_MONGO_DATA_PATH` | The two folders from step 3. |
| `MONGO_IMAGE` | `mongo:7.0`, or `mongo:4.4` if the CPU has no AVX. |
| `SEED_DEMO_DATA` | `false` for the real site (`true` adds sample papers for testing). |

---

## 5. Start it

### Option A — SSH (recommended)

```bash
cd /share/Container/research-archive/app
docker compose up -d --build
docker compose ps            # both containers should become "healthy"
```

The first build downloads Node and npm packages, so it can take several minutes on a NAS.

### Option B — Build on your PC, load on the NAS

Useful if the NAS is slow or has no internet. Check the NAS CPU first: Intel/AMD = `linux/amd64`,
ARM = `linux/arm64`.

```bash
# On your PC, in the project folder
docker buildx build --platform linux/amd64 -t research-archive-app:latest --load .
docker save research-archive-app:latest -o research-archive-app.tar
# Copy the .tar to the NAS, then on the NAS:
docker load -i research-archive-app.tar
docker compose up -d          # no --build: it uses the loaded image
```

### Option C — Container Station UI

*Applications → Create* → paste `docker-compose.yml` and enter the values from `.env`.
The UI cannot build from a Dockerfile in every version, so use Option B to load the image first.

---

## 6. First login

If `ADMIN_DEFAULT_PASSWORD` was left empty, a random password is printed once:

```bash
docker logs research_archive_app | grep -A2 "Initial admin"
```

Log in with `ADMIN_EMAIL` + that password, then change it under **Profile → Profile Credentials**.

Other people register themselves as student or teacher. An admin can promote them to editor or
admin from **Admin → Users**.

### Password resets

The app does not send email yet. When someone uses *Forgot password*, the 6-digit code
(valid 15 minutes) is written to the app log; the admin can read it and pass it on:

```bash
docker logs research_archive_app 2>&1 | grep "Password reset"
```

---

## 7. Searching inside PDFs and the AI assistant

### OCR (built in)
The Docker image already contains poppler and Tesseract with English + Bangla. Every uploaded PDF
is queued and read page by page in the background, one paper at a time:

- Digital PDFs (exported from Word/LaTeX) take a few seconds.
- Scanned PDFs need OCR: roughly **3–10 seconds per page** on a NAS CPU, so a 60-page scanned thesis
  takes about 3–10 minutes. Existing papers are processed automatically after the first start;
  a few hundred scanned theses can take **one to two days** in total. The site works normally
  meanwhile, and each paper becomes searchable as soon as it is done.
- Progress: **Admin → Papers** shows "OCR 12/60", and `curl http://<NAS-IP>:3000/api/health`
  shows the queue length.
- A Bangla PDF typed in Bijoy/SutonnyMJ fonts gives garbled text: in **Admin → Papers**,
  **Shift+click** the ↻ button to force OCR on every page of that paper.
- The extracted text is saved in `app-data/text/` (back it up with the rest of `app-data`).
- Mostly English theses? Set `OCR_LANGS=eng` — faster and more accurate.

### AI (optional, free tiers work)
1. Create a free API key, e.g. at console.groq.com (Groq) and aistudio.google.com (Gemini).
2. In `.env`, fill `AI_PROVIDER_1_URL`, `_KEY`, `_MODEL` (and optionally provider 2 as a
   fallback). The URLs are listed in `.env.example`; copy a current model id from the provider's
   model list.
3. `docker compose up -d` — the log shows `[AI] Enabled with groq, gemini`.

Users must be logged in to use AI. `AI_USER_DAILY_LIMIT` (default 30/day) and
`AI_GLOBAL_DAILY_LIMIT` (default 800/day) keep the free quota from running out.
If the department has a PC with a GPU, run Ollama there and use
`AI_PROVIDER_1_URL=http://<pc-ip>:11434/v1` for unlimited, private AI.

> Free tiers change their limits often, and some (e.g. Gemini free) may use prompts to improve
> their products. Questions and thesis excerpts are sent to the provider you configure.

---

## 8. Health check and logs

```bash
curl http://<NAS-IP>:3000/api/health
docker logs -f research_archive_app
docker logs -f research_archive_mongo
```

A healthy response looks like:
```json
{ "status": "ok", "database": "connected", "environment": "production",
  "storage": { "uploads": "ready", "dataDir": "ready" } }
```

---

## 9. Updating

```bash
cd /share/Container/research-archive/app
# copy in the new code (or git pull), then:
docker compose up -d --build
```

Data in `app-data` and `mongo-data` is kept.

## 10. Backups

1. **Uploads + JSON copy:** back up `/share/Container/research-archive/app-data` with
   Hybrid Backup Sync (HBS 3) or `rsync`. The JSON file alone is enough to restore all
   records if MongoDB is lost (start the app with an empty Mongo and it re-imports the JSON).
2. **MongoDB dump:**
   ```bash
   docker exec research_archive_mongo sh -c \
     'mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
      --authenticationDatabase admin --db research_archive --archive' \
     > research_archive_$(date +%Y%m%d).archive
   ```

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `docker compose` says "Set JWT_SECRET in .env" | Required value missing | Fill in `.env` (step 4) |
| Mongo container restarts forever, log mentions AVX / "Illegal instruction" | CPU has no AVX | `MONGO_IMAGE=mongo:4.4`, delete the contents of `mongo-data`, start again |
| App exits with `[Storage] FATAL ... not writable` | NAS folder permissions | `chown -R 1000:1000 .../app-data`, or `APP_UID=0` / `APP_GID=0` |
| `/api/health` shows `database: "disconnected"` | Wrong Mongo password, or the password was changed after the first start | Mongo only reads `MONGO_INITDB_ROOT_*` on first start. Use the original password or reset `mongo-data` |
| Everyone gets logged out after a restart | `JWT_SECRET` changed or empty | Set a fixed `JWT_SECRET` |
| Port 3000 already used | Another NAS app on 3000 | `APP_PORT=3080` in `.env` |
| "Ask AI" missing from the menu | No AI provider configured | Fill `AI_PROVIDER_1_*` in `.env`, restart |
| AI says "busy or unavailable" | Free-tier rate limit hit or wrong key/model | `docker logs research_archive_app \| grep AI` shows the provider's error; add a second provider |
| Bangla search finds nothing in a PDF | Bijoy-font PDF (garbled text layer) | Admin → Papers → Shift+click ↻ to force OCR |
