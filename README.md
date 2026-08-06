# Nirapeksh

Directory of independent Indian YouTube news channels — rate with Google login, optional trust notes, bookmarks, Hindi/English UI, and an admin panel.

**Nirapeksh (निरपेक्ष)** means impartial.

Stack: **Vite + React** frontend on **Firebase Hosting**, data in **Firestore**, login via **Firebase Auth (Google)**. Free on the Spark plan.

## Run locally

```bash
npm install
cp .env.example .env
# fill VITE_FIREBASE_* from Firebase Console → Project settings → Your apps
npm run dev
```

## Firebase setup (once)

1. Create / open project in [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication → Sign-in method → Google**.
3. Create a **Firestore** database (production mode is fine; deploy rules next).
4. Under Authentication → Settings → Authorized domains, add `localhost` and your Hosting domain.
5. Copy web app config into `.env` (`VITE_FIREBASE_*`).
6. Set `VITE_ADMIN_EMAIL` to your Google account (Admin nav only shows for that email).

Also update the admin email inside `firestore.rules` (`isAdmin()`) so only you can write channels / read feedback.

### Live videos (top 4)

Cards load the **latest 4 uploads** from each channel (not hardcoded).

1. Optional: create a free [YouTube Data API](https://console.cloud.google.com/apis/library/youtube.googleapis.com) key
2. Put it in `.env` as `VITE_YOUTUBE_API_KEY=...`
3. Restrict the key to your domains (`localhost`, `*.web.app`)

Without a key, the app falls back to a public RSS bridge (works, but less reliable / rate-limited). Results are cached in the browser for 6 hours.

## Deploy (free)

```bash
npm install -g firebase-tools
firebase login
npm run build
firebase deploy
```

This publishes Hosting + Firestore rules. Site URL looks like:

`https://<project-id>.web.app`

### First-time channel data

Until you save from the Admin panel, the app uses the built-in seed list. Sign in as admin → **Admin** → **Save channels** to push listings into Firestore.

### Feedback

Feedback is stored in the Firestore `feedback` collection (readable only by admin rules). Open Firestore Console to read submissions.

## Features

- Language-first browse tabs
- Search by channel **or video topic**
- Extra tags (region/beat)
- Optional “Why I trust this” notes beside ratings
- Bookmarks (browser)
- Dark / light theme
- Hindi / English UI
- About & listing criteria page
- Feedback form (Firestore)

## Made by

**Nikhil Tyagi** — kumarnikhil474551@gmail.com
