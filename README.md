# insighta-cli

CLI client for the Insighta Labs+ API.

This repository contains the globally installable command-line tool used to authenticate with Insighta, inspect profiles, search records, create profiles as an admin, and export profile data to CSV.

## What This CLI Does

The CLI currently implements the Phase 4 command set from the project task list:

- `insighta login` with PKCE-based browser authentication
- `insighta logout`
- `insighta whoami`
- `insighta profiles list`
- `insighta profiles get <id>`
- `insighta profiles search "<query>"`
- `insighta profiles create --name "Name"`
- `insighta profiles export --format csv`

It also handles access-token auto-refresh before API calls and sends the `X-API-Version: 1` header required by the backend.

## Features

- Global install support through the `bin` entry in `package.json`
- Browser-based GitHub login flow with PKCE
- Local callback server for OAuth redirection
- Credential persistence at `~/.insighta/credentials.json`
- Automatic refresh of expired access tokens
- Tabular profile output for list/search commands
- Structured JSON output for profile detail and create commands
- CSV export to the current working directory

## Requirements

- Node.js 20 or newer
- npm
- Access to the Insighta backend API
- A valid GitHub OAuth setup on the backend side

## Installation

Install dependencies locally:

```bash
npm install
```

Run the CLI directly from the repository:

```bash
npm run dev -- --help
```

Install globally from the repository folder:

```bash
npm install -g .
```

After that, `insighta` should be available from any directory.

## Configuration

The CLI reads configuration from environment variables in `.env`.

| Variable | Purpose | Default |
| --- | --- | --- |
| `INSIGHTA_API_BASE_URL` | Base URL for API requests | `http://localhost:3000` |
| `INSIGHTA_AUTH_START_URL` | GitHub auth start URL | `http://localhost:3000/auth/github` |
| `INSIGHTA_AUTH_EXCHANGE_URL` | Token exchange callback URL | `http://localhost:3000/auth/github/callback` |
| `INSIGHTA_LOGOUT_URL` | Logout endpoint | `http://localhost:3000/auth/logout` |
| `INSIGHTA_REFRESH_URL` | Token refresh endpoint | `http://localhost:3000/auth/refresh` |
| `INSIGHTA_CALLBACK_PORT` | Local login callback port | `8787` |

The sample values are mirrored in `.env.example`.

## Authentication Flow

`insighta login` uses a local PKCE flow:

1. The CLI generates a `state`, `code_verifier`, and `code_challenge`.
2. It starts a temporary callback server on `http://127.0.0.1:<port>/callback` and includes that loopback URL in the backend auth request.
3. It opens the browser to the backend GitHub auth URL.
4. After GitHub redirects back, the CLI validates the returned `state`.
5. The CLI sends the authorization code and verifier to the backend exchange endpoint.
6. The backend returns a standard `{ status, data }` response with access and refresh tokens.
7. The CLI unwraps the response, stores credentials in `~/.insighta/credentials.json`, and prints `Logged in as @username`.

When an API command runs, the CLI checks whether the access token is expired. If it is, the CLI attempts to refresh it automatically using the refresh token and saves the updated credentials back to disk.

## Commands

### Authentication

```bash
insighta login
```

Starts the PKCE login flow, opens the browser, and stores credentials locally.

```bash
insighta logout
```

Logs out through the backend when possible and deletes the local credentials file.

```bash
insighta whoami
```

Shows the currently stored user details from `~/.insighta/credentials.json`.

### Profiles

```bash
insighta profiles list [options]
```

Lists profiles in a table.

Supported filters and pagination flags:

- `--gender <value>`
- `--country <value>`
- `--age-group <value>`
- `--min-age <number>`
- `--max-age <number>`
- `--sort-by <value>`
- `--order <value>`
- `--page <number>`
- `--limit <number>`

Example:

```bash
insighta profiles list --gender male --country NG --sort-by age --order desc --page 1 --limit 10
```

```bash
insighta profiles get <id>
```

Fetches a single profile and prints formatted JSON.

Example:

```bash
insighta profiles get 66f7c0d9e2a1b0d1c3a0b111
```

```bash
insighta profiles search "<query>" [options]
```

Searches profiles using the backend search endpoint and renders the results as a table.

Supported flags:

- `--page <number>`
- `--limit <number>`

Example:

```bash
insighta profiles search "female engineers in Nigeria" --page 1 --limit 10
```

```bash
insighta profiles create --name "Name"
```

Creates a profile using the backend `POST /api/profiles` endpoint. This command is admin-only on the backend.

Example:

```bash
insighta profiles create --name "Harriet Tubman"
```

```bash
insighta profiles export --format csv [options]
```

Exports profiles to CSV in the current working directory.

Supported filter flags:

- `--gender <value>`
- `--country <value>`
- `--age-group <value>`
- `--min-age <number>`
- `--max-age <number>`
- `--sort-by <value>`
- `--order <value>`

Example:

```bash
insighta profiles export --format csv --gender female --country NG --sort-by age --order asc
```

The exported file is saved as something like `profiles_1714230000000.csv` in the folder you ran the command from.

## Output Behavior

- Lists and search results are shown with `console.table`.
- `get` and `create` print formatted JSON.
- Export commands print the saved file path.
- Loading states are shown with a simple spinner while requests are in flight.

## Backend Contract

The CLI expects these backend routes:

- `GET /auth/github`
- `GET /auth/github/callback`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /api/profiles`
- `GET /api/profiles/search`
- `GET /api/profiles/export`
- `POST /api/profiles`

The CLI also has compatibility fallbacks for some route variations, especially around token exchange and profile lookup.

## Project Structure

```text
insighta-cli/
├── bin/
│   └── insighta.js
├── src/
│   ├── api.js
│   ├── auth.js
│   ├── cli.js
│   ├── config.js
│   ├── credentials.js
│   └── spinner.js
├── .env.example
├── package.json
└── README.md
```

## Troubleshooting

### Not logged in

If you see:

```text
Not logged in. Run insighta login
```

run `insighta login` first, or check whether `~/.insighta/credentials.json` exists.

### Login callback does not complete

Make sure the callback port in `.env` is free and that your backend OAuth app allows the redirect URI used by the CLI.

### Refresh errors

If refresh fails, the CLI will ask you to log in again. This usually means the refresh token expired or was invalidated on the server.

### Empty results

If a command returns no rows, the backend either returned no matching profiles or the filters were too strict.

## Development Notes

- The CLI uses `commander` for argument parsing.
- Credentials are stored as JSON in the user home directory, not in the repository.
- API requests always include `Authorization: Bearer <token>` and `X-API-Version: 1`.
- The `profiles get` command first tries `/api/profiles/:id` and then falls back to a filtered list lookup if needed.

## Status

This repository currently covers the CLI portion of the Stage 3 .
