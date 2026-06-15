# Deployment Notes — Magic Management

---

## Server 1 — dentask (OLD SERVER — DO NOT USE unless explicitly asked)

> **Ignore this server.** It is an old/legacy server kept only for intentional one-off testing
> when explicitly requested. All active development and deployments target Server 2.

Server: `103.191.209.34`
SSH: `ssh -i ~/.ssh/id_rsa -p 22 indorede1@103.191.209.34`
Project path: `/var/www/2ef0389c-f093-4f75-96a8-278253f21e49/magicmanagement.dentask.in`
Live URL: `https://magicmanagement.dentask.in`
Web server: LiteSpeed (not Apache — behaves differently)
DB: `indorede1_hoteldb` / user `indorede1_hoteluser`

---

## Server 2 — magicmanagement.in (MAIN SERVER — all deploys go here)

Server: `45.199.139.15`
SSH: `ssh -i ~/.ssh/id_rsa -p 22 magicman1@45.199.139.15`
Project path: `/var/www/7cdb3aaf-9f78-4a90-bba7-14c7d98d26f8/magicmanagement.in`
Live URL: `https://magicmanagement.in`
Web server: **LiteSpeed** (Ubuntu 24.04, PHP 8.2, MariaDB 11.4) — verified live 2026-06-15 via the
`server:` response header. (Earlier notes said "Apache 2.4" — that was wrong.) Because it's LiteSpeed,
the symlink / `.htaccess` gotchas in "Mistakes Made" #4 and #12 apply to this server too.
Host is a shared website container: you do NOT own the box (it reports 128 cores / 503GB but those
are shared), and `crontab` is unavailable ("Command unavailable in website container") — so there is
no OS-level cron or queue worker here. Realtime works only because broadcasts use `ShouldBroadcastNow`.
DB host: `localhost`
DB name: `magicman1_hoteldb`
DB user: `magicman1`
DB password: `za6AWjR3p4bLSHyw` (system-managed — check `~/.my.cnf` on server if it changes)

### Magic Tables (tables.magicmanagement.in)

Static React SPA — no backend, no PHP.
Path: `/var/www/7cdb3aaf-9f78-4a90-bba7-14c7d98d26f8/tables.magicmanagement.in/`
API points to: `https://magicmanagement.in/api` (set in `magic-tables-react/.env.production`)

```bash
# Redeploy Magic Tables
cd magic-tables-react && npm run build
rsync -avz -e "ssh -i ~/.ssh/id_rsa -p 22" dist/ magicman1@45.199.139.15:/var/www/7cdb3aaf-9f78-4a90-bba7-14c7d98d26f8/tables.magicmanagement.in/
```

### Safe Deploy — Server 2

```bash
SERVER2=magicman1@45.199.139.15
PATH2=/var/www/7cdb3aaf-9f78-4a90-bba7-14c7d98d26f8/magicmanagement.in
SSH="ssh -i ~/.ssh/id_rsa -p 22"

# 1. Build frontend (VITE_API_URL must point to magicmanagement.in)
cd frontend && npm run build

# 2. Sync backend (one dir at a time — never bootstrap/cache/)
rsync -avz -e "$SSH" backend/app/        $SERVER2:$PATH2/app/
rsync -avz -e "$SSH" backend/bootstrap/  $SERVER2:$PATH2/bootstrap/ --exclude=cache/
rsync -avz -e "$SSH" backend/config/     $SERVER2:$PATH2/config/
rsync -avz -e "$SSH" backend/database/   $SERVER2:$PATH2/database/
rsync -avz -e "$SSH" backend/resources/  $SERVER2:$PATH2/resources/
rsync -avz -e "$SSH" backend/routes/     $SERVER2:$PATH2/routes/
rsync -avz -e "$SSH" backend/storage/    $SERVER2:$PATH2/storage/

# 3. Sync frontend build (NO --delete)
# NOTE: sync root-level static files too — logo.svg, favicon, payment logos etc. live here
rsync -avz -e "$SSH" frontend/dist/index.html      $SERVER2:$PATH2/public/index.html
rsync -avz -e "$SSH" frontend/dist/assets/         $SERVER2:$PATH2/public/assets/
rsync -avz -e "$SSH" frontend/dist/logo.svg        $SERVER2:$PATH2/public/logo.svg
rsync -avz -e "$SSH" frontend/dist/logo-violet.svg $SERVER2:$PATH2/public/logo-violet.svg
rsync -avz -e "$SSH" frontend/dist/favicon.svg     $SERVER2:$PATH2/public/favicon.svg
rsync -avz -e "$SSH" frontend/dist/icons.svg       $SERVER2:$PATH2/public/icons.svg
rsync -avz -e "$SSH" frontend/dist/gpaylogo.svg    $SERVER2:$PATH2/public/gpaylogo.svg
rsync -avz -e "$SSH" frontend/dist/paytmlogo.webp  $SERVER2:$PATH2/public/paytmlogo.webp
rsync -avz -e "$SSH" frontend/dist/phonepelogo.png $SERVER2:$PATH2/public/phonepelogo.png
rsync -avz -e "$SSH" frontend/dist/sounds/         $SERVER2:$PATH2/public/sounds/

# 4. Clear stale cache, run migrations
$SSH $SERVER2 "cd $PATH2 && rm -f bootstrap/cache/services.php bootstrap/cache/packages.php && php artisan migrate --force && php artisan config:clear && php artisan route:clear && php artisan cache:clear && php artisan package:discover --ansi"

# 5. Storage symlink
$SSH $SERVER2 "cd $PATH2 && php artisan storage:link 2>&1 || true"
```

---

---

## Mistakes Made & Fixes

### 1. `rsync` with `--delete` wiped Laravel's `public/` files

**What happened:** Used `rsync --delete` to sync the React build (`dist/`) into `public/`. The `--delete` flag removed everything not in `dist/` — including `index.php`, `.htaccess`, and the `storage` symlink.

**Symptoms:** Site returned 404. API returned 404.

**Fix:**
- Manually restored `public/index.php` (Laravel entry point)
- Manually restored `public/.htaccess` (URL rewriting)
- Re-ran `php artisan storage:link`

**Rule going forward:** Never use `--delete` when syncing into `public/`. Only sync `assets/`, `index.html`, and `sounds/` individually — never the whole directory with delete.

```bash
# SAFE — sync only what changed
rsync -avz -e "ssh -i ~/.ssh/id_rsa -p 22" frontend/dist/assets/ $SERVER:$PATH/public/assets/
rsync -avz -e "ssh -i ~/.ssh/id_rsa -p 22" frontend/dist/index.html $SERVER:$PATH/public/index.html
```

---

### 2. Multiple files dumped flat into project root

**What happened:** Ran rsync with multiple source directories in one command:
```bash
rsync ... $LOCAL/routes/ $LOCAL/config/ $LOCAL/database/ $LOCAL/resources/ $SERVER:$PATH/
```
This dumped all files from all four directories flat into the project root (e.g., `api.php`, `services.php`, `migrations/` all at root level).

**Fix:** Deleted the misplaced files manually, then re-synced each directory to its correct target individually.

**Rule going forward:** Always sync one directory at a time with matching source → target:
```bash
rsync -avz ... $LOCAL/routes/   $SERVER:$PATH/routes/
rsync -avz ... $LOCAL/config/   $SERVER:$PATH/config/
rsync -avz ... $LOCAL/database/ $SERVER:$PATH/database/
```

---

### 3. `bootstrap/app.php` not synced — caused 500 on all APIs

**What happened:** Forgot to sync `bootstrap/app.php` which registers middleware aliases (`check.subscription`, etc.). The server had an older version without the new aliases.

**Symptoms:** All authenticated API routes returned 500. Log said: `Target class [check.subscription] does not exist`.

**Fix:** `rsync bootstrap/app.php` to server + `php artisan config:clear route:clear cache:clear`.

**Rule going forward:** Always include `bootstrap/app.php` in the sync checklist.

---

### 4. LiteSpeed does not follow symlinks ~~(SUPERSEDED — see #12)~~

**What happened:** `php artisan storage:link` creates a symlink `public/storage → storage/app/public`. LiteSpeed does not follow symlinks, so `/storage/branding/image.png` returned 404 even though the file existed.

`Options +FollowSymLinks` in `.htaccess` had no effect on LiteSpeed.

**Fix at the time:** Replaced the symlink with a real directory and copied files into it.

**See issue #12 for the correct long-term fix** — LiteSpeed actually does follow symlinks once the symlink is created properly.

---

### 5. Root `.htaccess` was routing `/storage/` through Laravel

**What happened:** The root-level `.htaccess` (above `public/`) had this rule:
```
RewriteCond %{REQUEST_URI} ^/(api|webhooks|storage)(/.*)?$ [NC]
RewriteRule ^(.*)$ public/index.php [L]
```
This forced all `/storage/...` requests through Laravel's `index.php`, returning HTML instead of the image file.

**Fix:** Removed `storage` from that RewriteCond:
```
RewriteCond %{REQUEST_URI} ^/(api|webhooks)(/.*)?$ [NC]
```

---

### 6. React SPA catch-all route intercepted `/storage/` requests

**What happened:** `web.php` had `Route::get('/{any}', ...)` with `->where('any', '.*')` which matched `/storage/branding/...` before the file was served.

**Fix:** Excluded `storage` from the regex:
```php
Route::get('/{any}', function () {
    return file_get_contents(public_path('index.html'));
})->where('any', '^(?!storage).*$');
```

---

### 7. `billing_cycle` ENUM missing `custom` value

**What happened:** The `subscriptions` table migration only defined `['monthly', 'yearly']` for `billing_cycle`, but the controller validated and accepted `'custom'`. Assigning a plan with `billing_cycle: custom` caused a MySQL data truncation error (500).

**Fix:** Added a new migration to alter the column:
```php
DB::statement("ALTER TABLE subscriptions MODIFY billing_cycle ENUM('monthly', 'yearly', 'custom') NOT NULL DEFAULT 'monthly'");
```

**Rule going forward:** Keep controller validation `in:` rules in sync with DB ENUM definitions.

---

### 8. OpenAI key blank on server

**What happened:** `backend/.env` on the server had `OPENAI_API_KEY=` empty. The key was only in the root `.env` under a different name (`OPENAI_SECRET_KEY`).

**Fix:** Copied the key into the server's `backend/.env` and ran `php artisan config:clear`.

**Rule going forward:** After any `.env` change, always run `php artisan config:clear` on the server.

---

### 9. Laravel welcome page served instead of React SPA

**What happened:** `web.php` had `Route::get('/', fn() => view('welcome'))` which served Laravel's default page at `/`.

**Fix:** Replaced with the SPA catch-all that reads `public/index.html` directly.

---

### 10. `index.html` not updated after rebuild

**What happened:** After a Vite rebuild, asset filenames change (content hash). Syncing only `assets/` left the old `index.html` referencing the old JS bundle — site loaded but ran old code.

**Rule going forward:** Always sync `index.html` together with `assets/`:
```bash
rsync -avz ... frontend/dist/index.html $SERVER:$PATH/public/index.html
rsync -avz ... frontend/dist/assets/    $SERVER:$PATH/public/assets/
```

---

### 11. Syncing `bootstrap/cache/` from local breaks artisan on server

**What happened:** Rsync'd `bootstrap/` including `bootstrap/cache/services.php` and `bootstrap/cache/packages.php`. Local cache references `laravel/pail` (a dev-only package). Server doesn't have it installed, so every `php artisan` command failed with `Class "Laravel\Pail\PailServiceProvider" not found`.

**Fix:** Deleted the two cache files on the server, then ran `php artisan package:discover` to regenerate them from the server's actual vendor directory.

**Rule going forward:** Never sync `bootstrap/cache/` to the server. Delete stale cache on the server before running artisan commands.

---

### 12. Menu images not loading — `public/storage` was a real directory instead of a symlink

**What happened:** At some point `public/storage` was created as a real directory (manually, or by an earlier `rsync` that didn't clean up). `php artisan storage:link` was never run after the initial deploy, so it never created the symlink.

Result: new uploads (going to `storage/app/public/menu/`) were invisible to the web server, which was serving the old real `public/storage/menu/` folder that had no new files in it.

**Symptoms:** Images uploaded via the menu manager saved successfully (API returned a URL), but loading that URL returned 404 or showed the wrong/old image.

**Diagnosis:**
```bash
ls -la public/storage   # showed "drwxrwxr-x" (real dir) instead of "lrwxrwxrwx" (symlink)
ls public/storage/menu/ # only 1 old file
ls storage/app/public/menu/ # 7 new files — none visible to web
```

**Fix:**
```bash
# Copy any files in the real dir that aren't yet in storage/app/public (preserve them)
cp -n public/storage/branding/* storage/app/public/branding/
cp -n public/storage/menu/*     storage/app/public/menu/

# Remove the real directory
rm -rf public/storage

# Create the proper symlink
php artisan storage:link
# → "The [public/storage] link has been connected to [storage/app/public]."

# Verify
ls -la public/storage  # should show: lrwxrwxrwx ... -> .../storage/app/public
```

**Confirmed:** LiteSpeed does follow the symlink correctly. `https://magicmanagement.dentask.in/storage/menu/...` returns HTTP 200 after the fix.

**Rule going forward:** After every fresh deploy or server setup, always run `php artisan storage:link`. If `public/storage` already exists as a real directory, remove it first and re-run the command. Add it to the deploy checklist.

---

## Safe Deploy Checklist — Server 1 (dentask / staging)

```bash
SERVER=indorede1@103.191.209.34
PATH=/var/www/2ef0389c-f093-4f75-96a8-278253f21e49/magicmanagement.dentask.in
SSH="ssh -i ~/.ssh/id_rsa -p 22"

# 1. Build frontend
cd frontend && npm run build

# 2. Sync backend (one dir at a time)
# NOTE: do NOT sync bootstrap/cache/ — local cache references dev-only packages (laravel/pail etc.)
#       that aren't installed on the server and will break artisan.
#       Instead delete stale cache on server and let artisan regenerate it.
rsync -avz -e "$SSH" backend/app/        $SERVER:$PATH/app/
rsync -avz -e "$SSH" backend/config/     $SERVER:$PATH/config/
rsync -avz -e "$SSH" backend/database/   $SERVER:$PATH/database/
rsync -avz -e "$SSH" backend/resources/  $SERVER:$PATH/resources/
rsync -avz -e "$SSH" backend/routes/     $SERVER:$PATH/routes/

# 3. Sync frontend build (NO --delete)
rsync -avz -e "$SSH" frontend/dist/index.html $SERVER:$PATH/public/index.html
rsync -avz -e "$SSH" frontend/dist/assets/    $SERVER:$PATH/public/assets/

# 4. Delete stale bootstrap cache, run migrations + clear caches
ssh -i ~/.ssh/id_rsa -p 22 $SERVER "cd $PATH && rm -f bootstrap/cache/services.php bootstrap/cache/packages.php && php artisan migrate --force && php artisan config:clear && php artisan route:clear && php artisan cache:clear && php artisan package:discover --ansi"

# 5. Ensure storage symlink exists (safe to re-run; fails gracefully if already correct)
# If public/storage is a real directory instead of a symlink, remove it first:
# ssh -i ~/.ssh/id_rsa -p 22 $SERVER "[ -d $PATH/public/storage ] && [ ! -L $PATH/public/storage ] && rm -rf $PATH/public/storage"
ssh -i ~/.ssh/id_rsa -p 22 $SERVER "cd $PATH && php artisan storage:link 2>&1 || true"
```

---

### 13. Static root assets (logo.svg etc.) not synced — served as HTML (broken image)

**What happened:** Deploy script only synced `assets/` and `index.html`. Root-level static files
(`logo.svg`, `logo-violet.svg`, `favicon.svg`, `icons.svg`, `gpaylogo.svg`, `paytmlogo.webp`,
`phonepelogo.png`) were never copied to `public/`. The SPA catch-all in `web.php` intercepted
requests for these paths and returned `text/html` — browsers rendered a broken/crash image icon
even though the HTTP status was 200.

**Rule going forward:** Always sync root-level dist files individually alongside `assets/`. They are
listed explicitly in the Safe Deploy — Server 2 step 3.
