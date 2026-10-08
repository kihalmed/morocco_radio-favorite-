# Radio Maroc

A lightweight Moroccan radio directory and streaming player built with plain HTML, CSS, and JavaScript. Designed for GitHub Pages; no build tools or backend are required.

## Features

- Live station directory from the Radio Browser API, filtered to Morocco (`MA`)
- Refreshes the directory on page load, on request, when the browser comes online, and every 30 minutes
- Search by station name, tags, language, and region
- Language and broad tag-based category filters
- Favorites and recently played stations stored in the current browser using `localStorage`
- Station logos when supplied by the directory
- Dark/light theme preference
- Play/pause and volume controls
- Multiple API server fallbacks and friendly playback/error messages
- Responsive layout for desktop and mobile

## Run locally

You can open `index.html` directly in a browser, but using a local static server is preferable:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish with GitHub Pages

1. Create a GitHub repository, for example `morocco-radio`.
2. Upload `index.html`, `styles.css`, `app.js`, the `assets/` folder, and this README to the repository root.
3. Open **Settings → Pages** in the repository.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Choose branch `main` and folder `/ (root)`, then save.
6. Wait for deployment. Your site will be available at `https://YOUR-USERNAME.github.io/morocco-radio/`.

If the repository is named `YOUR-USERNAME.github.io`, the URL will instead be `https://YOUR-USERNAME.github.io/`.

## Data and stream source

Station metadata and stream URLs are loaded dynamically from [Radio Browser](https://www.radio-browser.info/) through its public JSON API. This project does not hard-code guessed stream URLs. The directory can include streams that later become unavailable, and some broadcasters may restrict embedding or require their official player. A listing in a directory does not itself grant permission to rebroadcast; review station terms and applicable rights before using streams commercially or redistributing them.

The API is a third-party dependency. If the API is unavailable, the directory may not load until it comes back online. The player uses the browser's native audio support, so codec, HTTPS, CORS, geo-restrictions, and station server settings can affect playback.

## Notes

- Favorites, recent history, and theme are stored locally in each browser; they do not sync between devices.
- Categories are inferred from station tags/name and may be imperfect.
- This is a static front end and does not proxy, record, or rehost audio.
- Station logos are loaded from URLs provided by the directory. If a logo does not load, a music-note placeholder appears.

## References

- [Radio Browser](https://www.radio-browser.info/)
- [Radio Browser API reference collection](https://github.com/api-evangelist/radio-browser/blob/main/collections/radio-browser.opencollection.json)
- [GitHub Pages documentation](https://docs.github.com/en/pages)
