use std::{str::FromStr, time::Duration};

use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    SqlitePool,
};

pub async fn connect(url: &str) -> Result<SqlitePool, sqlx::Error> {
    // WAL is fast on a local disk. The production deployment may select DELETE
    // for its single-replica Azure Files mount, where WAL shared memory is not
    // supported. This is an optional override; a bare container still starts.
    let delete_journal = std::env::var("SQLITE_JOURNAL_MODE").as_deref() == Ok("delete");
    connect_with_journal(url, delete_journal).await
}

async fn connect_with_journal(url: &str, delete_journal: bool) -> Result<SqlitePool, sqlx::Error> {
    // Azure Files can briefly retain a lock while Container Apps replaces a
    // replica. One connection avoids competing PRAGMA initialization within a
    // process, and bounded retries let the replacement wait for the old lease.
    let max_connections = if url.contains("mode=memory") || delete_journal {
        1
    } else {
        5
    };
    let attempts = if delete_journal { 12 } else { 1 };
    for attempt in 1..=attempts {
        match connect_once(url, delete_journal, max_connections).await {
            Ok(pool) => return Ok(pool),
            Err(error) if is_locked(&error) && attempt < attempts => {
                tracing::warn!(attempt, "SQLite is locked during startup; retrying");
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
            Err(error) => return Err(error),
        }
    }
    unreachable!("the startup retry loop always returns")
}

async fn connect_once(
    url: &str,
    delete_journal: bool,
    max_connections: u32,
) -> Result<SqlitePool, sqlx::Error> {
    let journal_mode = if delete_journal {
        SqliteJournalMode::Delete
    } else {
        SqliteJournalMode::Wal
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

fn is_locked(error: &sqlx::Error) -> bool {
    matches!(error, sqlx::Error::Database(database)
        if database.code().as_deref() == Some("5") || database.message().contains("locked"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn delete_journal_startup_survives_overlapping_replacements() {
        let path = std::env::temp_dir().join(format!(
            "together-room-startup-{}.db",
            rand::random::<u64>()
        ));
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let (first, second) = tokio::join!(
            connect_with_journal(&url, true),
            connect_with_journal(&url, true)
        );
        let first = first.expect("first replacement opens the shared database");
        let second = second.expect("overlapping replacement waits for the shared database");
        assert_eq!(
            sqlx::query_scalar::<_, String>("PRAGMA journal_mode")
                .fetch_one(&first)
                .await
                .unwrap(),
            "delete"
        );
        drop((first, second));
        let _ = std::fs::remove_file(path);
    }
}
