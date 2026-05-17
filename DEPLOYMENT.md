# Deployment Notes — Magic Management

Server: `103.191.209.34`
SSH: `ssh -i ~/.ssh/id_rsa -p 22 indorede1@103.191.209.34`
Project path: `/var/www/2ef0389c-f093-4f75-96a8-278253f21e49/magicmanagement.dentask.in`
Live URL: `https://magicmanagement.dentask.in`
Web server: LiteSpeed (not Apache — behaves differently)

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

### 4. LiteSpeed does not follow symlinks

**What happened:** `php artisan storage:link` creates a symlink `public/storage → storage/app/public`. LiteSpeed does not follow symlinks, so `/storage/branding/image.png` returned 404 even though the file existed.

`Options +FollowSymLinks` in `.htaccess` had no effect on LiteSpeed.

**Fix:** Replaced the symlink with a real directory and copied files into it:
```bash
rm public/storage
mkdir -p public/storage/branding public/storage/menu
cp -r storage/app/public/branding/. public/storage/branding/
cp -r storage/app/public/menu/. public/storage/menu/
```

**Rule going forward:** After any file upload (branding, menu images), copy the file to `public/storage/` as well — the symlink won't work on this server. A deploy script or post-upload hook should handle this automatically.

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

## Safe Deploy Checklist

```bash
SERVER=indorede1@103.191.209.34
PATH=/var/www/2ef0389c-f093-4f75-96a8-278253f21e49/magicmanagement.dentask.in
SSH="ssh -i ~/.ssh/id_rsa -p 22"

# 1. Build frontend
cd frontend && npm run build

# 2. Sync backend (one dir at a time)
rsync -avz -e "$SSH" backend/app/        $SERVER:$PATH/app/
rsync -avz -e "$SSH" backend/bootstrap/  $SERVER:$PATH/bootstrap/
rsync -avz -e "$SSH" backend/config/     $SERVER:$PATH/config/
rsync -avz -e "$SSH" backend/database/   $SERVER:$PATH/database/
rsync -avz -e "$SSH" backend/resources/  $SERVER:$PATH/resources/
rsync -avz -e "$SSH" backend/routes/     $SERVER:$PATH/routes/

# 3. Sync frontend build (NO --delete)
rsync -avz -e "$SSH" frontend/dist/index.html $SERVER:$PATH/public/index.html
rsync -avz -e "$SSH" frontend/dist/assets/    $SERVER:$PATH/public/assets/

# 4. Run migrations + clear caches
ssh $SSH $SERVER "cd $PATH && php artisan migrate --force && php artisan config:clear && php artisan route:clear && php artisan cache:clear"

# 5. If new file uploads exist, copy to public/storage manually
# ssh $SSH $SERVER "cp -r $PATH/storage/app/public/. $PATH/public/storage/"
```
