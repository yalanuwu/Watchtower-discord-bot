"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/commands/set-log-channel.ts
const discord_js_1 = require("discord.js");
const LogConfig_1 = require("../models/LogConfig");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("set-log-channel")
        .setDescription("Set a channel for bot activity logs.")
        .addChannelOption(option => option
        .setName("channel")
        .setDescription("Select the channel for logs")
        .addChannelTypes(discord_js_1.ChannelType.GuildText)
        .setRequired(true))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const channel = interaction.options.getChannel("channel", true);
        await LogConfig_1.LogConfig.findOneAndUpdate({ guildId: interaction.guildId }, { channelId: channel.id }, { upsert: true });
        await interaction.reply(`✅ Log channel set to <#${channel.id}>`);
    }
};
exports.default = command;
