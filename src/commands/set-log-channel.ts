 // src/commands/set-log-channel.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from "discord.js";
import { SlashCommand } from "../types/ExtendedClient";
import { LogConfig } from "../models/LogConfig";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("set-log-channel")
    .setDescription("Set a channel for bot activity logs.")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Select the channel for logs")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel("channel", true);

    await LogConfig.findOneAndUpdate(
      { guildId: interaction.guildId },
      { channelId: channel.id },
      { upsert: true }
    );

    await interaction.reply(`✅ Log channel set to <#${channel.id}>`);
  }
} as SlashCommand;

export default command;
