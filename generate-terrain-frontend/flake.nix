{
  description = "Dev shell for generate-terrain-frontend (Electron app)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            electron
          ];

          shellHook = ''
            echo "generate-terrain-frontend dev shell"
            echo "  Node.js: $(node --version)"
            echo "  npm:     $(npm --version)"
            echo "  Electron: $(electron --version 2>/dev/null || echo 'not found')"
            export ELECTRON_OVERRIDE_DIST_PATH="${pkgs.electron}/bin/"
          '';
        };
      });
}
