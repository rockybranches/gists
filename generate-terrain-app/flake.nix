{
  description = "generate-terrain-app — standalone Electron app for 3D terrain generation";
  
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        packages.default = pkgs.buildNpmPackage {
          pname = "generate-terrain-app";
          version = "2.0.1";
          src = pkgs.lib.cleanSource ./.;

          npmDepsHash = "sha256-XDGPB6EKfMA3fxpIxwRYrQBnUpjuiGMu6tZ0MfWN4y8=";

          npmFlags = [ "--ignore-scripts" ];

          nativeBuildInputs = with pkgs; [ makeWrapper ];

          buildInputs = with pkgs; [ electron ];

          buildPhase = ''
            npm run build
          '';

          installPhase = ''
            mkdir -p $out/lib/generate-terrain-app $out/bin
            cp -r dist main.js preload.js renderer.js index.html package.json $out/lib/generate-terrain-app/

            makeWrapper ${pkgs.electron}/bin/electron $out/bin/generate-terrain-app \
              --add-flags "$out/lib/generate-terrain-app"
          '';

          meta = {
            description = "Standalone Electron app for 3D terrain generation — no Python backend required";
            homepage = "https://github.com/anomalyco/gists";
            license = "ISC";
          };
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            electron
            wine  # for electron-builder Windows cross-compilation
          ];

          shellHook = ''
            echo "generate-terrain-app dev shell"
            echo "  Node.js: $(node --version)"
            echo "  npm:     $(npm --version)"
            echo "  Electron: $(electron --version 2>/dev/null || echo 'not found')"
            export ELECTRON_OVERRIDE_DIST_PATH="${pkgs.electron}/bin/"
          '';
        };
      });
}
