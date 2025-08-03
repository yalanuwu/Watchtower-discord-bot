import { Interaction } from "discord.js";
import { ExtendedClient } from "../types/ExtendedClient";

export default async (client: ExtendedClient, interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: "⚠️ An error occurred while executing this command.", ephemeral: true });
  }
};
