use std::env;

fn main() {
    println!("cargo:rerun-if-env-changed=BUILD_SHA");

    // Container builds receive BUILD_SHA from the factory. Keep local and explicitly
    // empty builds usable without consulting repository metadata that is not present
    // in the factory's source archive.
    let supplied = env::var("BUILD_SHA").unwrap_or_default();
    let build_sha = match supplied.trim() {
        "" => "dev",
        value => value,
    };
    println!("cargo:rustc-env=BUILD_SHA={build_sha}");
}
