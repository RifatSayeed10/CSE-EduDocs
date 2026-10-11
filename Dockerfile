# ---------- 1) Build stage: install everything, build client + server ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# npm ci needs package-lock.json to match package.json exactly. If it doesn't
# (e.g. a dependency was added without re-running npm install), fall back to npm install.
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .
# dist/         -> React app (static files)
# dist-server/  -> bundled Express server (kept out of the public folder)
RUN npm run build \
 && npm prune --omit=dev --no-audit --no-fund

# ---------- 2) Runtime stage: only what is needed to run ----------
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app-data \
    UPLOAD_DIR=/app-data/uploads \
    DB_BACKUP_FILE=/app-data/archive-database.json

# PDF text extraction (poppler) + OCR for scanned PDFs (Tesseract, English + Bangla)
RUN apk add --no-cache poppler-utils tesseract-ocr tesseract-ocr-data-eng tesseract-ocr-data-ben

# Persistent folder for uploads + JSON backup (mount a NAS folder here)
RUN mkdir -p /app-data/uploads && chown -R node:node /app-data

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/dist-server ./dist-server

# Run as the unprivileged "node" user (uid 1000)
USER node

EXPOSE 3000
VOLUME ["/app-data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1

CMD ["node", "dist-server/server.cjs"]
