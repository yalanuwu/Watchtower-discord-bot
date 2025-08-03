import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../types/ExtendedClient";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),
    
  async execute(interaction) {
    await interaction.reply("🏓 Pong!");
  },
};

export default command;
