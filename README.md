# New Bedford Ship Supply — 43 Build

A complete storefront rebuild with a vintage marine identity, the supplied NBSS logo, black/red/weathered-white palette, and original NBSS photography. No emojis, framework dependencies, or package-lock.json.

## Included

- Home, searchable/filterable/sortable shop, marine supply, story, contact, FAQ and 404 pages.
- 17 individually generated product pages with real Shopify variants, sizes, colors, photographs and descriptions.
- Persistent shopping bag, quantity controls, removal, cross-tab synchronization and Shopify cart-permalink checkout.
- Same-origin `/api/catalog` Vercel function refreshes public Shopify prices and variant availability. A dated catalog snapshot allows browsing during upstream outages. Shopify is authoritative for inventory, tax, shipping and payment.
- Marine supply and contact forms prepare an email draft for `help@nbshipsupply.com`. They clearly require the visitor to send the draft; they do not silently submit messages or claim delivery.
- Responsive layouts, keyboard controls, accessible dialogs, reduced-motion support, local fonts, static HTML routes and descriptive metadata.

## Run

Requires Node.js 22 or later. No dependencies need installing.

```sh
npm run build
npm test
npm run dev
```

`npm run dev` builds and serves the site at port 4173, including the catalog endpoint. Restart after source changes. The build output is `dist/`.

## Vercel

Import `caliphsafe/nbss`, using the repository root, framework preset **Other**, build command `npm run build`, output directory `dist`, and Node.js 22 or later. `vercel.json` includes the deployment configuration. No API keys are required for the existing public Shopify catalog and checkout handoff.

No Vercel project was connected to this repository at delivery. This upload does not change the existing store or DNS.

## Shopify and domain handoff

The store identified in the original website is `new-bedford.myshopify.com`. Both the catalog endpoint and checkout links use it. Cart checkout is built from real numeric variant IDs and quantities; payment remains with Shopify. An order was not placed during verification.

Keep the current Shopify storefront/domain working while reviewing this rebuild. **Before moving `nbshipsupply.com` to Vercel**, configure and verify a dedicated Shopify primary domain (for example, a checkout/shop subdomain) and update the `STORE` constants in `lib/catalog.mjs` and `public/shop-utils.js`, along with policy links in `scripts/build.mjs`. Otherwise Shopify's primary-domain redirects could point back to the new frontend. Domain migration is not part of this delivery.

## Catalog maintenance

```sh
npm run sync:catalog
npm run build
npm test
```

The snapshot was imported on October 22, 2026. Product detail and bag prices/availability refresh through `/api/catalog`; checkout always confirms final values. The collection is generated at build time. Run the sync script and rebuild when adding/removing products or changing names, descriptions, options or imagery. Add a primary image to `public/images/<product-handle>.jpg` for newly added products before publishing. Existing variant gallery images load directly from Shopify.

## Assets and content

- Uploaded logo: `public/images/nbss-logo.png`.
- Product photos, lifestyle photographs and company information: original `nbshipsupply.com` storefront.
- Barlow and Barlow Condensed fonts: Google Fonts (SIL Open Font License, bundled in `public/fonts`).
- Public catalog snapshot: `data/catalog.json`.
- Marine supply categories are inquiry topics, not an invented online inventory. No stock, pricing, phone numbers, opening hours or fulfillment promises were invented.

## Verification

- Production static build passes (24 pages).
- Automated checks cover catalog/variant validity, multi-item checkout mapping, malformed local cart data, and every generated internal link/local asset.
- Live Shopify catalog read verified: 17 products.
- Browser visual/interaction QA remains unverified: the managed browser rejected access under its security policy. Responsive code and assets were inspected, but this is not represented as a completed visual browser review.
