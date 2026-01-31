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
        inherit (pkgs) deno;
      in
      {
        packages.default = pkgs.stdenv.mkDerivation {
          pname = "nixstrap";
          version = "1.0.0";
          src = ./.;
          
          nativeBuildInputs = [ deno ];
          
          buildPhase = ''
            deno compile --allow-all -o nixstrap main.ts
          '';
          
          installPhase = ''
            mkdir -p $out/bin
            cp nixstrap $out/bin/nixstrap
            chmod +x $out/bin/nixstrap
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
