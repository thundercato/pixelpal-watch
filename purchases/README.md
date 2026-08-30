# PixelPal Purchases PWA

Public app shell for the PixelPalOS Purchases research prototype.

## Privacy boundary

The deployed GitHub Pages site contains **no private purchase dataset**. The user's sanitised purchase seed is imported manually into IndexedDB on their device and stays there. The private seed deliberately excludes raw Amazon Order IDs, full addresses, card numbers/last-four digits, tracking references and gift messages.

The PWA supports local product classification, locally stored product images, Asset creation, search, review queues and JSON export/import so long curation sessions can be backed up.

## Install on iPhone

Open the deployed `/purchases/` URL in Safari, use **Share → Add to Home Screen**, then import the private PixelPal Purchases seed JSON once.

## Source of truth

Schema/importer research remains in the private native repository under `docs/research/purchases/`. This public repository only hosts the static PWA shell.