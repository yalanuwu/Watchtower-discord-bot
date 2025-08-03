// src/utils/logUtils.ts
import { LogConfig } from "../models/LogConfig";
import { Client, EmbedBuilder } from "discord.js";

export async function sendLog(client: Client, guildId: string, message: string) {
  const config = await LogConfig.findOne({ guildId });
  if (!config) return; // No log channel set

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(config.channelId);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setDescription(message)
    .setColor("Yellow")
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => null);
}
