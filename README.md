# Nirapeksh

Directory of independent Indian YouTube news channels — rate with Google login, optional trust notes, bookmarks, Hindi/English UI, and an admin panel.

**Nirapeksh (निरपेक्ष)** means impartial.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

## Configure

### Google login (ratings + reviews)

Fill Firebase keys in `.env` and enable Google provider in Firebase Auth.

### Admin panel

Set `ADMIN_SECRET` in `.env`. Open **Admin** in the site header, enter the secret, edit channels, save.

## Features

- Language-first browse tabs
- Search by channel **or video topic**
- Extra tags (region/beat)
- Optional “Why I trust this” notes beside ratings
- Bookmarks (browser)
- Dark / light theme
- Hindi / English UI
- About & listing criteria page
- Feedback email form

## Made by

**Nikhil Tyagi** — kumarnikhil474551@gmail.com
