use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

pub async fn connect(url: &str) -> Result<SqlitePool, sqlx::Error> {
    let max_connections = if url.contains("mode=memory") { 1 } else { 5 };
    let pool = SqlitePoolOptions::new()
        .max_connections(max_connections)
        .connect(url)
        .await?;
    sqlx::query("PRAGMA journal_mode = WAL")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS rooms (
            code TEXT PRIMARY KEY,
            game_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        )",
    )
    .execute(&pool)
    .await?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS participants (
            room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
            seat INTEGER NOT NULL CHECK (seat IN (0, 1)),
            token_hash TEXT NOT NULL UNIQUE,
            last_seen INTEGER NOT NULL,
            PRIMARY KEY (room_code, seat)
        )",
    )
    .execute(&pool)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS rooms_expiry ON rooms(expires_at)")
        .execute(&pool)
        .await?;
    Ok(pool)
}
