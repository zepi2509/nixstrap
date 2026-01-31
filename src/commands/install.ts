import { Command } from "@cliffy/command";
import { colors } from "@cliffy/ansi/colors";
import { listDisks, validateDiskPath } from "../lib/disk.ts";
import { dcliIsLoggedIn, dcliLogin, getRequiredSecrets } from "../lib/dashlane.ts";
import {
  getNixosConfigurations,
  runDisko,
  runNixosInstall,
  testNixInstallation,
  writeAgeKey,
} from "../lib/nix.ts";
import {
  promptConfirm,
  promptSelectDisk,
  promptSelectHost,
  showError,
  showInfo,
  showStep,
  showSuccess,
  showWarning,
} from "../ui/prompts.ts";

const DEFAULT_FLAKE_URL = "github:zepi2509/nixos";

export const installCommand = new Command()
  .name("install")
  .description("Interactive NixOS installation")
  .option("--flake <url:string>", "Flake URL", { default: DEFAULT_FLAKE_URL })
  .option("--host <host:string>", "Host configuration to install")
  .option("--disk <disk:string>", "Target disk path (e.g., /dev/sda)")
  .option("--github-token <token:string>", "GitHub personal access token")
  .option("--age-key <key:string>", "SOPS age private key")
  .option("--skip-dashlane", "Skip Dashlane integration (use env vars instead)")
  .action(async (options) => {
    console.log(colors.bold.cyan("\n🖥️  NixOS Bootstrap CLI\n"));

    // Step 1: Verify Nix installation
    showStep(1, 5, "Checking Nix installation");
    if (!(await testNixInstallation())) {
      showError("Nix is not installed or not in PATH");
      console.log("Please install Nix first: https://nixos.org/download.html");
      Deno.exit(1);
    }
    showSuccess("Nix is installed");

    // Step 2: Handle secrets (Dashlane or manual)
    showStep(2, 5, "Configuring secrets");
    let githubToken: string | undefined = options.githubToken;
    let ageKey: string | undefined = options.ageKey;

    if (!options.skipDashlane && (!githubToken || !ageKey)) {
      showInfo("Using Dashlane for secret management");

      const isLoggedIn = await dcliIsLoggedIn();
      if (!isLoggedIn) {
        showInfo("You need to log in to Dashlane");
        try {
          await dcliLogin();
        } catch (err) {
          showError(`Dashlane login failed: ${(err as Error).message}`);
          Deno.exit(1);
        }
      } else {
        showSuccess("Already logged in to Dashlane");
      }

      try {
        const secrets = await getRequiredSecrets();
        githubToken = secrets.githubToken;
        ageKey = secrets.ageKey;
      } catch (err) {
        showError(`Failed to fetch secrets: ${(err as Error).message}`);
        Deno.exit(1);
      }
    } else if (options.skipDashlane) {
      showInfo("Skipping Dashlane (using manual/ENV configuration)");

      // Check for env vars if not provided via CLI
      if (!githubToken) {
        githubToken = Deno.env.get("GITHUB_TOKEN");
      }
      if (!ageKey) {
        ageKey = Deno.env.get("SOPS_AGE_KEY");
      }
    }

    if (!githubToken) {
      showError(
        "GitHub token is required (provide via --github-token, GITHUB_TOKEN env var, or Dashlane)",
      );
      Deno.exit(1);
    }

    if (!ageKey) {
      showError(
        "SOPS age key is required (provide via --age-key, SOPS_AGE_KEY env var, or Dashlane)",
      );
      Deno.exit(1);
    }

    // Validate age key format (basic check)
    if (!ageKey.includes("AGE-SECRET-KEY")) {
      showWarning(
        "The age key doesn't appear to be in the correct format (should contain 'AGE-SECRET-KEY')",
      );
      const proceed = await promptConfirm("Continue anyway?", false);
      if (!proceed) {
        Deno.exit(1);
      }
    }

    showSuccess("Secrets configured");

    // Step 3: Select host configuration
    showStep(3, 5, "Selecting host configuration");
    let host = options.host;

    if (!host) {
      showInfo(`Fetching hosts from ${options.flake}...`);
      try {
        const hosts = await getNixosConfigurations(options.flake, githubToken);
        if (hosts.length === 0) {
          showError("No NixOS configurations found in the flake");
          Deno.exit(1);
        }
        host = await promptSelectHost(hosts);
      } catch (err) {
        showError(`Failed to fetch host configurations: ${(err as Error).message}`);
        Deno.exit(1);
      }
    }

    showSuccess(`Selected host: ${colors.yellow(host)}`);

    // Step 4: Select target disk
    showStep(4, 5, "Selecting target disk");
    let diskPath = options.disk;

    if (!diskPath) {
      try {
        const disks = await listDisks();
        if (disks.length === 0) {
          showError("No suitable disks found on the system");
          Deno.exit(1);
        }

        showInfo("Available disks:");
        const selected = await promptSelectDisk(disks);
        diskPath = selected.path;
      } catch (err) {
        showError(`Failed to list disks: ${(err as Error).message}`);
        Deno.exit(1);
      }
    } else {
      // Validate provided disk path
      if (!(await validateDiskPath(diskPath))) {
        showError(`Invalid disk path: ${diskPath}`);
        Deno.exit(1);
      }
    }

    showSuccess(`Selected disk: ${colors.yellow(diskPath)}`);

    // Final confirmation
    console.log(colors.bold("\n📋 Installation Summary:"));
    console.log(`  Flake:    ${options.flake}`);
    console.log(`  Host:     ${host}`);
    console.log(`  Disk:     ${diskPath}`);
    console.log(`  Secrets:  ${options.skipDashlane ? "Manual/Env" : "Dashlane"}`);

    console.log(colors.red("\n⚠️  WARNING: This will ERASE ALL DATA on the selected disk!"));
    const confirmed = await promptConfirm(
      "Do you want to proceed with the installation?",
      false,
    );

    if (!confirmed) {
      showInfo("Installation cancelled");
      Deno.exit(0);
    }

    // Step 5: Run installation
    showStep(5, 5, "Running installation");

    // Run disko to partition and format
    showInfo("Partitioning and formatting disk (disko)...");
    const diskoCode = await runDisko({
      flakeUrl: options.flake,
      host,
      diskPath,
      token: githubToken,
    });

    if (diskoCode !== 0) {
      showError(`Disko failed with exit code ${diskoCode}`);
      Deno.exit(1);
    }
    showSuccess("Disk partitioning completed");

    // Write age key
    showInfo("Writing SOPS age key...");
    try {
      await writeAgeKey(ageKey);
      showSuccess("Age key written to /mnt/var/lib/sops-nix/key.txt");
    } catch (err) {
      showError(`Failed to write age key: ${(err as Error).message}`);
      Deno.exit(1);
    }

    // Run nixos-install
    showInfo("Running nixos-install (this will take a while)...");
    const installCode = await runNixosInstall({
      flakeUrl: options.flake,
      host,
      token: githubToken,
      noRootPassword: true,
    });

    if (installCode !== 0) {
      showError(`nixos-install failed with exit code ${installCode}`);
      Deno.exit(1);
    }

    console.log(colors.bold.green("\n✅ Installation completed successfully!"));
    console.log("\nNext steps:");
    console.log("  1. Reboot: reboot");
    console.log("  2. Log in with your configured user");
    console.log("  3. Your secrets are already configured via sops-nix");
  });
