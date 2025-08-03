import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import { loadCommands } from "./utils/commandLoader";  // reuse the same loader
import { ExtendedClient } from "./types/ExtendedClient";

config();

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN as string);

// Dummy client to load commands
const client: ExtendedClient = { commands: new Map() } as ExtendedClient;

// Load all commands using the same logic as the bot
loadCommands(client);

const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

(async () => {
  try {
    console.log(`⏳ Registering ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID as string),
      { body: commands }
    );
    console.log("✅ Successfully registered slash commands.");
  } catch (error) {
    console.error(error);
  }
})();
