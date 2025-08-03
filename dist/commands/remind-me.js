"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/commands/remind-me.ts
const discord_js_1 = require("discord.js");
const Reminder_1 = require("../models/Reminder");
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("remind-me")
        .setDescription("Set a reminder for an upcoming movie or TV show.")
        .addStringOption(opt => opt.setName("query")
        .setDescription("Search for a movie or TV show")
        .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const query = interaction.options.getString("query", true);
        const url = `https://api.themoviedb.org/3/search/multi?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`;
        const response = await fetch(url);
        if (!response.ok) {
            await interaction.editReply("⚠️ Failed to fetch results from TMDB.");
            return;
        }
        const data = await response.json();
        const result = data.results.find(r => r.release_date || r.first_air_date);
        if (!result) {
            await interaction.editReply("📭 No upcoming releases found.");
            return;
        }
        const releaseDate = result.release_date || result.first_air_date;
        const release = new Date(releaseDate);
        const now = new Date();
        if (release <= now) {
            await interaction.editReply("⚠️ This title has already been released.");
            return;
        }
        // Build preview embed
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(result.title ?? result.name ?? "Untitled")
            .setDescription(`**Release Date:** ${release.toDateString()}`)
            .setImage(result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null)
            .setColor("Blue")
            .setFooter({ text: "Select where you want to get the reminder" });
        const buttons = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId("remind_dm").setLabel("DM Me").setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId("remind_channel").setLabel("This Channel").setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId("remind_event").setLabel("Create Event").setStyle(discord_js_1.ButtonStyle.Success));
        const sent = await interaction.editReply({ embeds: [embed], components: [buttons] });
        const collector = sent.createMessageComponentCollector({
            componentType: discord_js_1.ComponentType.Button,
            time: 120000
        });
        collector.on("collect", async (btn) => {
            if (btn.user.id !== interaction.user.id) {
                await btn.reply({ content: "You cannot use this button.", ephemeral: true });
                return;
            }
            await btn.deferReply({ ephemeral: true }); // acknowledge immediately
            const reminderType = btn.customId;
            if (reminderType === "remind_event") {
                // Create a scheduled event
                if (!interaction.guild) {
                    await btn.followUp("⚠️ Cannot create an event in DMs.");
                    return;
                }
                const guild = interaction.guild;
                const startTime = new Date(release);
                const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // +2h
                try {
                    const event = await guild.scheduledEvents.create({
                        name: `Release: ${result.title ?? result.name}`,
                        scheduledStartTime: startTime,
                        scheduledEndTime: endTime,
                        privacyLevel: 2,
                        entityType: 3,
                        description: `Reminder for the release of ${result.title ?? result.name}`,
                        entityMetadata: { location: `Check Online` },
                    });
                    await btn.followUp({ content: `✅ Event created: ${event.name}` });
                }
                catch (err) {
                    console.error(err);
                    await btn.followUp({ content: "⚠️ Failed to create event. Check my permissions." });
                }
            }
            else {
                // Store reminder in DB
                await Reminder_1.Reminder.create({
                    userId: interaction.user.id,
                    channelId: reminderType === "remind_channel" ? interaction.channelId : null,
                    tmdbId: result.id,
                    title: result.title ?? result.name ?? "Untitled",
                    releaseDate: release,
                    reminderType,
                    notifyAt: release,
                    method: reminderType === "remind_dm" ? "dm" : "channel"
                });
                await btn.followUp({
                    content: `✅ Reminder set for **${result.title ?? result.name}** on **${release.toDateString()}**.`,
                    ephemeral: true
                });
            }
            collector.stop();
        });
        collector.on("end", async () => {
            await interaction.editReply({ embeds: [embed], components: [] }); // disable buttons
        });
    }
};
exports.default = command;
