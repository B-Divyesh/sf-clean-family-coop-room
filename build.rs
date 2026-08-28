use std::{env, process::Command};

fn main() {
    println!("cargo:rerun-if-env-changed=BUILD_SHA");
    println!("cargo:rerun-if-changed=.git/HEAD");

    // A supplied build argument wins in container builds. Local Cargo builds retain a
    // useful identity by reading the checked-out revision rather than reporting a
    // misleading development label.
    let build_sha = env::var("BUILD_SHA")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(git_sha)
        .filter(|value| is_full_git_sha(value))
        .unwrap_or_else(|| panic!("BUILD_SHA must be the immutable 40-character Git commit SHA"));
    println!("cargo:rustc-env=BUILD_SHA={build_sha}");
}

fn is_full_git_sha(value: &str) -> bool {
    value.len() == 40 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn git_sha() -> Option<String> {
    let output = Command::new("git")
        .args(["rev-parse", "--verify", "HEAD"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let sha = String::from_utf8(output.stdout).ok()?.trim().to_owned();
    (!sha.is_empty()).then_some(sha)
}
