# PixelPal Purchases PWA

Public app shell for the PixelPalOS Purchases research prototype.

The deployed site contains no private purchase or banking dataset. Private Amazon and Monzo evidence is imported locally into IndexedDB on the user's device.

## Historic-evidence workflow

Amazon purchase/product history remains the canonical itemised source. Monzo exports are supporting bank evidence. Exact amount/date matches can link bank evidence to an Amazon Purchase, but Aldi/Tesco rows are not expanded into invented items.

Review records two separate questions: what sort of thing it is (durable, consumable, digital, not physical) and broad purpose (My purchase, House purchase, Gift, Other). Funding source may preselect a likely purpose but never proves beneficiary. Gift tagging uses a local People list.

Private Monzo notes, receipt links, Amazon data and curation are never committed to this repository.