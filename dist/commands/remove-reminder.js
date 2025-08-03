"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/commands/remove-reminder.ts
const discord_js_1 = require("discord.js");
const Reminder_1 = require("../models/Reminder");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("remove-reminder")
        .setDescription("Remove one of your active reminders."),
    async execute(interaction) {
        const reminders = await Reminder_1.Reminder.find({ userId: interaction.user.id }).lean();
        if (reminders.length === 0) {
            await interaction.reply({ content: "📭 You don't have any active reminders.", ephemeral: true });
            return;
        }
        // Build dropdown options
        const options = reminders.slice(0, 25).map(r => ({
            label: `${r.title} (${new Date(r.notifyAt).toLocaleDateString()})`,
            value: r._id.toString(),
        }));
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId("remove_reminder_select")
            .setPlaceholder("Select a reminder to remove")
            .addOptions(options);
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        await interaction.reply({
            content: "Select the reminder you want to remove:",
            components: [row],
            ephemeral: true,
        });
        // Collector for selection
        const collector = interaction.channel.createMessageComponentCollector({
            componentType: discord_js_1.ComponentType.StringSelect,
            time: 120000,
        });
        let reminderRemoved = false;
        collector.on("collect", async (i) => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: "❌ This menu isn't for you.", ephemeral: true });
                return;
            }
            const reminderId = i.values[0];
            await Reminder_1.Reminder.findByIdAndDelete(reminderId);
            await i.update({ content: "✅ Reminder removed successfully.", components: [] });
            reminderRemoved = true;
            collector.stop();
        });
        collector.on("end", async () => {
            if (!reminderRemoved) {
                await interaction.editReply({
                    content: "⏳ Reminder removal timed out.",
                    components: []
                });
            }
        });
    },
};
exports.default = command;
