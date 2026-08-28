use std::{str::FromStr, time::Duration};

use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    SqlitePool,
};

pub async fn connect(url: &str) -> Result<SqlitePool, sqlx::Error> {
    let max_connections = if url.contains("mode=memory") { 1 } else { 5 };
    // WAL is fast on a local disk. The production deployment may select DELETE
    // for its single-replica Azure Files mount, where WAL shared memory is not
    // supported. This is an optional override; a bare container still starts.
    let journal_mode = match std::env::var("SQLITE_JOURNAL_MODE").as_deref() {
        Ok("delete") => SqliteJournalMode::Delete,
        _ => SqliteJournalMode::Wal,
    };
    let options = SqliteConnectOptions::from_str(url)?
        .busy_timeout(Duration::from_secs(5))
        .foreign_keys(true)
        .journal_mode(journal_mode);
    let pool = SqlitePoolOptions::new()
        .max_connections(max_connections)
        .connect_with(options)
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
