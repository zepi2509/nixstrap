import { runCommand } from "./shell.ts";

export interface DiskInfo {
  name: string;
  path: string;
  size: string;
  model?: string;
  type: string;
  removable: boolean;
  children?: DiskChild[];
}

export interface DiskChild {
  name: string;
  path: string;
  size: string;
  type: string;
  mountpoints?: (string | null)[];
}

export async function listDisks(): Promise<DiskInfo[]> {
  const result = await runCommand(["lsblk", "--json", "--paths"]);

  if (!result.success) {
    throw new Error(`Failed to list disks: ${result.stderr}`);
  }

  const data = JSON.parse(result.stdout);
  const disks: DiskInfo[] = data.blockdevices || [];

  // Filter out loop devices and optical drives
  return disks.filter((disk) => {
    const name = disk.name.toLowerCase();
    return !name.startsWith("loop") && !name.startsWith("sr");
  });
}

export function formatDiskDisplay(disk: DiskInfo): string {
  const parts: string[] = [
    `${disk.path}`,
    `(${disk.size})`,
  ];

  if (disk.model) {
    parts.push(`- ${disk.model}`);
  }

  if (disk.children && disk.children.length > 0) {
    const partitions = disk.children.length;
    parts.push(`[${partitions} partition${partitions !== 1 ? "s" : ""}]`);
  }

  if (disk.removable) {
    parts.push("[removable]");
  }

  return parts.join(" ");
}

export async function validateDiskPath(path: string): Promise<boolean> {
  const result = await runCommand(["test", "-b", path]);
  return result.success;
}

export async function getDiskByPath(
  disks: DiskInfo[],
  path: string,
): Promise<DiskInfo | undefined> {
  return disks.find((d) => d.path === path);
}

export async function confirmDiskWipe(path: string): Promise<boolean> {
  const result = await runCommand(["lsblk", "--json", "--paths", path]);

  if (!result.success) {
    return false;
  }

  const data = JSON.parse(result.stdout);
  const disk = data.blockdevices?.[0];

  if (!disk) {
    return false;
  }

  // Check if disk has mounted partitions
  if (disk.children) {
    for (const child of disk.children) {
      if (child.mountpoints?.some((m) => m !== null)) {
        console.warn(`Warning: ${child.path} is mounted!`);
      }
    }
  }

  return true;
}
