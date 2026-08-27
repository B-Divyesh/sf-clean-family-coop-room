use std::{
    collections::HashMap,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{Row, SqlitePool};
use tokio::sync::{broadcast, Mutex};

use crate::game::{self, MoveInput, RoomGame};

const ROOM_LIFETIME_SECONDS: i64 = 2 * 60 * 60;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    channels: Arc<Mutex<HashMap<String, broadcast::Sender<String>>>>,
    presence: Arc<Mutex<HashMap<String, [usize; 2]>>>,
    mutation_lock: Arc<Mutex<()>>,
}

impl AppState {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            channels: Arc::new(Mutex::new(HashMap::new())),
            presence: Arc::new(Mutex::new(HashMap::new())),
            mutation_lock: Arc::new(Mutex::new(())),
        }
    }
}

#[derive(Debug)]
struct ApiError(StatusCode, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "error": self.1 }))).into_response()
    }
}

#[derive(Debug, Serialize)]
struct JoinResponse {
    code: String,
    token: String,
    seat: u8,
    expires_at: i64,
}

#[derive(Deserialize)]
struct SocketQuery {
    token: String,
}

#[derive(Deserialize)]
struct ClientEvent {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    game: String,
    #[serde(default)]
    action: String,
    #[serde(default)]
    value: Value,
}

pub fn api_router(state: AppState) -> Router {
    Router::new()
        .route("/rooms", post(create_room))
        .route("/rooms/{code}/join", post(join_room))
        .route("/rooms/{code}/socket", get(room_socket))
        .with_state(state)
}

async fn create_room(State(state): State<AppState>) -> Result<Json<JoinResponse>, ApiError> {
    let now = now();
    let game_json = serde_json::to_string(&RoomGame::default()).map_err(internal)?;
    for _ in 0..20 {
        let code = format!("{:06}", rand::rng().random_range(0..1_000_000));
        let token = fresh_token();
        let mut tx = state.pool.begin().await.map_err(internal)?;
        let inserted = sqlx::query("INSERT OR IGNORE INTO rooms(code, game_json, created_at, expires_at) VALUES(?, ?, ?, ?)")
            .bind(&code).bind(&game_json).bind(now).bind(now + ROOM_LIFETIME_SECONDS)
            .execute(&mut *tx).await.map_err(internal)?.rows_affected();
        if inserted == 0 {
            continue;
        }
        sqlx::query(
            "INSERT INTO participants(room_code, seat, token_hash, last_seen) VALUES(?, 0, ?, ?)",
        )
        .bind(&code)
        .bind(token_hash(&token))
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(internal)?;
        tx.commit().await.map_err(internal)?;
        return Ok(Json(JoinResponse {
            code,
            token,
            seat: 0,
            expires_at: now + ROOM_LIFETIME_SECONDS,
        }));
    }
    Err(ApiError(
        StatusCode::SERVICE_UNAVAILABLE,
        "A room code could not be reserved. Please try again.".into(),
    ))
}

async fn join_room(
    Path(raw_code): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<JoinResponse>, ApiError> {
    let code = normalize_code(&raw_code)?;
    let now = now();
    let room = sqlx::query("SELECT expires_at FROM rooms WHERE code = ?")
        .bind(&code)
        .fetch_optional(&state.pool)
        .await
        .map_err(internal)?
        .ok_or_else(|| {
            ApiError(
                StatusCode::NOT_FOUND,
                "That room was not found. Check the six digits or ask for a new room.".into(),
            )
        })?;
    let expires_at: i64 = room.get("expires_at");
    if expires_at <= now {
        return Err(ApiError(
            StatusCode::GONE,
            "That room has safely expired. Create a fresh room to keep playing.".into(),
        ));
    }
    let occupied: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM participants WHERE room_code = ?")
        .bind(&code)
        .fetch_one(&state.pool)
        .await
        .map_err(internal)?;
    if occupied >= 2 {
        return Err(ApiError(StatusCode::CONFLICT, "Both windows in that room are already claimed. Reopen the original invite on this device.".into()));
    }
    let token = fresh_token();
    sqlx::query(
        "INSERT INTO participants(room_code, seat, token_hash, last_seen) VALUES(?, 1, ?, ?)",
    )
    .bind(&code)
    .bind(token_hash(&token))
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(internal)?;
    Ok(Json(JoinResponse {
        code,
        token,
        seat: 1,
        expires_at,
    }))
}

async fn room_socket(
    Path(raw_code): Path<String>,
    Query(query): Query<SocketQuery>,
    State(state): State<AppState>,
    ws: WebSocketUpgrade,
) -> Result<Response, ApiError> {
    let code = normalize_code(&raw_code)?;
    if query.token.len() > 128 {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "The room key is not valid.".into(),
        ));
    }
    let seat = participant_seat(&state.pool, &code, &query.token)
        .await?
        .ok_or_else(|| {
            ApiError(
                StatusCode::UNAUTHORIZED,
                "This device no longer has a key for that room.".into(),
            )
        })?;
    Ok(ws.on_upgrade(move |socket| handle_socket(socket, state, code, seat)))
}

async fn participant_seat(
    pool: &SqlitePool,
    code: &str,
    token: &str,
) -> Result<Option<u8>, ApiError> {
    let row = sqlx::query("SELECT p.seat FROM participants p JOIN rooms r ON r.code=p.room_code WHERE p.room_code=? AND p.token_hash=? AND r.expires_at>?")
        .bind(code).bind(token_hash(token)).bind(now()).fetch_optional(pool).await.map_err(internal)?;
    Ok(row.map(|r| r.get::<i64, _>("seat") as u8))
}

async fn handle_socket(socket: WebSocket, state: AppState, code: String, seat: u8) {
    let sender = {
        let mut channels = state.channels.lock().await;
        channels
            .entry(code.clone())
            .or_insert_with(|| broadcast::channel(32).0)
            .clone()
    };
    let mut receiver = sender.subscribe();
    {
        let mut all = state.presence.lock().await;
        all.entry(code.clone()).or_default()[seat as usize] += 1;
    }
    let (mut ws_tx, mut ws_rx) = socket.split();
    let initial = state_event(&state, &code).await.unwrap_or_else(|_| {
        json!({"type":"error","message":"The room could not be loaded."}).to_string()
    });
    if ws_tx.send(Message::Text(initial.into())).await.is_err() {
        return;
    }
    broadcast_state(&state, &code).await;

    loop {
        tokio::select! {
            incoming = ws_rx.next() => match incoming {
                Some(Ok(Message::Text(text))) => {
                    let reply = process_event(&state, &code, seat, &text).await;
                    if let Err(message) = reply {
                        let body = json!({"type":"error", "message": message}).to_string();
                        if ws_tx.send(Message::Text(body.into())).await.is_err() { break; }
                    }
                }
                Some(Ok(Message::Ping(data))) => { if ws_tx.send(Message::Pong(data)).await.is_err() { break; } }
                Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                _ => {}
            },
            outgoing = receiver.recv() => match outgoing {
                Ok(text) => { if ws_tx.send(Message::Text(text.into())).await.is_err() { break; } }
                Err(broadcast::error::RecvError::Lagged(_)) => {
                    if let Ok(text) = state_event(&state, &code).await { let _ = ws_tx.send(Message::Text(text.into())).await; }
                }
                Err(_) => break,
            }
        }
    }
    {
        let mut all = state.presence.lock().await;
        if let Some(room) = all.get_mut(&code) {
            room[seat as usize] = room[seat as usize].saturating_sub(1);
        }
    }
    broadcast_state(&state, &code).await;
}

async fn process_event(state: &AppState, code: &str, seat: u8, raw: &str) -> Result<(), String> {
    if raw.len() > 2_048 {
        return Err("That message was too large.".into());
    }
    let event: ClientEvent =
        serde_json::from_str(raw).map_err(|_| "That move could not be read.".to_string())?;
    let _guard = state.mutation_lock.lock().await;
    let mut game = load_game(&state.pool, code).await.map_err(|e| e.1)?;
    match event.kind.as_str() {
        "start" => {
            let present = current_presence(state, code).await;
            if !present[0] || !present[1] {
                return Err("Wait until both windows show connected.".into());
            }
            game = game::start(&event.game, game.round + 1)?;
        }
        "move" => game::apply(
            &mut game,
            seat,
            &MoveInput {
                action: event.action,
                value: event.value,
            },
        )?,
        "play_again" => {
            if game.phase != game::Phase::Won {
                return Err("Finish this round before starting another.".into());
            }
            game = game::start(&game.kind, game.round + 1)?;
        }
        "lobby" => game = RoomGame::default(),
        _ => return Err("That room action is not available.".into()),
    }
    let encoded = serde_json::to_string(&game)
        .map_err(|_| "The room state could not be saved.".to_string())?;
    sqlx::query("UPDATE rooms SET game_json=? WHERE code=? AND expires_at>?")
        .bind(encoded)
        .bind(code)
        .bind(now())
        .execute(&state.pool)
        .await
        .map_err(|_| "The room state could not be saved.".to_string())?;
    broadcast_state(state, code).await;
    Ok(())
}

async fn load_game(pool: &SqlitePool, code: &str) -> Result<RoomGame, ApiError> {
    let raw: Option<String> =
        sqlx::query_scalar("SELECT game_json FROM rooms WHERE code=? AND expires_at>?")
            .bind(code)
            .bind(now())
            .fetch_optional(pool)
            .await
            .map_err(internal)?;
    let raw = raw.ok_or_else(|| ApiError(StatusCode::GONE, "This room has expired.".into()))?;
    serde_json::from_str(&raw).map_err(internal)
}

async fn state_event(state: &AppState, code: &str) -> Result<String, ApiError> {
    let game = load_game(&state.pool, code).await?;
    let connected = current_presence(state, code).await;
    serde_json::to_string(&json!({ "type": "state", "room": game, "connected": connected }))
        .map_err(internal)
}

async fn current_presence(state: &AppState, code: &str) -> [bool; 2] {
    let all = state.presence.lock().await;
    let count = all.get(code).copied().unwrap_or_default();
    [count[0] > 0, count[1] > 0]
}

async fn broadcast_state(state: &AppState, code: &str) {
    if let Ok(body) = state_event(state, code).await {
        if let Some(sender) = state.channels.lock().await.get(code) {
            let _ = sender.send(body);
        }
    }
}

pub async fn remove_expired(pool: &SqlitePool) {
    if let Err(error) = sqlx::query("DELETE FROM rooms WHERE expires_at <= ?")
        .bind(now())
        .execute(pool)
        .await
    {
        tracing::warn!(%error, "expired room cleanup failed");
    }
}

fn normalize_code(raw: &str) -> Result<String, ApiError> {
    let code: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if code.len() != 6 || raw.len() > 8 || !raw.chars().all(|c| c.is_ascii_digit() || c == ' ') {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Enter the six-digit room code.".into(),
        ));
    }
    Ok(code)
}

fn fresh_token() -> String {
    let bytes: [u8; 24] = rand::rng().random();
    hex::encode(bytes)
}

fn token_hash(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
fn internal(error: impl std::fmt::Display) -> ApiError {
    tracing::error!(%error, "request failed");
    ApiError(
        StatusCode::INTERNAL_SERVER_ERROR,
        "Together Room hit a snag. Please try again.".into(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[test]
    fn room_codes_allow_a_readable_space() {
        assert_eq!(normalize_code("123 456").unwrap(), "123456");
        assert!(normalize_code("12A456").is_err());
        assert!(normalize_code("123A456").is_err());
    }

    #[tokio::test]
    async fn create_and_join_claim_exactly_two_windows() {
        let name: u64 = rand::rng().random();
        let pool = db::connect(&format!(
            "sqlite://room-test-{name}?mode=memory&cache=shared"
        ))
        .await
        .unwrap();
        let state = AppState::new(pool);
        let Json(created) = create_room(State(state.clone())).await.unwrap();
        assert_eq!(created.seat, 0);
        assert_eq!(created.code.len(), 6);
        assert_eq!(
            participant_seat(&state.pool, &created.code, &created.token)
                .await
                .unwrap(),
            Some(0)
        );

        let Json(joined) = join_room(Path(created.code.clone()), State(state.clone()))
            .await
            .unwrap();
        assert_eq!(joined.seat, 1);
        let third = join_room(Path(created.code), State(state))
            .await
            .unwrap_err();
        assert_eq!(third.0, StatusCode::CONFLICT);
    }
}
