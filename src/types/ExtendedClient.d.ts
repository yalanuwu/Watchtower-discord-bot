import { ChatInputCommandInteraction, Client, Collection, CommandInteraction, Message, SlashCommandBuilder } from "discord.js";

export interface SlashCommand {
  data: SlashCommandBuilder; // SlashCommandBuilder type (we’ll refine later)
  execute: (interaction: ChatInputCommandInteraction) => Promise<void | Message>;
}

export interface ExtendedClient extends Client {
  commands: Collection<string, SlashCommand>;
}
