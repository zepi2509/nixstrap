import { Select } from "@cliffy/prompt";
import { colors } from "@cliffy/ansi/colors";
import { DiskInfo, formatDiskDisplay } from "../lib/disk.ts";

export async function promptSelectDisk(disks: DiskInfo[]): Promise<DiskInfo> {
  if (disks.length === 0) {
    throw new Error("No disks found on the system");
  }

  const options = disks.map((disk) => ({
    value: disk,
    name: formatDiskDisplay(disk),
  }));

  const selected = await Select.prompt({
    message: "Select target disk for installation",
    options,
    search: true,
  });

  return selected;
}

export async function promptSelectHost(hosts: string[]): Promise<string> {
  if (hosts.length === 0) {
    throw new Error("No hosts found in flake configuration");
  }

  if (hosts.length === 1) {
    console.log(colors.green(`Using single available host: ${hosts[0]}`));
    return hosts[0];
  }

  const selected = await Select.prompt({
    message: "Select NixOS host configuration",
    options: hosts.map((h) => ({ value: h, name: h })),
    search: true,
  });

  return selected;
}

export async function promptConfirm(
  message: string,
  defaultValue = false,
): Promise<boolean> {
  const { Confirm } = await import("@cliffy/prompt");

  return await Confirm.prompt({
    message,
    default: defaultValue,
  });
}

export async function promptInput(
  message: string,
  options: { default?: string; validate?: (value: string) => boolean | string } = {},
): Promise<string> {
  const { Input } = await import("@cliffy/prompt");

  return await Input.prompt({
    message,
    default: options.default,
    validate: options.validate,
  });
}

export async function promptPassword(message: string): Promise<string> {
  const { Secret } = await import("@cliffy/prompt");

  return await Secret.prompt({
    message,
    minLength: 1,
  });
}

export function showWarning(message: string): void {
  console.log(colors.yellow(`⚠ ${message}`));
}

export function showError(message: string): void {
  console.log(colors.red(`✗ ${message}`));
}

export function showSuccess(message: string): void {
  console.log(colors.green(`✓ ${message}`));
}

export function showInfo(message: string): void {
  console.log(colors.blue(`ℹ ${message}`));
}

export function showStep(step: number, total: number, message: string): void {
  console.log(colors.cyan(`\n[${step}/${total}] ${message}`));
}
