# Deploying ORIONAI on Vercel — from an iPhone, no computer needed

This version is restructured for Vercel: the site (`index.html`, `css/`, `js/`)
is served as static files, and the chat feature is one small serverless
function at `api/index.py`. Vercel's free tier covers this comfortably.

Developed by Rashmith.

---

## Step 1 — Get this folder into a GitHub repo

You don't need a laptop. Do this in Safari.

1. Go to **github.com**, sign in (or sign up — it's free).
2. Tap the **+** icon (top right) → **New repository**.
3. Name it `orionai`, keep it **Public**, don't add a README (we already have one), tap **Create repository**.
4. You'll land on an empty repo page. Tap **"uploading an existing file"** (a link in the middle of the page).
5. Tap **choose your files**, then in the picker go to **Files app → the orionai-vercel folder you unzipped** and select everything inside it (all files: `index.html`, `vercel.json`, `requirements.txt`, `.gitignore`, `README.md`, and the `api`, `css`, `js` folders — select folders too if the picker allows).
6. If the picker won't let you select folders directly, upload the top-level files first (`index.html`, `vercel.json`, `requirements.txt`, `.gitignore`, `README.md`), commit, then repeat "Add file → Upload files" separately for the contents of `css/`, `js/`, and `api/` — GitHub will recreate the folder as you upload into it (drag files there, or when prompted type the folder name before the filename, e.g. `css/style.css`).
7. Scroll down, tap **Commit changes**.

**If uploading folders is fussy on your phone**, this fallback always works and only takes a few minutes since there are just 7 files:
- Tap **Add file → Create new file**.
- In the "Name your file" box, type the full path, e.g. `api/index.py` — GitHub creates the `api` folder automatically.
- Open that file in the Files app on your phone, tap to preview it, **Select All → Copy** the text, then paste it into GitHub's editor.
- Tap **Commit changes**. Repeat for each file: `index.html`, `css/style.css`, `js/main.js`, `api/index.py`, `requirements.txt`, `vercel.json`, `.gitignore`.

---

## Step 2 — Connect Vercel

1. Go to **vercel.com** in Safari, tap **Sign Up**, choose **Continue with GitHub**, and approve access.
2. On your Vercel dashboard, tap **Add New → Project**.
3. Find and **Import** the `orionai` repository.
4. Leave the build settings as detected (Vercel recognizes the `api/` Python function and static root automatically) — don't change the Framework Preset, leave it as **Other**.

---

## Step 3 — Add your OpenAI key

Before deploying (or right after — you can edit and redeploy):

1. In the import screen (or later under **Project → Settings → Environment Variables**), add:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** your real key from platform.openai.com/api-keys
2. Optionally also add `OPENAI_MODEL` = `gpt-4o-mini`.
3. Tap **Deploy**.

---

## Step 4 — You're live

Vercel gives you a URL like `https://orionai-yourname.vercel.app`. Open it —
you should see the ORIONAI homepage with the animated stars, and the chat
should work.

If chat gives an error, it's almost always the API key:
- Recheck **Settings → Environment Variables** for typos
- After adding/changing a variable, you must **redeploy** (Vercel → Deployments → ⋯ → Redeploy) for it to take effect

---

## Updating the site later

Any time you edit a file on GitHub (or push new commits), Vercel automatically
redeploys — no extra steps.

## Cost note

Each chat message calls the OpenAI API and costs a small amount based on
token usage — keep an eye on usage at platform.openai.com, especially once
the link is public.
