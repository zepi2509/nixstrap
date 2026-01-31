import { runCommand, runInteractive, ShellResult } from "./shell.ts";

const DCLI_VERSION = "6.2450.0";
const DCLI_DOWNLOAD_URL =
  `https://github.com/Dashlane/dashlane-cli/releases/download/v${DCLI_VERSION}/dcli-linux-x64`;
const DCLI_PATH = "/tmp/dcli";

export interface FHSOptions {
  additionalPkgs?: string[];
}

export async function downloadDcli(): Promise<void> {
  console.log("Downloading Dashlane CLI...");

  const result = await runCommand([
    "curl",
    "-sL",
    "-o",
    DCLI_PATH,
    DCLI_DOWNLOAD_URL,
  ]);

  if (!result.success) {
    throw new Error(`Failed to download dcli: ${result.stderr}`);
  }

  await runCommand(["chmod", "+x", DCLI_PATH]);
  console.log("Dashlane CLI downloaded successfully");
}

export async function ensureDcli(): Promise<string> {
  try {
    await Deno.stat(DCLI_PATH);
  } catch {
    await downloadDcli();
  }
  return DCLI_PATH;
}

export async function buildFHSEnvironment(options: FHSOptions = {}): Promise<string> {
  const fhsScriptPath = "/tmp/nixstrap-fhs";

  const packages = [
    "glibc",
    "stdenv.cc.cc.lib",
    "zlib",
    ...(options.additionalPkgs || []),
  ];

  const nixExpr = `
{ pkgs ? import <nixpkgs> {} }:
pkgs.buildFHSEnv {
  name = "nixstrap-fhs";
  targetPkgs = pkgs: with pkgs; [
    ${packages.map((p) => "    " + p).join("\n")}
  ];
}
`;

  await Deno.writeTextFile("/tmp/fhs-env.nix", nixExpr);

  console.log("Building FHS environment (this may take a moment)...");
  const result = await runCommand([
    "nix",
    "build",
    "--file",
    "/tmp/fhs-env.nix",
    "--out-link",
    fhsScriptPath,
  ]);

  if (!result.success) {
    throw new Error(`Failed to build FHS environment: ${result.stderr}`);
  }

  return fhsScriptPath + "/bin/nixstrap-fhs";
}

export async function runInFHS(
  cmd: string[],
  options: { env?: Record<string, string>; stdin?: "inherit" | "null" } = {},
): Promise<ShellResult> {
  const fhsPath = await buildFHSEnvironment();
  const dcliPath = await ensureDcli();

  // Set up environment with DCLI path
  const env: Record<string, string> = {
    ...options.env,
    DCLI_PATH: dcliPath,
  };

  // Run command inside FHS environment
  return await runCommand([fhsPath, ...cmd], { env, stdin: options.stdin });
}

export async function runInteractiveInFHS(
  cmd: string[],
  options: { env?: Record<string, string> } = {},
): Promise<number> {
  const fhsPath = await buildFHSEnvironment();
  const dcliPath = await ensureDcli();

  const env: Record<string, string> = {
    ...options.env,
    DCLI_PATH: dcliPath,
  };

  return await runInteractive([fhsPath, ...cmd], { env });
}

export async function dcliLogin(): Promise<void> {
  const dcliPath = await ensureDcli();
  const fhsPath = await buildFHSEnvironment();

  console.log("Starting Dashlane CLI login...");
  console.log("You will be prompted for your credentials and 2FA code.");

  const code = await runInteractive([fhsPath, dcliPath, "login"], {
    env: { DCLI_PATH: dcliPath },
  });

  if (code !== 0) {
    throw new Error(`Dashlane login failed with exit code ${code}`);
  }

  console.log("Dashlane login successful!");
}

export async function dcliIsLoggedIn(): Promise<boolean> {
  try {
    const dcliPath = await ensureDcli();

    const result = await runInFHS([dcliPath, "whoami"], { stdin: "null" });
    return result.success && result.stdout.includes("@");
  } catch {
    return false;
  }
}

export async function dcliLogout(): Promise<void> {
  const dcliPath = await ensureDcli();
  await runInFHS([dcliPath, "logout"]);
}

export async function getSecureNote(title: string): Promise<string | null> {
  const dcliPath = await ensureDcli();

  const result = await runInFHS(
    [dcliPath, "note", "--title", title, "--output", "json"],
    { stdin: "null" },
  );

  if (!result.success) {
    if (result.stderr.includes("not found")) {
      return null;
    }
    throw new Error(`Failed to fetch secure note: ${result.stderr}`);
  }

  try {
    const data = JSON.parse(result.stdout);
    return data.content || null;
  } catch {
    // If JSON parsing fails, return raw output
    return result.stdout.trim() || null;
  }
}

export async function getSecret(secretName: string): Promise<string | null> {
  // Try to get from secure notes first
  const note = await getSecureNote(secretName);
  if (note) {
    return note;
  }

  // List available notes for debugging
  const dcliPath = await ensureDcli();
  const listResult = await runInFHS(
    [dcliPath, "note"],
    { stdin: "null" },
  );

  if (!listResult.success) {
    console.warn("Could not list secure notes");
    return null;
  }

  // Search case-insensitive in the list
  const availableNotes = listResult.stdout.split("\n").map((n) => n.trim()).filter(Boolean);
  const match = availableNotes.find((n) => n.toLowerCase() === secretName.toLowerCase());

  if (match) {
    return await getSecureNote(match);
  }

  return null;
}

export async function getRequiredSecrets(): Promise<{
  githubToken: string;
  ageKey: string;
}> {
  console.log("Fetching secrets from Dashlane...");

  const githubToken = await getSecret("github-token");
  if (!githubToken) {
    throw new Error(
      "Could not find 'github-token' secure note in Dashlane. " +
        "Please create a secure note with this exact title containing your GitHub personal access token.",
    );
  }

  const ageKey = await getSecret("sops-age-key");
  if (!ageKey) {
    throw new Error(
      "Could not find 'sops-age-key' secure note in Dashlane. " +
        "Please create a secure note with this exact title containing your SOPS age private key.",
    );
  }

  console.log("Successfully retrieved all required secrets!");

  return {
    githubToken: githubToken.trim(),
    ageKey: ageKey.trim(),
  };
}
