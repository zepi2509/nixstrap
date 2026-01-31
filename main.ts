#!/usr/bin/env -S deno run --allow-all

import { Command } from "@cliffy/command";
import { colors } from "@cliffy/ansi/colors";
import { installCommand } from "./src/commands/install.ts";

new Command()
  .name("nixstrap")
  .version("0.1.0")
  .description("NixOS Bootstrap CLI - Interactive NixOS installation tool")
  .action(() => {
    console.log(colors.cyan("NixOS Bootstrap CLI"));
    console.log(colors.gray("Use --help for available commands"));
  })
  .command("install", installCommand)
  .parse(Deno.args);
