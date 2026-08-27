FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json tsconfig.json vite.config.ts ./
COPY frontend ./frontend
RUN npm ci && npm run build

FROM rust:1.88-bookworm AS backend
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 together \
    && useradd --uid 10001 --gid together --no-create-home --shell /usr/sbin/nologin together \
    && mkdir -p /app/dist /data \
    && chown -R together:together /app /data
WORKDIR /app
COPY --from=backend /build/target/release/together-room /usr/local/bin/together-room
COPY --from=frontend /build/dist ./dist
ENV PORT=8080 \
    FRONTEND_DIR=/app/dist \
    DATABASE_URL=sqlite:///data/together-room.db?mode=rwc \
    RUST_LOG=together_room=info,tower_http=info
USER together
EXPOSE 8080
CMD ["together-room"]
