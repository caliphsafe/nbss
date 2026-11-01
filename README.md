# New Bedford Ship Supply — 43 Build

A research-led storefront rebuild for New Bedford's working chandlery, using the supplied NBSS logo, black/red/weathered-white palette, and original NBSS photography. The visual system draws from supply ledgers, gear-room tickets, waterfront signage and industrial catalog typography rather than generic nautical themes. No emojis, framework dependencies, or package-lock.json.

## Included

- Home, searchable/filterable/sortable shop, marine supply, story, contact, FAQ and 404 pages.
- 17 individually generated product pages with real Shopify variants, sizes, colors, photographs and descriptions.
- Persistent shopping bag, quantity controls, removal, cross-tab synchronization and Shopify cart-permalink checkout.
- Same-origin `/api/catalog` Vercel function refreshes public Shopify prices and variant availability. A dated catalog snapshot allows browsing during upstream outages. Shopify is authoritative for inventory, tax, shipping and payment.
- A commercial-supply desk covers scallop gear, rope and wire, deck and safety gear, tools, provisions, pickup and dock-delivery inquiries.
- The Chandlery uses a write-in order form with multiple editable and removable lines. Active inventory names from the private Google Sheet appear as optional suggestions; custom supplies are always allowed. The customer sees an order number, and NBSS confirms availability and pricing.
- Supply orders and inventory live in separate tabs in one private Google spreadsheet. `/admin` is a staff-only Google sign-in workspace for processing orders, editing order details, maintaining every inventory field, tracking low stock, archiving items and exporting orders. No customer email, payment, stock reservation or automatic inventory deduction is part of this workflow.
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

The connected Vercel project deploys updates from the repository's `main` branch. This upload does not change the existing store or DNS. Order intake requires Google Sheets access, staff OAuth and the server-side environment variables before it can accept production orders.

## Supply request backend setup

Follow [the Google Sheets, Google Cloud and Vercel setup guide](docs/supply-orders-setup.md) before announcing the order desk. It lists exact `Orders` and `Inventory` headers, recommended starter inventory names and the server-side environment variables. Keep production credentials out of Git and do not point preview deployments at the live order sheet.

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
- Company history, address, phone number, chandlery departments, public counter access and dock-delivery language were researched against NBSS's published company pages and local reporting.
- Inventory starts empty; the suggested starter names in the setup guide are not preloaded stock. NBSS staff enter verified on-hand and reorder quantities and confirm pricing per order.

## Verification

- `npm run build` passes and generates 24 pages.
- `npm test` passes 12 checks covering catalog and variant validity, order and inventory validation, spreadsheet row mapping, staff access, cross-origin mutation protection and generated internal links/assets.
- The existing Shopify apparel checkout remains separate from commercial supply orders.
