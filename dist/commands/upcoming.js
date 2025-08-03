"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Reminder_1 = require("../models/Reminder");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("upcoming")
        .setDescription("View upcoming movies or TV shows and set reminders")
        .addStringOption(option => option.setName("type")
        .setDescription("Choose between movies or TV shows")
        .setRequired(true)
        .addChoices({ name: "Movies", value: "movie" }, { name: "TV Shows", value: "tv" })),
    async execute(interaction) {
        const type = interaction.options.getString("type", true);
        await interaction.deferReply(); // Always defer first
        try {
            // Fetch upcoming items
            const url = `https://api.themoviedb.org/3/${type}/upcoming?api_key=${process.env.TMDB_API_KEY}&language=en-US&page=1`;
            const response = await fetch(url);
            if (!response.ok) {
                await interaction.editReply({ content: `⚠️ Failed to fetch ${type === "movie" ? "movies" : "TV shows"}.` });
                return;
            }
            const data = await response.json();
            if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
                await interaction.editReply({ content: `⚠️ No upcoming ${type === "movie" ? "movies" : "TV shows"} found.` });
                return;
            }
            const today = new Date();
            const results = data.results
                .filter((item) => {
                const dateStr = item.release_date || item.first_air_date;
                if (!dateStr)
                    return false;
                const date = new Date(dateStr);
                return date > today; // Only future releases
            })
                .slice(0, 10);
            if (!results.length) {
                await interaction.editReply({ content: "⚠️ No upcoming items found." });
                return;
            }
            let currentIndex = 0;
            const generateEmbed = (index) => {
                const item = results[index];
                return new discord_js_1.EmbedBuilder()
                    .setTitle(item.title || item.name || "Untitled")
                    .setDescription(`**Release Date:** ${item.release_date || item.first_air_date || "Unknown"}\n\n${item.overview || "No description available."}`)
                    .setImage(item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null)
                    .setColor("Blue")
                    .setFooter({ text: `Upcoming ${type.toUpperCase()} • ${index + 1}/${results.length}` });
            };
            const generateButtons = (index) => [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId("first").setLabel("⏪").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(index === 0), new discord_js_1.ButtonBuilder().setCustomId("prev").setLabel("⬅").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(index === 0), new discord_js_1.ButtonBuilder().setCustomId("next").setLabel("➡").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(index === results.length - 1), new discord_js_1.ButtonBuilder().setCustomId("last").setLabel("⏩").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(index === results.length - 1)),
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId("reminder_dm").setLabel("🔔 DM Me").setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId("reminder_channel").setLabel("🔔 This Channel").setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId("reminder_event").setLabel("📅 Create Event").setStyle(discord_js_1.ButtonStyle.Success))
            ];
            let message = await interaction.editReply({
                embeds: [generateEmbed(currentIndex)],
                components: generateButtons(currentIndex)
            });
            const collector = message.createMessageComponentCollector({ time: 240_000 });
            collector.on("collect", async (btn) => {
                if (btn.user.id !== interaction.user.id) {
                    await btn.reply({ content: "You cannot interact with this.", ephemeral: true });
                    return;
                }
                // Pagination
                if (["first", "prev", "next", "last"].includes(btn.customId)) {
                    if (btn.customId === "first")
                        currentIndex = 0;
                    else if (btn.customId === "prev")
                        currentIndex = Math.max(currentIndex - 1, 0);
                    else if (btn.customId === "next")
                        currentIndex = Math.min(currentIndex + 1, results.length - 1);
                    else if (btn.customId === "last")
                        currentIndex = results.length - 1;
                    await btn.update({
                        embeds: [generateEmbed(currentIndex)],
                        components: generateButtons(currentIndex)
                    });
                    return;
                }
                // Add reminder
                const item = results[currentIndex];
                const releaseDate = item.release_date || item.first_air_date || new Date().toISOString();
                const notifyAt = new Date(releaseDate);
                const method = btn.customId === "reminder_dm" ? "dm" : btn.customId === "reminder_channel" ? "channel" : "event";
                if (method === "event") {
                    if (!interaction.guild) {
                        await btn.reply({ content: "Events can only be created in servers.", ephemeral: true });
                        return;
                    }
                    try {
                        await interaction.guild.scheduledEvents.create({
                            name: `Release: ${item.title || item.name}`,
                            scheduledStartTime: notifyAt,
                            scheduledEndTime: new Date(notifyAt.getTime() + 2 * 60 * 60 * 1000),
                            privacyLevel: discord_js_1.GuildScheduledEventPrivacyLevel.GuildOnly,
                            entityType: discord_js_1.GuildScheduledEventEntityType.External,
                            entityMetadata: { location: "Online" },
                            description: `Reminder for the release of ${item.title || item.name}`,
                        });
                        await Reminder_1.Reminder.create({
                            userId: btn.user.id,
                            guildId: interaction.guildId || undefined,
                            channelId: null,
                            tmdbId: item.id,
                            title: item.title || item.name || "Untitled",
                            releaseDate,
                            notifyAt,
                            method,
                            notified: false
                        });
                        await btn.update({ content: `📅 Event created and reminder set for **${item.title || item.name}** on **${releaseDate}**`, embeds: [], components: [] });
                    }
                    catch (err) {
                        console.error(err);
                        await btn.reply({ content: "Failed to create event. Check my permissions.", ephemeral: true });
                    }
                }
                else {
                    await Reminder_1.Reminder.create({
                        userId: btn.user.id,
                        guildId: interaction.guildId || undefined,
                        channelId: method === "channel" ? interaction.channelId : null,
                        tmdbId: item.id,
                        title: item.title || item.name || "Untitled",
                        releaseDate,
                        notifyAt,
                        method,
                        notified: false
                    });
                    await btn.update({ content: `✅ Reminder set for **${item.title || item.name}** on **${releaseDate}**`, embeds: [], components: [] });
                }
                collector.stop();
            });
            collector.on("end", async () => {
                try {
                    await interaction.editReply({ components: [] });
                }
                catch { }
            });
        }
        catch (err) {
            console.error(err);
            await interaction.editReply({ content: "⚠️ An error occurred while fetching upcoming items." });
        }
    }
};
