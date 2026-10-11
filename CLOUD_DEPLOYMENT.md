# CSE EduDocs — Permanent Cloud Deployment (Ubuntu VM + HTTPS)

One server runs everything: the React frontend, the Express API, MongoDB, OCR and HTTPS.
The same Docker setup later moves to the NAS unchanged (see `NAS_DEPLOYMENT.md`).

```
Internet ──https──► Caddy (ports 80/443, free Let's Encrypt certificate)
                       │
                       ▼
                 research_archive_app (frontend + API + OCR)  ──► research_archive_mongo
                       │                                              │
                server-data/app-data                          server-data/mongo-data
```

---

## 1. What you need

| Thing | Free option | Notes |
|---|---|---|
| Linux server | **Oracle Cloud Always Free** Ampere A1 VM (2 OCPU, 12 GB RAM) | Needs a card for identity verification. Any Ubuntu VPS works the same (Hetzner, DigitalOcean, ~$5/month). Minimum: 2 CPU, 4 GB RAM, 40 GB disk |
| Domain name | **DuckDNS** free subdomain (`yourname.duckdns.org`) | Or your own domain (an `A` record pointing to the server IP) |
| AI key | Groq free key | Create a **new** key for the server |

---

## 2. Create the server (Oracle Cloud)

1. Sign up at cloud.oracle.com and pick a home region close to Bangladesh (e.g. Singapore or Mumbai).
   The home region cannot be changed later.
2. **Compute → Instances → Create instance**
   - Image: **Ubuntu 24.04** (Canonical)
   - Shape: **Ampere → VM.Standard.A1.Flex**, 2 OCPU, 12 GB memory
   - Networking: create a new VCN with a public subnet, **assign a public IPv4 address**
   - SSH keys: **Save private key** (download the `.key` file, keep it safe)
   - Boot volume: 50–100 GB (Always Free allows up to 200 GB in total)
   - If it says *Out of capacity*, try another availability domain or try again later.
3. Note the **Public IP address** shown on the instance page.
4. Open ports 80 and 443: **Instance → Subnet → Security list → Add ingress rules**
   - Source CIDR `0.0.0.0/0`, IP protocol TCP, destination port `80`
   - Source CIDR `0.0.0.0/0`, IP protocol TCP, destination port `443`

## 3. Point a domain at the server

**DuckDNS (free):** sign in at duckdns.org, create a subdomain (e.g. `pustcse-archive`), put the
server's public IP in the *current ip* box and click *update ip*.
Your site will be `https://pustcse-archive.duckdns.org`.

**Own domain:** add an `A` record → server public IP.

Check from your laptop (PowerShell): `nslookup pustcse-archive.duckdns.org` must show the server IP.

## 4. Connect from Windows

PowerShell (OpenSSH is built into Windows 10/11):

```powershell
# fix key permissions once (otherwise ssh refuses the key)
icacls C:\Users\HP\Downloads\ssh-key.key /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i C:\Users\HP\Downloads\ssh-key.key ubuntu@<SERVER-IP>
```

## 5. Prepare the server (run on the server)

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install unzip

# Oracle Ubuntu images block ports with iptables even after step 2.4 — open 80/443:
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit        # log out and ssh in again so the docker group applies
```

## 6. Upload the project

From your laptop (PowerShell), copy the zip — **without** `node_modules`, `data`, `.env`:

```powershell
scp -i C:\Users\HP\Downloads\ssh-key.key research-archive-v1.3.zip ubuntu@<SERVER-IP>:~
```

On the server:

```bash
unzip research-archive-v1.3.zip
cd research-archive
mkdir -p server-data/app-data/uploads server-data/mongo-data
sudo chown -R 1000:1000 server-data/app-data
```

(Better long-term: push the project to a **private** GitHub repo and `git clone` it on the server,
then updates are just `git pull`. `.gitignore` already keeps `.env` and data out of git.)

## 7. Configure `.env`

```bash
cp .env.example .env
openssl rand -hex 32          # copy the output for JWT_SECRET
openssl rand -hex 16          # copy the output for the MongoDB password
nano .env
```

Set these (leave the rest as they are):

```ini
SITE_DOMAIN=pustcse-archive.duckdns.org
APP_PORT=127.0.0.1:3000

JWT_SECRET=<first openssl output>
MONGO_INITDB_ROOT_PASSWORD=<second openssl output>

ADMIN_EMAIL=your.email@example.com
ADMIN_DEFAULT_PASSWORD=
SEED_DEMO_DATA=false

NAS_APP_DATA_PATH=./server-data/app-data
NAS_MONGO_DATA_PATH=./server-data/mongo-data

OCR_THREADS=2

AI_PROVIDER_1_NAME=groq
AI_PROVIDER_1_URL=https://api.groq.com/openai/v1
AI_PROVIDER_1_KEY=<new Groq key>
AI_PROVIDER_1_MODEL=openai/gpt-oss-20b
```

`Ctrl+O`, `Enter` saves, `Ctrl+X` exits nano.
**Do not change `JWT_SECRET` or the MongoDB password after the first start.**

## 8. Start

```bash
echo "alias dc='docker compose -f docker-compose.yml -f docker-compose.cloud.yml'" >> ~/.bashrc
source ~/.bashrc

dc up -d --build        # first build: 10–20 minutes on a 2-core ARM server
dc ps                   # app and mongo "healthy", caddy "running"
```

Get the admin password that was generated on first start:

```bash
docker logs research_archive_app 2>&1 | grep -A2 "Initial admin"
```

Open `https://pustcse-archive.duckdns.org`, log in, and **change the password** (Profile →
Profile Credentials).

Check the log once:

```bash
docker logs research_archive_app 2>&1 | grep -E "OCR\]|AI\]|MongoDB"
# [OCR] poppler=true tesseract=true languages=ben+eng
# [AI] Enabled with groq
# [Database] Connected successfully to MongoDB!
```

## 9. Updating the site

```bash
cd ~/research-archive
# copy the new code over (git pull, or unzip the new version over this folder —
# never overwrite .env or server-data/)
dc up -d --build
```

Users, uploads, OCR text and the database are kept.

## 10. Backups (important)

```bash
mkdir -p ~/backups
cat > ~/backup.sh <<'EOF2'
#!/bin/bash
set -e
D=$(date +%Y%m%d)
cd ~/research-archive
docker exec research_archive_mongo sh -c \
  'mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db research_archive --archive' \
  > ~/backups/mongo_$D.archive
sudo tar czf ~/backups/app-data_$D.tar.gz server-data/app-data
ls -t ~/backups/* | tail -n +15 | xargs -r rm --   # keep the newest 14 files
EOF2
chmod +x ~/backup.sh
(crontab -l 2>/dev/null; echo "30 3 * * * $HOME/backup.sh") | crontab -
```

This makes a daily backup at 03:30 on the server. **Also copy `~/backups` to your laptop or
Google Drive now and then** — a backup on the same server does not survive losing the server:

```powershell
scp -i C:\Users\HP\Downloads\ssh-key.key -r ubuntu@<SERVER-IP>:~/backups D:\archive-backups
```

## 11. Moving to the NAS later

Copy `server-data/app-data` and the latest Mongo backup to the NAS, then follow
`NAS_DEPLOYMENT.md`. The app re-imports everything from `app-data/archive-database.json` if it
starts with an empty MongoDB, so copying `app-data` alone is enough to move all records.

## 12. Troubleshooting

| Problem | Fix |
|---|---|
| Browser shows a certificate error / site not reachable | `nslookup` must return the server IP; ports 80/443 open in **both** the Oracle security list and iptables (step 5); `docker logs research_archive_caddy` |
| `dc up` says *Set SITE_DOMAIN* / *Set JWT_SECRET* | Value missing in `.env` |
| App exits with `[Storage] FATAL ... not writable` | `sudo chown -R 1000:1000 server-data/app-data` |
| AI "busy or unavailable" | `docker logs research_archive_app 2>&1 \| grep AI` shows the provider's error (model name, key) |
| Build killed / very slow | Make sure the VM really has ≥4 GB RAM; on 1 GB VPSs add swap |
