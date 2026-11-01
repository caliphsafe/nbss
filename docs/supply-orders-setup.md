# NBSS order desk setup

This connects the Chandlery write-in order form and private `/admin` staff page to one private Google spreadsheet. The workbook has four tabs: `Orders`, `Inventory`, `Invoices`, and `Disbursements`. Google Sheets API access runs from Vercel server functions. There is no customer email workflow, online payment processing, stock reservation, automatic stock deduction or Apps Script in this setup.

## 1. Create the Google spreadsheet

1. Sign in to a Google account controlled by NBSS. A company Workspace account is preferable to an employee's personal account.
2. Create a Google spreadsheet named **NBSS Supply Desk**. Keep it private; do not turn on **Anyone with the link**.
3. Rename the first sheet tab to exactly `Orders`.
4. Paste this tab-separated header into cell `A1` of `Orders`:

```text
Created at	Order number	Status	Customer name	Phone	Vessel / company	Needed by	Preferred handoff	Supply list	Supply items JSON	Customer notes	Staff notes	Updated at	Submission key
```

5. Add a second sheet tab with the **+** button and name it exactly `Inventory`.
6. Paste this tab-separated header into cell `A1` of `Inventory`:

```text
Supply item	Category	Unit	Unit price	On hand	Reorder at	Location	Notes	Active
```

7. Add a sheet tab named exactly `Invoices`. Paste this header into cell `A1`:

```text
Invoice number	Status	Issued date	Due date	Customer name	Billing address	Vessel / company	IMO number	Delivery date	Delivery port / berth	PO reference	Payment terms	Currency	Order number	Line items JSON	Subtotal	Tax rate (%)	Tax amount	Total due	Payment instructions	Staff notes	Created at	Updated at
```

8. Add a sheet tab named exactly `Disbursements`. Paste this header into cell `A1`:

```text
DA number	Status	Issued date	Owner / principal	Settlement office	Billing address	Vessel	IMO number	Port of call	Berth	Arrival (ATA)	Departure (ATD)	Currency	Pre-funding received	Line items JSON	Total costs	Balance / credit	Notes	Created at	Updated at
```

9. Keep the four header rows in these exact orders. The application checks every header before reading or writing. Do not rename or rearrange columns.
10. Optional: add starter inventory names beneath the Inventory header. For example, use `Scallop gear` for rings, links, chain, twine / tar; `Rope & wire` for rope / line, steel wire rope, rigging hardware, cut lengths; `Deck & safety` for foul-weather gear, deck boots, gloves, safety equipment; `Tools & repair` for hand tools, boat parts, construction supplies, cleaning supplies; and `Trip provisions` for frozen provisions, dry goods, drinks, crew essentials. These are suggestion names only. Leave prices blank until NBSS confirms them, and leave stock quantities at `0` until staff verify them.
11. Use `TRUE` in `Active` for supplies to suggest on the customer form and `FALSE` for archived items. In Admin, use the **Active supply** checkbox. Archiving keeps historical/reference data and removes the name from customer suggestions.
12. Format `Unit price` as USD currency and `On hand` / `Reorder at` as numbers. You may freeze row 1. Do not sort or move rows while the admin page is in use; the row editor updates the matching sheet row.
13. Copy the spreadsheet ID from its URL. It is the text after `/spreadsheets/d/` and before `/edit`.

The admin page is the intended way to update inventory and process orders. All nine inventory fields are editable in the inventory editor. Unit prices are private staff references and never appear in the public suggestion list. When an invoice is made from an order, the request details are carried into private staff notes; staff enter the actual delivered quantity, unit, price and applicable tax before issuing it. The IMO field is optional.

The invoice and disbursement tabs store each document's line detail as JSON so Admin can edit it as structured form fields. All visible invoice and DA fields are editable in Admin; document numbers, sheet row positions and creation/update timestamps are system-managed. For each third-party DA charge, enter the supplier invoice or voucher reference and retain the actual supporting invoice or receipt in NBSS's accounting records. The spreadsheet does not attach those source documents.

A supplier invoice bills supplies actually delivered by NBSS. A Disbursement Account is a port-call reconciliation for cases where NBSS is formally appointed as the vessel owner's port agent. Do not use a DA as a general supply invoice. The DA calculates total actual costs less the advance received: a positive balance is due to NBSS, and a negative balance is a credit due to the principal.

## 2. Give the website private spreadsheet access

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project named **NBSS Supply Desk** (or choose a company-owned project for this integration).
2. In **APIs & Services → Library**, search for **Google Sheets API**, open it and select **Enable**.
3. Go to **IAM & Admin → Service Accounts → Create service account**. Name it `nbss-order-desk`. Continue through the wizard; it does not need broad project roles.
4. Open the new service account, choose **Keys → Add key → Create new key → JSON**, and download the JSON file temporarily. It contains `client_email` and `private_key`.
5. Return to the private Google spreadsheet. Select **Share** and add the service account `client_email` as an **Editor**. This grants access to this workbook and all four tabs. Do not make the workbook public.
6. Keep the JSON file secret. Do not commit it, attach it to an issue, paste it in this chat or put it in frontend code. After the values are saved in Vercel, store or delete the downloaded file according to NBSS credential policy.

**Google Apps Script is not required.** The Vercel API functions use the Google Sheets API directly, so there is no Apps Script project, deployment URL, web-app access setting or script secret to configure.

## 3. Configure staff sign-in in Google Cloud

1. In the same Cloud project, open **Google Auth Platform**. If prompted, configure the consent screen with app name **NBSS Supply Desk** and NBSS support contact information.
2. Choose **Internal** if all authorized NBSS staff use the same Workspace. Otherwise choose **External**. During testing, add the staff accounts under **Test users**; publish the consent screen before relying on external sign-in for regular staff use.
3. The app requests only the basic `openid` and `email` identity scopes. This is for staff identity and the `/admin` allowlist; the app does not access Gmail.
4. Open **Clients** (or **APIs & Services → Credentials**) and create an OAuth client. Choose application type **Web application**.
5. In **Authorized redirect URIs**, add:

```text
https://nbss-nine.vercel.app/api/admin-auth-callback
```

First confirm that `nbss-nine.vercel.app` is still the Production domain in Vercel → **Settings → Domains**. If the Production domain is different, use `https://<current-production-domain>/api/admin-auth-callback` instead. The value must match the site's production origin exactly; do not use a preview deployment URL. If the domain changes later, update both this URI and `APP_BASE_URL` in Vercel.
6. Save the OAuth client ID and client secret for Vercel. Never place the client secret in browser code or the repository.

## 4. Add the Production environment variables in Vercel

1. Sign in to Vercel and open the project connected to **`caliphsafe/nbss`** (project name `nbss`).
2. Go to **Settings → Environment Variables**.
3. Add each variable below and select **Production** as its environment. Store secrets only in Vercel, not in GitHub.

| Name | Value |
| --- | --- |
| `APP_BASE_URL` | Production origin only, such as `https://nbss-nine.vercel.app` (no path or trailing slash) |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ID copied from the `NBSS Supply Desk` spreadsheet URL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the service account JSON |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Complete `private_key`, including the BEGIN and END lines |
| `ADMIN_GOOGLE_CLIENT_ID` | OAuth web client ID from Google Cloud |
| `ADMIN_GOOGLE_CLIENT_SECRET` | OAuth web client secret from Google Cloud |
| `ADMIN_EMAILS` | Comma-separated Google identities allowed into `/admin`, for example `captain@nbshipsupply.com,manager@nbshipsupply.com` |
| `ADMIN_SESSION_SECRET` | New random value at least 32 characters long; generate with a password manager or `openssl rand -base64 48` |

For `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, paste the whole multiline value without surrounding JSON quotes. If Vercel requires a single line, literal `\n` line breaks are accepted by the server. Mark secret values as **Sensitive** if Vercel offers that choice.

4. Do not add `RESEND_API_KEY`, sender addresses or customer email variables; the order flow does not send email.
5. Do not connect a Preview deployment to the Production workbook. If staff need to test preview URLs, create a separate test workbook and use its ID in Preview-only environment variables. For routine verification, use the Production deployment and a clearly labeled test order.

## 5. Deploy and verify the connection

1. Save the variables in Vercel. Environment-variable changes are used by new deployments, so redeploy the latest successful `main` deployment after adding or changing values.
2. Open the Production site at `/admin` and select **Sign in with Google**. Use an identity listed in `ADMIN_EMAILS`.
3. Confirm the **Orders** view loads. Select **Inventory** and verify the sheet connection loads an empty inventory table or the starter names you entered.
4. Add a clearly labeled test supply item in Admin. Confirm it appears as an inventory row in the Google `Inventory` tab and as a suggestion on `/marine-supply`.
5. Submit one clearly labeled test order with a controlled name and phone number. Confirm the customer sees the **order number** and the availability/pricing note; confirm that the same order appears in the `Orders` tab and the Admin queue.
6. Edit the test inventory item and enter a clearly labeled test unit price. Confirm the value saves in the sheet and Admin. Public supply suggestions must still show only the item, category and unit.
7. In Admin, edit the test order's status, a supply line and staff notes; save and confirm the sheet updates. Start an invoice from that test order, confirm the draft is watermarked in its print preview, then mark the test document **Void** after verification. Do not issue it as a real customer invoice.
8. Confirm a test invoice remains in the Invoices tab and can be reopened and printed from Admin. Use a clearly marked test DA only to check the form; do not issue an actual DA unless NBSS has a port-agency appointment and real supporting vouchers. Mark test records **Void** when done.
9. Mark the test order **Cancelled** when finished. The order remains in the sheet as a record. Order submission does not deduct or reserve stock; staff should adjust inventory when the business's chosen fulfillment step is complete.
10. Try the sign-in flow using an account not listed in `ADMIN_EMAILS`; it must not enter the desk.

## Troubleshooting

- **The form says inventory suggestions are unavailable:** order entry still accepts write-in supplies. Check the `Inventory` tab name and exact nine headers, the spreadsheet ID, the service-account share, and Vercel variables.
- **The admin page says it cannot reach a register:** confirm all four tab names and exact header rows; confirm the Sheets API is enabled and the service account still has Editor access; then redeploy if a Vercel variable changed.
- **Invoices or DAs do not load:** confirm the `Invoices` and `Disbursements` tabs are present with the exact headers above. The backend does not create tabs automatically.
- **Google sign-in returns a redirect error:** make sure the authorized redirect URI and `APP_BASE_URL` use the same Production hostname, and that the URI ends in `/api/admin-auth-callback`.
- **A staff member is denied:** add their Google identity to `ADMIN_EMAILS`, check for whitespace or spelling mistakes, and redeploy after changing the Vercel variable.
- **The order confirmation is not shown:** the number only appears after the row is written successfully. Check the order sheet and Vercel function logs before asking the customer to resubmit; the submission key prevents a repeated click from creating a second row in normal retry cases.

All server-side variables are listed in [`.env.example`](../.env.example). Never add a `VITE_` prefix to these secrets because that can expose values to browser code.
