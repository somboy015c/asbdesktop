# ASBData Ghana — Desktop (Windows + macOS)

Your admin dashboard as a native desktop app, built with [Tauri](https://tauri.app).

The app shows an animated splash and a 3-slide welcome (first launch only), then opens your live admin panel at `admin.asbdataghana.com` inside a native window.

- **Your admin panel updates the app instantly.** It loads the live site, so anything you change and deploy on the server appears in the app straight away. Nothing to rebuild.
- The **Download App** menu is hidden inside the app (still visible in a normal browser).
- Smooth page transitions, thin scrollbars, window size remembered, external links open in the browser.
- The app updates itself: on launch it checks your latest GitHub release and installs it automatically.
- One click in GitHub builds and publishes `ASBDataGhana.exe` (Windows) and `ASBDataGhana.dmg` (macOS).

You only need a new release when you change the app itself (the files in this repo: splash, welcome slides, window behavior).

## Setup (once, all in the browser)

1. Create a new **public** GitHub repository.
2. Upload the *contents* of this folder to it (see "Don't see the Run workflow button?" below, the hidden `.github` folder matters).
3. Open **Settings → Actions → General → Workflow permissions** and choose **Read and write permissions**.

## Releasing (the button)

GitHub → **Actions → Release (Windows + macOS) → Run workflow**.

Pick patch / minor / major (or type an exact version) and optional notes. It bumps the version, builds Windows and macOS in parallel, and publishes one release when both finish (about 10–15 minutes). If a build fails, the unfinished release is removed so you can simply run it again. Nothing to run on your own computer.

Permanent download links (always the newest release), for the Download App buttons in your admin panel:

```
https://github.com/YOUR-USER/YOUR-REPO/releases/latest/download/ASBDataGhana.exe
https://github.com/YOUR-USER/YOUR-REPO/releases/latest/download/ASBDataGhana.dmg
```

## Don't see the Run workflow button?

GitHub only shows it if the file is exactly at `.github/workflows/release.yml` at the **top level** of the repo, on the default branch. Two common causes:

- The `.github` folder wasn't uploaded. It starts with a dot, so Mac Finder hides it and drag-and-drop often skips it.
- You uploaded the `asbdata-desktop` folder itself, so the file ended up at `asbdata-desktop/.github/...`. Upload the *contents* of the folder instead.

Fix: in the repo click Add file → Create new file, type `.github/workflows/release.yml` as the name (typing the slashes creates the folders), paste in the contents of `workflow-copy/release.yml`, and commit. Then open the Actions tab; the workflow appears on the left and "Run workflow" is on the right. If Actions says it is disabled, click "I understand my workflows, go ahead and enable them".

## How the app updates itself

On launch the app checks the latest release. If it's newer, it shows an "Updating" screen, downloads the installer from your release, installs it and restarts. Windows installs silently for the current user. macOS swaps the app in place.

## First launch on a Mac

The app isn't notarized (that needs a paid Apple Developer account), so the first time only: open the `.dmg`, drag the app to Applications, then **right-click the app → Open → Open** (on newer macOS: System Settings → Privacy & Security → **Open Anyway**). Later updates install themselves without this step.

Windows may show a SmartScreen notice the first time ("More info → Run anyway") until you buy a code-signing certificate.

## Files you might edit

- `www/` — splash, welcome slides, offline screen (HTML/CSS/JS). `www/config.js` holds the admin address.
- `src-tauri/src/inject.js` — what's hidden/polished inside your admin panel.
- If the admin domain ever changes, update `ADMIN_URL` in `www/config.js` and `ADMIN_HOST` in `src-tauri/src/lib.rs`.

## Notes

- Update downloads come over HTTPS straight from your GitHub release. They aren't cryptographically signed (that would need a signing key you'd create and store by hand).
- Icons are generated from your logo mark. For crisper ones replace the files in `src-tauri/icons`.
- Local development (optional): install Node 20 and Rust, then `npm install && npm run dev`.
