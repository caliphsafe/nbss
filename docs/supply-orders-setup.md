# NBSS supply request setup

This configures the commercial supply request form and private `/admin` order desk. The production site uses Google Sheets as its request store. Google credentials stay in Vercel server-side environment variables; the public browser never receives them.

The supply form is a request for a quote. It does not confirm stock, price, delivery or payment. The counter continues to confirm those details with each customer.

## 1. Create the private order spreadsheet

1. Sign in to a Google account controlled by NBSS, preferably a company Google Workspace account rather than an individual employee's account.
2. Create a spreadsheet named **NBSS Supply Requests**.
3. Rename the first tab to **Orders** (capital O, no spaces).
4. Paste this tab-separated header row into cell `A1`. Keep the column order and names exactly as shown; the backend checks them before it accepts requests.

```text
Created at	Request number	Status	Customer name	Email	Vessel / company	Needed by	Preferred handoff	Supply list	Supply items JSON	Customer notes	Staff notes	Updated at	Staff alert status	Customer confirmation status	Submission key
```

5. Leave the sheet private. Do not enable “Anyone with the link.” NBSS staff who should use the Google Sheet directly may be added as editors; the admin page itself will use its own approved-account sign-in.
6. Copy the spreadsheet ID from its address. It is the part after `/spreadsheets/d/` and before `/edit`.

The admin page is the normal way to review, search and update requests. In the sheet, staff notes and status are current values; closed requests remain in the sheet for reference rather than being deleted.

## 2. Set up Google Sheets API access

1. Open Google Cloud Console and create a project named **NBSS Supply Requests**.
2. In **APIs & Services → Library**, find **Google Sheets API** and enable it for this project.
3. In **IAM & Admin → Service Accounts**, create a service account named `nbss-order-intake`.
4. Create a JSON key for that service account and download it temporarily. The site needs the JSON's `client_email` and `private_key` values.
5. Return to the private spreadsheet, choose **Share**, and grant the service account email from `client_email` **Editor** access. You do not need to make the spreadsheet public or grant the service account broad project access.
6. Keep the JSON key private. Do not commit it, paste it into this repository, or send it in chat. After placing the values in Vercel, store/delete the downloaded key according to NBSS's credential policy.

If a Google Workspace policy blocks sharing with a service account, ask the Workspace administrator to allow the NBSS-owned service account to access this one spreadsheet.

## 3. Create staff-only Google sign-in

1. In the same Cloud project, open **Google Auth Platform** (or **APIs & Services → OAuth consent screen**, depending on the console layout) and configure the app name as **NBSS Supply Desk**.
2. Choose **Internal** if every approved staff account belongs to the NBSS Workspace. Otherwise choose **External**, add each allowed NBSS staff email under **Test users** while testing, and publish the consent screen before relying on it for ongoing staff use.
3. Request only the basic `openid` and `email` identity scopes. The order desk uses the signed-in address to enforce the staff allowlist; it does not read Gmail or Drive.
4. Under **Credentials**, create an **OAuth client ID** with application type **Web application**.
5. Add this exact **Authorized redirect URI** (replace the origin with the live production site origin, with no trailing slash):

```text
https://YOUR-PRODUCTION-ORIGIN/api/admin-auth-callback
```

Use the domain currently serving the NBSS rebuild. Do not change DNS or Shopify domains as part of this setup. If NBSS later changes its production domain, update both `APP_BASE_URL` in Vercel and the authorized redirect URI in Google Cloud.
6. Copy the OAuth client ID and client secret into Vercel in the next step. Do not put either secret in frontend JavaScript.

## 4. Configure Vercel environment variables

1. Open the connected **NBSS Vercel project → Settings → Environment Variables**.
2. Add the following values for **Production**. Do not use the live spreadsheet credentials in Preview unless you create a separate test spreadsheet and separate OAuth callback.

| Variable | Value |
| --- | --- |
| `APP_BASE_URL` | The production site origin, such as `https://your-live-nbss-host`, with no trailing slash or path |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | The spreadsheet ID copied in step 1 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The service account's `client_email` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | The complete `private_key`, including the `BEGIN PRIVATE KEY` and `END PRIVATE KEY` lines |
| `ADMIN_GOOGLE_CLIENT_ID` | Google OAuth web client ID |
| `ADMIN_GOOGLE_CLIENT_SECRET` | Google OAuth web client secret |
| `ADMIN_EMAILS` | Comma-separated lowercase email addresses allowed into `/admin` |
| `ADMIN_SESSION_SECRET` | A new random secret with at least 32 characters; generate one with a password manager or `openssl rand -base64 48` |

Mark credentials as **Sensitive** in Vercel when that option is available. For `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, paste the full multiline key value without surrounding JSON quotes. The server also accepts literal `\n` line breaks if Vercel's field requires a single line.

## 5. Configure staff and customer email notifications

Email delivery is separate from saving requests. Requests still appear in `/admin` if email isn't configured, but staff won't receive a new-request alert and customers won't receive an email receipt.

1. Create or use an NBSS-owned Resend account.
2. Verify a sending domain that NBSS controls and follow Resend's DNS verification steps. Use an address on that verified domain for the sender.
3. Create a Resend API key for this project.
4. Add these **Production** variables in Vercel:

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | The Resend API key |
| `ORDER_NOTIFICATION_EMAIL` | The staff inbox that should receive every new supply request, for example `orders@nbshipsupply.com` |
| `ORDER_FROM_EMAIL` | A verified sender, for example `New Bedford Ship Supply <orders@nbshipsupply.com>` |

## 6. Deploy and verify the setup

1. Save the Vercel environment variables. Environment changes apply to a new deployment, so redeploy the latest successful `main` commit from **Deployments** after completing the settings.
2. Open `/admin` on the production site and sign in with an address listed in `ADMIN_EMAILS`.
3. Confirm the dashboard loads and the email configuration warning is gone.
4. Submit one clearly labeled test request from `/marine-supply`, using an NBSS-controlled test email address. Confirm it appears in the private `Orders` sheet and admin list, that the staff alert and customer receipt arrive, and that the order status and private staff notes save.
5. Try a Google account not listed in `ADMIN_EMAILS`; it should not open the order desk.
6. Mark the test request **Closed** so it is clearly out of the active queue. The system intentionally has no delete action, preserving a simple request record.

If the form cannot save a request, verify that the `Orders` tab name and header row are exact, the service-account email has Editor access to that sheet, the spreadsheet ID is correct, and all Vercel values are set for the production environment. Redeploy after changing any Vercel variables.

## Vercel variables checklist

The complete server-side variable set is also listed in [`.env.example`](../.env.example). Never use a `VITE_` prefix for these secrets; that prefix could expose values to browser code.
