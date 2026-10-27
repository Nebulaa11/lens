# Stocklens

A clearer view of stock performance. A public website and a market dashboard with sector filters, ranked stock cards, intraday flow and a read-only Upstox connector.

## Run locally

Requires Python 3.10 or later. Run from this folder:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python server.py --port 8765
```

Open http://127.0.0.1:8765/ for the homepage, or http://127.0.0.1:8765/dashboard for the dashboard. Without a provider token, use Preview layout for sample data. Live mode uses received provider quotes and candles; missing data is not replaced with invented prices.

## Pages

Homepage, dashboard, login, signup, account, community access, About, searchable Help, Contact, Journal (three guides), Updates and account-data information.

## Optional configuration

The server reads environment variables; it does not automatically load `.env`. `.env.example` contains no credentials. Export variables before starting the server:

- `UPSTOX_ACCESS_TOKEN`: your private market-data token. Keep it server-side and out of source control. Enter it through a private shell prompt or your deployment secret manager, not a command containing the token literally.
- `STOCKLENS_COMMUNITY_URL`: HTTPS community invite, shown to signed-in accounts.
- `STOCKLENS_SUPPORT_EMAIL`: public support email.
- `STOCKLENS_PUBLIC_ORIGIN`: exact HTTPS origin for a future deployment, enabling Secure session cookies and the permitted authentication origin.
- `STOCKLENS_ACCOUNT_DB`: optional private SQLite database location; default `.private/accounts.sqlite3`.

Community and support show an unavailable state until configured. No messages or invitations are sent automatically.

## Accounts and deployment status

Local signup/login/logout use salted PBKDF2 password hashes and expiring HttpOnly/SameSite session cookies. Email verification, password recovery and Google login are not implemented. Dashboard stars/preferences remain in browser storage. The server binds to localhost by default. This is a local application, not a production-ready public authentication service. Public hosting needs deployment hardening, recovery/verification and final operator/privacy details. Review your provider's market-data display permissions before redistributing data.

## Tests

Run from this folder with the dependencies installed. Node.js is needed for JavaScript tests:

```sh
.venv/bin/python tests/test_stocklens_feed.py
.venv/bin/python tests/test_site_accounts.py
node tests/test_hover_state.cjs
node tests/test_particle_paths.cjs
node tests/test_quote_worker.cjs
```

Account tests use disposable local data and dummy credentials; no real provider token is needed.

## Sharing this project

This source distribution excludes credentials, account databases, sessions, virtual environments, local backups and Git history. The product screenshot contains historical market data, not current quotes. `.gitignore` protects common private/generated files when using Git, but does not remove them from a manually shared folder or files already tracked. Before sharing a future copy, remove runtime databases and any real `.env` files, even if Git ignores them.

The public source folder is complete for running the app; excluded private runtime files are created locally as needed. No software license has been selected; add your chosen license before granting reuse rights.
