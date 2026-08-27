mod db;
mod game;
mod routes;

use std::{env, net::SocketAddr, path::PathBuf, time::Duration};

use axum::{
    http::{header, HeaderValue},
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

    let database_url =
        env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://together-room.db?mode=rwc".into());
    let frontend_dir = PathBuf::from(env::var("FRONTEND_DIR").unwrap_or_else(|_| "dist".into()));
    let pool = db::connect(&database_url).await?;
    let state = AppState::new(pool.clone());
    let app = build_app(state, frontend_dir);

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(600));
        loop {
            interval.tick().await;
            routes::remove_expired(&pool).await;
        }
    });

    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(8080);
    let address = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(address).await?;
    tracing::info!(%address, "Together Room listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

fn build_app(state: AppState, frontend_dir: PathBuf) -> Router {
    let index = frontend_dir.join("index.html");
    let static_files = ServeDir::new(frontend_dir).fallback(ServeFile::new(index));
    Router::new()
        .route("/health", get(|| async { Json(json!({ "status": "ok", "build": option_env!("BUILD_SHA").unwrap_or("dev") })) }))
        .nest("/api", routes::api_router(state))
        .fallback_service(static_files)
        .layer(RequestBodyLimitLayer::new(16 * 1024))
        .layer(SetResponseHeaderLayer::if_not_present(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff")))
        .layer(SetResponseHeaderLayer::if_not_present(header::X_FRAME_OPTIONS, HeaderValue::from_static("DENY")))
        .layer(SetResponseHeaderLayer::if_not_present(header::REFERRER_POLICY, HeaderValue::from_static("no-referrer")))
        .layer(SetResponseHeaderLayer::if_not_present(header::CONTENT_SECURITY_POLICY, HeaderValue::from_static("default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' wss: ws: https://api.sociobot.in; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://api.sociobot.in")))
        .layer(CompressionLayer::new())
        .layer(CatchPanicLayer::new())
        .layer(TraceLayer::new_for_http())
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
