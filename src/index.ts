import { GatewayIntentBits, Collection, Interaction } from "discord.js";
import { config } from "dotenv";
import { connectDB } from "./database/connect";
import { loadCommands } from "./utils/commandLoader";
import { ExtendedClient } from "./types/ExtendedClient";
import messageCreate from "./events/messageCreate";
import { processReminders } from "./utils/reminderSchedular";
import { cleanupOldReminders } from "./utils/cleanupReminders";
import express from 'express';

config(); // Load .env

const client: ExtendedClient = new (require("discord.js").Client)({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.commands = new Collection();
loadCommands(client);

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user?.tag}`);
  processReminders(client).then(() => {
    console.log(`✅ Initial reminder check complete at ${new Date().toLocaleTimeString()}`);
  });
  setInterval(async () => {
    // console.log(`🔄 Reminder scheduler tick at ${new Date().toLocaleTimeString()}`);
    await processReminders(client)
  } ,60 * 1000);

  cleanupOldReminders();
  setInterval(() => cleanupOldReminders(), 24 * 60 * 60 * 1000);
});

client.on("interactionCreate", (interaction: Interaction) => require("./events/interactionCreate").default(client, interaction));

client.on("messageCreate", (...args) => messageCreate.execute(...args));

//DB Connection and bot login
(async () => {
  await connectDB();
  await client.login(process.env.DISCORD_TOKEN);
})();


const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (_, res) => res.send("WatchTower Bot is running!"));
app.listen(PORT, () => console.log(`🌐 Web server listening on port ${PORT}`));