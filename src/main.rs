mod db;
mod game;
mod routes;

use std::{
    env,
    net::SocketAddr,
    path::{Path, PathBuf},
    time::Duration,
};

use axum::{
    extract::{Request, State},
    http::{header, HeaderValue, Method, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde_json::json;
use tokio::signal;
use tower_http::{
    catch_panic::CatchPanicLayer,
    compression::CompressionLayer,
    limit::RequestBodyLimitLayer,
    services::{ServeDir, ServeFile},
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use routes::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "together_room=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let (database_url, database_source) = match env::var("DATABASE_URL") {
        Ok(value) => (value, "supplied"),
        Err(_) if Path::new("/data").is_dir() => (
            "sqlite:///data/together-room.db?mode=rwc".into(),
            "generated durable default",
        ),
        Err(_) => (
            "sqlite://together-room.db?mode=rwc".into(),
            "generated local default",
        ),
    };
    let (frontend_dir, frontend_source) = match env::var("FRONTEND_DIR") {
        Ok(value) => (PathBuf::from(value), "supplied"),
        Err(_) => (PathBuf::from("dist"), "generated default"),
    };
    tracing::info!(
        database_config = database_source,
        frontend_config = frontend_source,
        "configuration ready"
    );
    let deferred_database = db::requires_deferred_initialization(&database_url);
    let pool = db::connect(&database_url).await?;
    let app_state = AppState::new(pool.clone())
        .with_trusted_proxy_headers(env::var("TRUST_PROXY_HEADERS").as_deref() == Ok("1"))
        .with_database_ready(!deferred_database);
    let app = build_app(app_state.clone(), frontend_dir);

    if deferred_database {
        let startup_pool = pool.clone();
        let startup_state = app_state.clone();
        tokio::spawn(async move {
            match db::initialize_durable(&startup_pool).await {
                Ok(()) => {
                    startup_state.set_database_ready();
                    tracing::info!("durable SQLite is ready");
                }
                Err(error) => tracing::error!(%error, "durable SQLite could not be initialized"),
            }
        });
    }

    let maintenance_state = app_state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(600));
        loop {
            interval.tick().await;
            if maintenance_state.database_is_ready() {
                routes::remove_expired(&pool).await;
            }
        }
    });

    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(8080);
    let address = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(address).await?;
    tracing::info!(%address, build = build_identity(), "Together Room listening");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;
    Ok(())
}

fn build_app(state: AppState, frontend_dir: PathBuf) -> Router {
    let index = frontend_dir.join("index.html");
    let static_files = ServeDir::new(frontend_dir).fallback(ServeFile::new(index));
    let health_state = state.clone();
    Router::new()
        .route(
            "/health",
            get(move || {
                let health_state = health_state.clone();
                async move {
                    let status = if health_state.database_is_ready() {
                        "ok"
                    } else {
                        "starting"
                    };
                    Json(json!({ "status": status, "build": build_identity() }))
                }
            }),
        )
        .nest("/api", routes::api_router(state.clone()))
        .fallback_service(static_files)
        // Keep common response/security layers outside this short-circuit so 429s
        // carry the same cache and browser policy as every other API response.
        .layer(middleware::from_fn_with_state(state, rate_limit_room_requests))
        .layer(RequestBodyLimitLayer::new(16 * 1024))
        .layer(SetResponseHeaderLayer::if_not_present(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff")))
        .layer(SetResponseHeaderLayer::if_not_present(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY")))
        .layer(SetResponseHeaderLayer::if_not_present(header::REFERRER_POLICY, HeaderValue::from_static("no-referrer")))
        .layer(SetResponseHeaderLayer::if_not_present(header::STRICT_TRANSPORT_SECURITY, HeaderValue::from_static("max-age=63072000; includeSubDomains")))
        .layer(SetResponseHeaderLayer::if_not_present(header::CONTENT_SECURITY_POLICY, HeaderValue::from_static("default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' wss: ws: https://api.sociobot.in; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://api.sociobot.in")))
        .layer(CompressionLayer::new())
        .layer(middleware::from_fn(mark_unknown_navigation))
        .layer(middleware::from_fn(cache_headers))
        .layer(CatchPanicLayer::new())
        .layer(TraceLayer::new_for_http().make_span_with(|request: &Request| {
            // Never log query strings: WebSocket reconnect keys travel in the query.
            tracing::info_span!(
                "http_request",
                method = %request.method(),
                path = %request.uri().path()
            )
        }))
}

fn build_identity() -> &'static str {
    env!("BUILD_SHA")
}

async fn rate_limit_room_requests(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let Some(bucket) = room_request_bucket(request.method(), request.uri().path()) else {
        return next.run(request).await;
    };
    let client = state.client_identity(request.headers(), request.extensions());
    if let Err(retry_after) = state.take_room_request(&client, bucket).await {
        let mut response = (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({
                "error": "Too many room requests from this connection. Please wait a minute and try again."
            })),
        )
            .into_response();
        response.headers_mut().insert(
            header::RETRY_AFTER,
            HeaderValue::from_str(&retry_after.to_string())
                .expect("a computed retry delay is a valid header value"),
        );
        return response;
    }
    next.run(request).await
}

fn room_request_bucket(method: &Method, path: &str) -> Option<routes::RoomRequestBucket> {
    if method == Method::POST && path == "/api/rooms" {
        Some(routes::RoomRequestBucket::Create)
    } else if method == Method::GET && path == "/api/demo" {
        Some(routes::RoomRequestBucket::Demo)
    } else if method == Method::POST && path.starts_with("/api/rooms/") && path.ends_with("/join") {
        Some(routes::RoomRequestBucket::Join)
    } else if method == Method::GET && path.starts_with("/api/rooms/") && path.ends_with("/socket")
    {
        Some(routes::RoomRequestBucket::Socket)
    } else {
        None
    }
}

async fn mark_unknown_navigation(request: Request, next: Next) -> Response {
    let path = request.uri().path().to_owned();
    let should_be_not_found = request.method() == Method::GET
        && !matches!(path.as_str(), "/" | "/demo" | "/privacy" | "/terms")
        && !path.starts_with("/api/")
        && path != "/health";
    let mut response = next.run(request).await;
    let is_html = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.starts_with("text/html"));
    if should_be_not_found && is_html && response.status().is_success() {
        *response.status_mut() = StatusCode::NOT_FOUND;
    }
    response
}

async fn cache_headers(request: Request, next: Next) -> Response {
    let path = request.uri().path().to_owned();
    let mut response = next.run(request).await;
    let value = if path.starts_with("/api/") || path == "/health" {
        "no-store"
    } else if path.starts_with("/assets/index-") {
        "public, max-age=31536000, immutable"
    } else if path.starts_with("/assets/") {
        "public, max-age=86400"
    } else {
        "no-cache"
    };
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static(value));
    response
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = terminate => {} }
}

#[cfg(test)]
mod tests {
    use std::{net::IpAddr, str::FromStr};

    use axum::{body::Body, extract::ConnectInfo, http::Request};
    use http_body_util::BodyExt;
    use rand::Rng;
    use tower::ServiceExt;

    use super::*;

    async fn test_app() -> Router {
        let name: u64 = rand::rng().random();
        let pool = db::connect(&format!(
            "sqlite://rate-limit-{name}?mode=memory&cache=shared"
        ))
        .await
        .unwrap();
        build_app(AppState::new(pool), PathBuf::from("dist"))
    }

    fn client_request(method: Method, path: &str, client: &str) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(path)
            .extension(ConnectInfo(SocketAddr::new(
                IpAddr::from_str(client).unwrap(),
                12345,
            )))
            .body(Body::empty())
            .unwrap()
    }

    fn forwarded_request(method: Method, path: &str, spoofed: &str) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(path)
            // The trusted edge appends the network-observed address. A caller can
            // control only the prefix and must not gain a new limiter bucket.
            .header("x-forwarded-for", format!("{spoofed}, 203.0.113.40"))
            .body(Body::empty())
            .unwrap()
    }

    // @claim:rate-limits
    #[tokio::test]
    async fn claim_rate_limits_return_retry_after_for_every_room_boundary() {
        for (method, path, attempts) in [
            (Method::POST, "/api/rooms", routes::CREATE_ROOM_LIMIT),
            (
                Method::POST,
                "/api/rooms/000000/join",
                routes::JOIN_ROOM_LIMIT,
            ),
            (
                Method::GET,
                "/api/rooms/000000/socket",
                routes::SOCKET_UPGRADE_LIMIT,
            ),
        ] {
            let app = test_app().await;
            for _ in 0..attempts {
                let response = app
                    .clone()
                    .oneshot(client_request(method.clone(), path, "203.0.113.10"))
                    .await
                    .unwrap();
                assert_ne!(response.status(), StatusCode::TOO_MANY_REQUESTS);
            }
            let response = app
                .oneshot(client_request(method, path, "203.0.113.10"))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
            assert_eq!(response.headers().get(header::RETRY_AFTER).unwrap(), "60");
            assert_eq!(
                response.headers().get(header::CACHE_CONTROL).unwrap(),
                "no-store"
            );
            assert!(response
                .headers()
                .contains_key(header::CONTENT_SECURITY_POLICY));
            let body = response.into_body().collect().await.unwrap().to_bytes();
            assert!(std::str::from_utf8(&body)
                .unwrap()
                .contains("Too many room requests"));
        }
    }

    #[tokio::test]
    async fn room_limit_does_not_share_a_bucket_between_clients() {
        let app = test_app().await;
        for _ in 0..routes::CREATE_ROOM_LIMIT {
            let response = app
                .clone()
                .oneshot(client_request(Method::POST, "/api/rooms", "203.0.113.10"))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
        }
        let response = app
            .oneshot(client_request(Method::POST, "/api/rooms", "203.0.113.11"))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn forwarded_client_ip_is_used_only_when_the_proxy_is_trusted() {
        let request = Request::builder()
            .header("x-forwarded-for", "198.51.100.7, 10.0.0.2")
            .extension(ConnectInfo(SocketAddr::new(
                IpAddr::from_str("203.0.113.10").unwrap(),
                12345,
            )))
            .body(Body::empty())
            .unwrap();
        let untrusted = AppState::new(db::connect("sqlite::memory:?cache=shared").await.unwrap());
        assert_eq!(
            untrusted.client_identity(request.headers(), request.extensions()),
            "203.0.113.10"
        );
        let trusted = untrusted.with_trusted_proxy_headers(true);
        assert_eq!(
            trusted.client_identity(request.headers(), request.extensions()),
            "10.0.0.2"
        );
    }

    #[tokio::test]
    async fn caller_supplied_forwarded_prefix_cannot_reset_a_trusted_proxy_bucket() {
        let state = AppState::new(db::connect("sqlite::memory:?cache=shared").await.unwrap())
            .with_trusted_proxy_headers(true);
        for spoofed in ["198.51.100.7", "198.51.100.8"] {
            let request = Request::builder()
                .header("x-forwarded-for", format!("{spoofed}, 203.0.113.40"))
                .body(Body::empty())
                .unwrap();
            assert_eq!(
                state.client_identity(request.headers(), request.extensions()),
                "203.0.113.40"
            );
        }
    }

    #[tokio::test]
    async fn forwarded_prefix_rotation_cannot_bypass_any_room_rate_limit() {
        for (method, path, attempts) in [
            (Method::POST, "/api/rooms", routes::CREATE_ROOM_LIMIT),
            (
                Method::POST,
                "/api/rooms/000000/join",
                routes::JOIN_ROOM_LIMIT,
            ),
            (
                Method::GET,
                "/api/rooms/000000/socket",
                routes::SOCKET_UPGRADE_LIMIT,
            ),
        ] {
            let name: u64 = rand::rng().random();
            let pool = db::connect(&format!(
                "sqlite://forwarded-limit-{name}?mode=memory&cache=shared"
            ))
            .await
            .unwrap();
            let app = build_app(
                AppState::new(pool).with_trusted_proxy_headers(true),
                PathBuf::from("dist"),
            );
            for attempt in 0..attempts {
                let response = app
                    .clone()
                    .oneshot(forwarded_request(
                        method.clone(),
                        path,
                        &format!("198.51.100.{}", attempt + 1),
                    ))
                    .await
                    .unwrap();
                assert_ne!(response.status(), StatusCode::TOO_MANY_REQUESTS);
            }
            let response = app
                .oneshot(forwarded_request(method, path, "198.51.100.250"))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        }
    }

    #[tokio::test]
    async fn health_reports_the_compiled_build_identity() {
        let response = test_app()
            .await
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let value: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(value["build"], build_identity());
        assert!(!build_identity().is_empty());
        assert_ne!(value["build"], "unknown");
    }
}
