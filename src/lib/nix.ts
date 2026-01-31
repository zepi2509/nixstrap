import { runCommand, runInteractive, ShellOptions } from "./shell.ts";

export interface NixFlakeConfig {
  url: string;
  token?: string;
}

export async function testNixInstallation(): Promise<boolean> {
  const result = await runCommand(["nix", "--version"]);
  return result.success;
}

export async function getNixosConfigurations(
  flakeUrl: string,
  token?: string,
): Promise<string[]> {
  const env: Record<string, string> = {};
  if (token) {
    env["NIX_GITHUB_TOKEN"] = token;
    env["GITHUB_TOKEN"] = token;
  }

  const result = await runCommand(
    ["nix", "flake", "show", "--json", flakeUrl],
    { env, stderr: "piped" },
  );

  if (!result.success) {
    throw new Error(`Failed to fetch flake info: ${result.stderr}`);
  }

  try {
    const data = JSON.parse(result.stdout);
    const configs = data.nixosConfigurations;
    if (!configs || typeof configs !== "object") {
      return [];
    }
    return Object.keys(configs);
  } catch (e) {
    throw new Error(`Failed to parse flake output: ${(e as Error).message}`);
  }
}

export interface DiskoOptions {
  flakeUrl: string;
  host: string;
  diskPath: string;
  token?: string;
}

export async function runDisko(options: DiskoOptions): Promise<number> {
  const env: Record<string, string> = {};
  if (options.token) {
    env["NIX_GITHUB_TOKEN"] = options.token;
    env["GITHUB_TOKEN"] = options.token;
  }

  return await runInteractive(
    [
      "nix",
      "run",
      "github:nix-community/disko",
      "--",
      "--mode",
      "disko",
      "--flake",
      `${options.flakeUrl}#${options.host}`,
    ],
    { env },
  );
}

export interface InstallOptions {
  flakeUrl: string;
  host: string;
  token?: string;
  noRootPassword?: boolean;
}

export async function runNixosInstall(options: InstallOptions): Promise<number> {
  const env: Record<string, string> = {};
  if (options.token) {
    env["NIX_GITHUB_TOKEN"] = options.token;
    env["GITHUB_TOKEN"] = options.token;
  }

  const args = [
    "nixos-install",
    "--flake",
    `${options.flakeUrl}#${options.host}`,
  ];

  if (options.noRootPassword) {
    args.push("--no-root-passwd");
  }

  return await runInteractive(args, { env });
}

export async function ensureSopsAgeKeyDir(): Promise<void> {
  await runCommand(["mkdir", "-p", "/mnt/var/lib/sops-nix"]);
}

export async function writeAgeKey(keyContent: string): Promise<void> {
  await ensureSopsAgeKeyDir();
  const encoder = new TextEncoder();
  await Deno.writeFile("/mnt/var/lib/sops-nix/key.txt", encoder.encode(keyContent));
  await runCommand(["chmod", "600", "/mnt/var/lib/sops-nix/key.txt"]);
}

export function formatFlakeUrl(owner: string, repo: string, ref?: string): string {
  if (ref) {
    return `github:${owner}/${repo}/${ref}`;
  }
  return `github:${owner}/${repo}`;
}

export function parseFlakeUrl(url: string): { owner: string; repo: string; ref?: string } | null {
  const githubMatch = url.match(/^github:([^/]+)\/([^/]+)(?:\/(.+))?$/);
  if (githubMatch) {
    return {
      owner: githubMatch[1],
      repo: githubMatch[2],
      ref: githubMatch[3],
    };
  }

  const httpsMatch = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/(.+))?$/);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2],
      ref: httpsMatch[3],
    };
  }

  return null;
}
