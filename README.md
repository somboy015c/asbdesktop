# ASBData Ghana — Desktop (Windows + macOS)

A native desktop app for the ASBData Ghana admin dashboard, built with [Tauri](https://tauri.app).

It does **not** open your website. The dashboard screens (Dashboard, Orders, Transactions, Agent Applications, Users, Bundles & Pricing, Withdrawals, Settings) are built into the app and talk to your API, like your website and mobile apps do.

- Animated splash, 3-slide onboarding (first launch only), native sign-in screen
- Smooth transitions, animated sidebar, dialogs and charts, desktop-style tables
- Updates itself: on launch it checks your latest GitHub release and installs it automatically
- No "Download App" button anywhere in the app
- One click in GitHub builds and publishes `ASBDataGhana.exe` (Windows) and `ASBDataGhana.dmg` (macOS)

## Setup (once, all in the browser)

**1. Backend.** Copy the files from the `asbdata-backend-admin-api` patch into your Laravel project (same folder structure), set `DESKTOP_APP_REPO=your-user/your-repo` in the server `.env`, and deploy. This adds the token-based admin endpoints under `/api/v1/admin/*` and allows the app's origins in `config/cors.php`. Nothing else in the backend changes.

**2. API address.** If your API isn't at `https://api.asbdataghana.com`, change `API_BASE` in `src/config.js`.

**3. GitHub.** Create a new **public** repository, upload this folder to it, then open **Settings → Actions → General → Workflow permissions** and choose **Read and write permissions**.

## Releasing (the button)

GitHub → **Actions → Release (Windows + macOS) → Run workflow**.

Pick patch / minor / major (or type an exact version) and optional notes. It bumps the version, builds Windows and macOS in parallel, and publishes one release when both finish (about 10–15 minutes). If a build fails, the unfinished release is removed so you can simply run it again.

Permanent download links (always the newest release):

```
https://github.com/YOUR-USER/YOUR-REPO/releases/latest/download/ASBDataGhana.exe
https://github.com/YOUR-USER/YOUR-REPO/releases/latest/download/ASBDataGhana.dmg
```

With `DESKTOP_APP_REPO` set, the existing **Download App** menu in your web admin panel uses these automatically.

## How updates work

On launch the app checks the latest release. If it's newer, it shows an "Updating" screen, downloads the installer from your release, installs it and restarts. Windows installs silently for the current user. macOS swaps the app in place.

## First launch on a Mac

The app isn't notarized (that needs a paid Apple Developer account), so the first time only: open the `.dmg`, drag the app to Applications, then **right-click the app → Open → Open** (on newer macOS: System Settings → Privacy & Security → **Open Anyway**). Later updates install themselves without this step.

Windows may show a SmartScreen notice the first time ("More info → Run anyway") until you buy a code-signing certificate.

## Notes

- The admin login is a separate token login (`/api/v1/admin/auth/login`, admin accounts only). The token is stored on the device and removed on log out.
- Update downloads come over HTTPS straight from your GitHub release. They aren't cryptographically signed (that would need a signing key you'd have to create and store by hand).
- Icons are generated from your logo mark. For crisper ones replace the files in `src-tauri/icons`.
- Local development (optional): install Node 20 and Rust, then `npm install && npm run dev`.
