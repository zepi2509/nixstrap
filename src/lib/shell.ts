import { mergeReadableStreams } from "@std/streams/merge-readable-streams";

export interface ShellOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdin?: "inherit" | "null" | Uint8Array;
  stdout?: "inherit" | "piped" | "null";
  stderr?: "inherit" | "piped" | "null";
}

export interface ShellResult {
  code: number;
  stdout: string;
  stderr: string;
  success: boolean;
}

export async function runCommand(
  cmd: string[],
  options: ShellOptions = {},
): Promise<ShellResult> {
  const [executable, ...args] = cmd;

  const stdin: "inherit" | "null" | "piped" = options.stdin === "inherit"
    ? "inherit"
    : options.stdin === "null"
    ? "null"
    : options.stdin instanceof Uint8Array
    ? "piped"
    : "piped";

  const process = new Deno.Command(executable, {
    args,
    cwd: options.cwd,
    env: options.env,
    stdin,
    stdout: options.stdout ?? "piped",
    stderr: options.stderr ?? "piped",
  });

  const child = process.spawn();

  if (options.stdin instanceof Uint8Array && child.stdin) {
    const writer = child.stdin.getWriter();
    await writer.write(options.stdin);
    await writer.close();
  }

  const output = await child.output();

  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);

  return {
    code: output.code,
    stdout,
    stderr,
    success: output.success,
  };
}

export async function runInteractive(
  cmd: string[],
  options: Omit<ShellOptions, "stdin" | "stdout" | "stderr"> = {},
): Promise<number> {
  const [executable, ...args] = cmd;

  const process = new Deno.Command(executable, {
    args,
    cwd: options.cwd,
    env: options.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const child = process.spawn();
  const status = await child.status;

  return status.code;
}

export async function runWithMergedOutput(
  cmd: string[],
  options: ShellOptions = {},
): Promise<{ code: number; output: string; success: boolean }> {
  const [executable, ...args] = cmd;

  const process = new Deno.Command(executable, {
    args,
    cwd: options.cwd,
    env: options.env,
    stdin: options.stdin === "inherit" ? "inherit" : options.stdin === "null" ? "null" : "piped",
    stdout: "piped",
    stderr: "piped",
  });

  const child = process.spawn();

  if (options.stdin instanceof Uint8Array && child.stdin) {
    const writer = child.stdin.getWriter();
    await writer.write(options.stdin);
    await writer.close();
  }

  const stdoutReader = child.stdout.getReader();
  const stderrReader = child.stderr.getReader();

  const chunks: Uint8Array[] = [];

  const readStream = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  };

  await Promise.all([readStream(stdoutReader), readStream(stderrReader)]);

  const status = await child.status;

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return {
    code: status.code,
    output: new TextDecoder().decode(combined),
    success: status.success,
  };
}

export function quoteShellArg(arg: string): string {
  if (/^[a-zA-Z0-9_\-\/.=@]+$/.test(arg)) {
    return arg;
  }
  return `"${arg.replace(/"/g, '\\"')}"`;
}

export function buildCommand(parts: (string | string[])[]): string[] {
  const result: string[] = [];
  for (const part of parts) {
    if (Array.isArray(part)) {
      result.push(...part);
    } else {
      result.push(part);
    }
  }
  return result;
}
