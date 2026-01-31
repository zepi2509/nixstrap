{
  description = "NixOS Bootstrap CLI - Interactive NixOS installation tool";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        packages.default = pkgs.writeShellApplication {
          name = "nixstrap";
          runtimeInputs = with pkgs; [ deno ];
          text = ''
            exec deno run --allow-all ${./main.ts} "$@"
          '';
        };

        apps.default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/nixstrap";
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            deno
          ];
        };
      }
    );
}
