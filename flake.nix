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
          runtimeInputs = with pkgs; [ pkgs.deno ];
          text = ''
            # Set writable home for Deno cache  
            export HOME=/tmp
            
            # Run from current directory
            deno run --allow-all --no-lock main.ts "$@"
          '';
          checkPhase = "true";
        };

        apps.default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/nixstrap";
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [ pkgs.deno ];
        };
      }
    );
}


