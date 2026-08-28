const DOCKERFILE: &str = include_str!("../Dockerfile");
const BUILD_SCRIPT: &str = include_str!("../build.rs");
const DOCKERIGNORE: &str = include_str!("../.dockerignore");

#[test]
fn container_build_does_not_require_repository_metadata() {
    assert!(
        !DOCKERFILE.contains(".git"),
        "the factory build context excludes repository metadata"
    );
    assert!(
        !BUILD_SCRIPT.contains(".git") && !BUILD_SCRIPT.contains("Command::new(\"git\")"),
        "the build script must use the supplied identity without consulting Git"
    );
    assert!(
        DOCKERIGNORE.lines().any(|line| line.trim() == ".git"),
        "local container contexts should match the factory's metadata-free archive"
    );
}

#[test]
fn build_sha_is_baked_into_backend_and_runtime_identity() {
    assert!(DOCKERFILE.contains("ARG BUILD_SHA=dev"));

    let backend = DOCKERFILE
        .split("FROM rust:1.88-bookworm AS backend")
        .nth(1)
        .and_then(|rest| rest.split("FROM debian:bookworm-slim AS runtime").next())
        .expect("backend stage");
    assert!(backend.contains("ARG BUILD_SHA"));
    assert!(backend.contains("ENV BUILD_SHA=${BUILD_SHA}"));

    let runtime = DOCKERFILE
        .split("FROM debian:bookworm-slim AS runtime")
        .nth(1)
        .expect("runtime stage");
    assert!(runtime.contains("ARG BUILD_SHA"));
    assert!(runtime.contains("org.opencontainers.image.revision=${BUILD_SHA}"));
    assert!(runtime.contains("BUILD_SHA=${BUILD_SHA}"));
}
