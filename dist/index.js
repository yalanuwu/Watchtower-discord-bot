"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const dotenv_1 = require("dotenv");
const connect_1 = require("./database/connect");
const commandLoader_1 = require("./utils/commandLoader");
const messageCreate_1 = __importDefault(require("./events/messageCreate"));
const reminderSchedular_1 = require("./utils/reminderSchedular");
const cleanupReminders_1 = require("./utils/cleanupReminders");
const express_1 = __importDefault(require("express"));
(0, dotenv_1.config)(); // Load .env
const client = new (require("discord.js").Client)({
    intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildMessages, discord_js_1.GatewayIntentBits.MessageContent],
});
client.commands = new discord_js_1.Collection();
(0, commandLoader_1.loadCommands)(client);
client.once("ready", () => {
    console.log(`🤖 Logged in as ${client.user?.tag}`);
    (0, reminderSchedular_1.processReminders)(client).then(() => {
        console.log(`✅ Initial reminder check complete at ${new Date().toLocaleTimeString()}`);
    });
    setInterval(async () => {
        // console.log(`🔄 Reminder scheduler tick at ${new Date().toLocaleTimeString()}`);
        await (0, reminderSchedular_1.processReminders)(client);
    }, 60 * 1000);
    (0, cleanupReminders_1.cleanupOldReminders)();
    setInterval(() => (0, cleanupReminders_1.cleanupOldReminders)(), 24 * 60 * 60 * 1000);
});
client.on("interactionCreate", (interaction) => require("./events/interactionCreate").default(client, interaction));
client.on("messageCreate", (...args) => messageCreate_1.default.execute(...args));
//DB Connection and bot login
(async () => {
    await (0, connect_1.connectDB)();
    await client.login(process.env.DISCORD_TOKEN);
})();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.get("/", (_, res) => res.send("WatchTower Bot is running!"));
app.listen(PORT, () => console.log(`🌐 Web server listening on port ${PORT}`));
