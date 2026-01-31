# Nixstrap

Interactive NixOS installation tool with Dashlane secret management integration.

## Features

- 🖥️ Interactive disk selection with `lsblk` integration
- 🔐 Secure secret retrieval from Dashlane
- 🏠 Host selection from flake configurations
- 📦 Automated disk partitioning via `disko`
- 🔧 SOPS age key configuration
- 🚀 One-command NixOS installation

## Installation

```bash
curl -sL https://github.com/zepi2509/nixstrap/releases/latest/download/install.sh | sh
```

Or build from source:

```bash
git clone https://github.com/zepi2509/nixstrap.git
cd nixstrap
deno task compile
```

## Usage

### Interactive Mode (Recommended)

```bash
nixstrap install
```

This will guide you through:

1. Dashlane login (if not already logged in)
2. Host selection from your flake
3. Disk selection
4. Installation confirmation

### Command Line Options

```bash
nixstrap install --flake github:zepi2509/nixos --host myhost --disk /dev/nvme0n1
```

### Environment Variables

Instead of using Dashlane, you can provide secrets via environment variables:

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
export SOPS_AGE_KEY="AGE-SECRET-KEY-xxxxxxxxxxxx"
nixstrap install --skip-dashlane
```

## Dashlane Setup

Create two secure notes in your Dashlane vault:

1. **github-token** - Your GitHub personal access token
   - Required scopes: `repo`, `read:user`

2. **sops-age-key** - Your SOPS age private key
   - Generate with: `age-keygen -o key.txt`
   - Copy the private key (starts with `AGE-SECRET-KEY`)

## Development

```bash
# Run in development mode
deno task dev

# Compile static binary
deno task compile

# Format code
deno fmt

# Check types
deno check main.ts
```

## Architecture

```
nixstrap/
├── main.ts              # CLI entry point
├── deno.json            # Deno configuration
├── src/
│   ├── commands/
│   │   └── install.ts   # Install command implementation
│   ├── lib/
│   │   ├── shell.ts     # Command execution utilities
│   │   ├── nix.ts       # Nix/disko/nixos-install wrappers
│   │   ├── disk.ts      # Disk discovery and selection
│   │   └── dashlane.ts  # Dashlane CLI integration
│   └── ui/
│       └── prompts.ts   # Interactive prompts
└── README.md
```

## Requirements

- Nix package manager installed
- Internet connection
- (Optional) Dashlane account with CLI access

## License

MIT
