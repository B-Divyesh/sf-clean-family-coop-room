# Together Room

Together Room lets a parent and child play three turn-based games on different
devices. One player makes a room. The other joins with its six-digit code.
Neither player needs an account.

Try the isolated sample at
<https://clean-family-coop-room.sociobot.in/demo>. It starts with a populated
Star Signal round and completed Patchwork Pair and Firefly Ferry results. The
sample is read-only and never opens or changes a real room.

The three games are:

- **Star Signal** — rebuild a six-symbol sequence from alternating clues.
- **Patchwork Pair** — place a shared nine-tile color pattern.
- **Firefly Ferry** — guide one light with controls split between both players.

Reloading reconnects a device to its room and saved turn. Real room data lives
in SQLite and expires after two hours. The welcome page and sample reopen
offline after the first visit.

The optional family pack costs US$8 once. It adds Dawn and Berry palettes plus
one celebration stamp. All three games remain free. Checkout and license
verification use the Sociobot billing API; the product never embeds a payment
provider.

## Privacy

The product has no accounts, ads, analytics, public rooms, chat, or
matchmaking. The landing page and sample load no third-party runtime files.
Real rooms store game state, timestamps, expiry, and hashed device keys. A
restored license stays in local storage and is checked with Sociobot at most
once per day. See `/privacy` for the complete policy.

## Stack

- Vite and strict vanilla TypeScript PWA frontend
- Rust 2021, Axum WebSockets, Tokio, and SQLx/SQLite backend
- One non-root container serving the frontend and API on `PORT`

The server allows six room creations, 12 joins, and 20 socket attempts per
client in a rolling minute. Limited requests return `429` with `Retry-After`.

## Develop

Requirements: Node 22+, npm, Rust stable, and Cargo. Docker is optional for the
container-only verification commands.

```bash
npm ci
npm run dev          # frontend on :5173, proxies API to :8080
npm run dev:server   # backend on :8080 in another terminal
```

The container starts with only `PORT` set. These optional variables override
its defaults:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP port |
| `DATABASE_URL` | `sqlite://together-room.db?mode=rwc` | SQLite connection |
| `FRONTEND_DIR` | `dist` | Built assets to serve |
| `BUILD_SHA` | `dev` | Build identity compiled into `/health` |
| `TRUST_PROXY_HEADERS` | unset | Trust the rightmost address added by the ingress |
| `SQLITE_JOURNAL_MODE` | `wal` | Use `delete` on the production Azure Files mount |
| `RUST_LOG` | info filters | Structured log level |

## Build and verify

```bash
npm test
npm run build
npm run check
npm run test:e2e
npm run test:claims -- --grep "@claim:demo-sandbox"
cargo fmt --all -- --check
```

Every public claim and its clean-sandbox command is listed in
`.factory/claims.json`. Demo isolation is documented in `.factory/demo.md`.

With Docker installed, verify the release container:

```bash
docker build --build-arg BUILD_SHA="$(git rev-parse HEAD)" -t together-room .
docker run --rm -p 8080:8080 -v together-data:/data together-room
```

Production uses one replica and durable `/data` storage, as declared in
`.factory/deployment.json`. Do not add replicas until room and live connection
state move to a shared service.

## Deploy

The factory builds the root `Dockerfile`, mounts `/data`, and deploys the
container to the product subdomain. Infrastructure, DNS, and billing are
managed outside this repository.

## License

MIT — see [LICENSE](LICENSE).
