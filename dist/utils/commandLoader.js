"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCommands = loadCommands;
// utils/commandLoader.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function loadCommands(client) {
    const commands = [];
    // Use dist/commands in production, src/commands in development
    const commandsPath = path_1.default.join(__dirname, "..", "commands");
    const extension = path_1.default.extname(__filename) === ".js" ? ".js" : ".ts";
    const commandFiles = fs_1.default.readdirSync(commandsPath).filter(file => file.endsWith(extension));
    console.log(`Loading commands from: ${commandsPath}`);
    console.log("Files found:", commandFiles);
    for (const file of commandFiles) {
        const imported = require(path_1.default.join(commandsPath, file));
        const command = imported.default || imported;
        if (command?.data) {
            client.commands.set(command.data.name, command);
            commands.push(command);
            console.log(`Loaded command: ${command.data.name}`);
        }
        else {
            console.warn(`⚠️ Skipped ${file}: No valid command export.`);
        }
    }
    console.log(`✅ ${commands.length} commands loaded.`);
}
