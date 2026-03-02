#!/usr/bin/env bash

set -euo pipefail

readonly REPO_SLUG="wyattowalsh/iina-plugin-bookmarks"
readonly ASSET_NAME="iina-plugin-bookmarks.iinaplgz"

tmp_dir=""

usage() {
  cat <<'EOF'
Usage: scripts/pkg-followup-release.sh vX.Y.Z

Downloads the release asset for a tag, computes SHA-256, and prints
copy-paste snippets for Homebrew cask and Nix scaffold updates.
EOF
}

cleanup() {
  if [[ -n "$tmp_dir" && -d "$tmp_dir" ]]; then
    rm -rf -- "$tmp_dir"
  fi
}

require_command() {
  local cmd="$1"

  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf 'Error: required command not found: %s\n' "$cmd" >&2
    exit 1
  fi
}

sha256_hex_for_file() {
  local file_path="$1"

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file_path" | awk '{print $1}'
    return
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_path" | awk '{print $1}'
    return
  fi

  if command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$file_path" | awk '{print $NF}'
    return
  fi

  printf 'Error: no SHA-256 tool found (shasum, sha256sum, or openssl)\n' >&2
  exit 1
}

main() {
  local tag version asset_url asset_path asset_sha256 nix_sri_hash

  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    exit 0
  fi

  if [[ $# -ne 1 ]]; then
    usage >&2
    exit 1
  fi

  tag="$1"
  if [[ ! "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    printf 'Error: tag must match vX.Y.Z (got: %s)\n' "$tag" >&2
    exit 1
  fi

  require_command curl

  version="${tag#v}"
  asset_url="https://github.com/${REPO_SLUG}/releases/download/${tag}/${ASSET_NAME}"

  trap cleanup EXIT
  tmp_dir="$(mktemp -d)"
  asset_path="${tmp_dir}/${ASSET_NAME}"

  printf 'Downloading release asset: %s\n' "$asset_url" >&2
  curl --fail --location --silent --show-error --output "$asset_path" "$asset_url"

  asset_sha256="$(sha256_hex_for_file "$asset_path")"
  nix_sri_hash=""
  if command -v nix >/dev/null 2>&1; then
    nix_sri_hash="$(nix hash file --type sha256 --sri "$asset_path")"
  fi

  cat <<EOF
Release tag: ${tag}
Release asset URL:
${asset_url}

SHA-256 (hex): ${asset_sha256}

Homebrew cask update (packaging/homebrew/Casks/iina-plugin-bookmarks.rb):
  version "${version}"
  sha256 "${asset_sha256}"

Nix scaffold update (packaging/nix/flake.nix):
  version = "${version}";
  url = "${asset_url}";
EOF

  if [[ -n "$nix_sri_hash" ]]; then
    cat <<EOF
  hash = "${nix_sri_hash}";
EOF
  else
    cat <<'EOF'
  hash = pkgs.lib.fakeHash;
  # If you have nix installed, run:
  #   (cd packaging/nix && nix build .#iina-plugin-bookmarks)
  # then replace fakeHash with the expected hash from nix output.
EOF
  fi
}

main "$@"
