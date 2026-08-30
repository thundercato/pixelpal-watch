# PixelPal Watch Rating Deck

## Publish with GitHub Pages
1. Create a repository such as `pixelpal-watch`.
2. Upload all files from this package to the repository root.
3. Open **Settings > Pages**.
4. Choose **Deploy from a branch**.
5. Select **main** and **/(root)**, then Save.
6. Open the HTTPS Pages address GitHub gives you in Safari on iPhone.
7. Use **Share > Add to Home Screen**.

## Ratings
Ratings are saved locally in the browser. Use **Export JSON** regularly.
That JSON is the portable data to keep and later merge into PixelPalOS Watch.

The Plex programme list is embedded in `index.html`. Poster artwork may be fetched
from the internet while the app runs.

## PixelPal Purchases PWA

A separate local-first Purchases research PWA is hosted at [`/purchases/`](purchases/).

The public repository contains only the app shell and a synthetic seed example. Private purchase history is imported by the user into IndexedDB on their device and is never committed to GitHub. The Purchases PWA supports product review/classification, purchase browsing, local product images, Asset creation and JSON backup/restore.

See [`purchases/README.md`](purchases/README.md) for the privacy and install boundary.