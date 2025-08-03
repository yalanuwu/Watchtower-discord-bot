"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const dotenv_1 = require("dotenv");
const commandLoader_1 = require("./utils/commandLoader"); // reuse the same loader
(0, dotenv_1.config)();
const rest = new discord_js_1.REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
// Dummy client to load commands
const client = { commands: new Map() };
// Load all commands using the same logic as the bot
(0, commandLoader_1.loadCommands)(client);
const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
(async () => {
    try {
        console.log(`⏳ Registering ${commands.length} slash commands...`);
        await rest.put(discord_js_1.Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log("✅ Successfully registered slash commands.");
    }
    catch (error) {
        console.error(error);
    }
})();
