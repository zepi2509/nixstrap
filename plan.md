# NixOS Bootstrap CLI Migration Plan

## Overview

Migrate the existing bash-based NixOS bootstrap installer to a Deno TypeScript CLI for improved developer experience, maintainability, and extensibility.

## Goals

- `curl | sh` installable via single static binary
- Dashlane CLI integration for secret management (GitHub token, SOPS age key)
- Interactive disk selection with disko
- Host selection from flake's `nixosConfigurations`
- Future: modular host creation with module selection

## Tech Stack

- **Runtime**: Deno 2.x
- **Prompts**: `@cliffy/prompt`
- **Compilation**: `deno compile --target x86_64-unknown-linux-gnu`

## Project Structure

```
nixstrap/
├── deno.json
├── main.ts
├── src/
│   ├── commands/
│   │   └── install.ts       # Main installation flow
│   ├── lib/
│   │   ├── dashlane.ts      # FHS env + dcli wrapper
│   │   ├── disk.ts          # lsblk parsing + selection
│   │   ├── flake.ts         # Future: flake generation
│   │   ├── nix.ts           # nix/disko/nixos-install wrappers
│   │   └── shell.ts         # Command execution utilities
│   └── ui/
│       └── prompts.ts       # Shared prompt utilities
└── plan.md
```

## Implementation Steps

### Phase 1: Core Infrastructure

- [ ] Initialize Deno project with `deno.json`
- [ ] Implement `shell.ts` — command execution with stdin/stdout handling
- [ ] Implement `nix.ts` — nix commands with access token support

### Phase 2: Dashlane Integration

- [ ] Download dcli binary to `/tmp/dcli`
- [ ] Build FHS environment with required libs:
  - `glibc`, `stdenv.cc.cc.lib`, `zlib`
  - Potentially: `openssl`, `libsecret`, `glib`, `nss`, `dbus`
- [ ] Wrapper function to run dcli inside FHS
- [ ] Interactive login with TTY passthrough for 2FA
- [ ] Fetch `github-token` and `sops-age-key` secure notes

### Phase 3: Disk Selection

- [ ] Parse `lsblk --json` output
- [ ] Filter out loop/sr devices
- [ ] Present interactive selection via `@cliffy/prompt`

### Phase 4: Host Selection

- [ ] Run `nix flake show --json` with access token
- [ ] Parse `nixosConfigurations` keys
- [ ] Present interactive selection

### Phase 5: Installation

- [ ] Run disko: `nix run github:nix-community/disko -- --mode disko --flake <url>#<host>`
- [ ] Install age key to `/mnt/var/lib/sops-nix/key.txt`
- [ ] Run `nixos-install --flake <url>#<host> --no-root-passwd`

### Phase 6: Distribution

- [ ] Compile static binary: `deno compile --allow-all --target x86_64-unknown-linux-gnu`
- [ ] Host binary (GitHub Releases or own server)
- [ ] Create install script for `curl | sh`

## Known Issues to Address

1. **FHS for dcli**: Dashlane CLI requires glibc environment; NixOS doesn't provide this natively
2. **TTY passthrough**: dcli login needs interactive terminal for 2FA
3. **Disko `--arg` syntax**: Verify correct quoting for disk path argument

## Future Enhancements

- [ ] `add-host` command — interactive host creation with module selection
- [ ] Config file support (`.nixstrap.json`)
- [ ] Dry-run mode
- [ ] Logging to file
- [ ] Progress indicators for long operations

## Commands

```bash
# Development
deno task dev

# Compile
deno task compile

# Run compiled binary
./nixstrap
```

## Flake URL

```
github:zepi2509/nixos
```
