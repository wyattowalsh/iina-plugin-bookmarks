# Nix / Home Manager install (community, optional)

> Community-maintained integration for macOS users. This path is optional and not part of the official Homebrew flow.

This folder contains a minimal Nix scaffold that uses the v1.1.0 GitHub release asset:

- `https://github.com/wyattowalsh/iina-plugin-bookmarks/releases/download/v1.1.0/iina-plugin-bookmarks.iinaplgz`

## 1) Build the plugin payload from release asset

```bash
cd packaging/nix
nix build .#iina-plugin-bookmarks
```

`flake.nix` starts with `hash = pkgs.lib.fakeHash;` as a scaffold.
On first build, copy the reported hash into `flake.nix` and rerun `nix build`.

## 2) Link into the IINA plugin directory (manual Nix usage)

```bash
mkdir -p "$HOME/Library/Application Support/com.colliderli.iina/plugins"
ln -sfn "$(pwd)/result" "$HOME/Library/Application Support/com.colliderli.iina/plugins/iina-plugin-bookmarks.iinaplugin"
```

Restart IINA after updating the symlink.

## 3) Home Manager option

`flake.nix` also exports a Home Manager module that manages the same symlink path:

```nix
{
  modules = [
    iina-plugin-bookmarks.homeManagerModules.default
  ];
}
```
