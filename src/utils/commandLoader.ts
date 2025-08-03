// utils/commandLoader.ts
import fs from "fs";
import path from "path";
import { SlashCommand } from "../types/ExtendedClient";

export function loadCommands(client: any) {
  const commands: SlashCommand[] = [];

  // Use dist/commands in production, src/commands in development
  const commandsPath = path.join(__dirname, "..", "commands");
  const extension = path.extname(__filename) === ".js" ? ".js" : ".ts";
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(extension));

  console.log(`Loading commands from: ${commandsPath}`);
  console.log("Files found:", commandFiles);

  for (const file of commandFiles) {
    const imported = require(path.join(commandsPath, file));
    const command: SlashCommand = imported.default || imported;
    if (command?.data) {
      client.commands.set(command.data.name, command);
      commands.push(command);
      console.log(`Loaded command: ${command.data.name}`);
    } else {
      console.warn(`⚠️ Skipped ${file}: No valid command export.`);
    }
  }

  console.log(`✅ ${commands.length} commands loaded.`);
}
