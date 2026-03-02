{
  description = "Community Nix scaffold for iina-plugin-bookmarks on macOS";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";

  outputs = { self, nixpkgs }:
    let
      systems = [ "aarch64-darwin" "x86_64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in rec {
          iina-plugin-bookmarks = pkgs.stdenvNoCC.mkDerivation {
            pname = "iina-plugin-bookmarks";
            version = "1.1.0";

            src = pkgs.fetchurl {
              url = "https://github.com/wyattowalsh/iina-plugin-bookmarks/releases/download/v1.1.0/iina-plugin-bookmarks.iinaplgz";
              hash = pkgs.lib.fakeHash;
            };

            nativeBuildInputs = [ pkgs.unzip ];
            dontUnpack = true;

            installPhase = ''
              mkdir -p "$out"
              unzip -q "$src" -d "$out"
            '';
          };

          default = iina-plugin-bookmarks;
        });

      homeManagerModules.default = { pkgs, ... }:
        let
          plugin = self.packages.${pkgs.system}.iina-plugin-bookmarks;
        in {
          home.file."Library/Application Support/com.colliderli.iina/plugins/iina-plugin-bookmarks.iinaplugin".source = plugin;
        };
    };
}
