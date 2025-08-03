"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLog = sendLog;
// src/utils/logUtils.ts
const LogConfig_1 = require("../models/LogConfig");
const discord_js_1 = require("discord.js");
async function sendLog(client, guildId, message) {
    const config = await LogConfig_1.LogConfig.findOne({ guildId });
    if (!config)
        return; // No log channel set
    const guild = client.guilds.cache.get(guildId);
    if (!guild)
        return;
    const channel = guild.channels.cache.get(config.channelId);
    if (!channel || !channel.isTextBased())
        return;
    const embed = new discord_js_1.EmbedBuilder()
        .setDescription(message)
        .setColor("Yellow")
        .setTimestamp();
    await channel.send({ embeds: [embed] }).catch(() => null);
}
