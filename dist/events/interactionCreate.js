"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = async (client, interaction) => {
    if (!interaction.isChatInputCommand())
        return;
    const command = client.commands.get(interaction.commandName);
    if (!command)
        return;
    try {
        await command.execute(interaction);
    }
    catch (err) {
        console.error(err);
        await interaction.reply({ content: "⚠️ An error occurred while executing this command.", ephemeral: true });
    }
};
