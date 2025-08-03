"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/commands/search.ts
const discord_js_1 = require("discord.js");
const watchlistUtils_1 = require("../utils/watchlistUtils");
const WatchlistLog_1 = require("../models/WatchlistLog");
const logUtils_1 = require("../utils/logUtils");
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("search")
        .setDescription("Search for movies or TV shows on TMDB.")
        .addStringOption(option => option.setName("query")
        .setDescription("Search term (movie or TV show)")
        .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        const query = interaction.options.getString("query", true);
        const url = `https://api.themoviedb.org/3/search/multi?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`;
        const response = await fetch(url);
        if (!response.ok) {
            await interaction.editReply("⚠️ Failed to fetch results from TMDB.");
            return;
        }
        const data = await response.json();
        const results = data.results.filter(r => r.media_type === "movie" || r.media_type === "tv").slice(0, 20);
        if (results.length === 0) {
            await interaction.editReply("📭 No results found.");
            return;
        }
        let currentIndex = 0;
        const generateEmbed = (index) => {
            const item = results[index];
            const overview = item.overview && item.overview.length > 200
                ? item.overview.slice(0, 200) + "..."
                : item.overview || "No description available.";
            return new discord_js_1.EmbedBuilder()
                .setTitle(item.title ?? item.name ?? "Untitled")
                .setDescription(`${overview}`)
                .addFields({ name: "Type", value: `${item.media_type.toUpperCase()}`, inline: true }, { name: "Release", value: `${item.release_date ?? item.first_air_date ?? "Unknown"}`, inline: true }, { name: "Rating", value: `${item.vote_average?.toFixed(1) ?? "N/A"} ⭐`, inline: true }, { name: "Popularity", value: `${Math.round(item.popularity ?? 0)}`, inline: true })
                .setImage(item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null)
                .setFooter({ text: `Result ${index + 1} of ${results.length}` })
                .setColor("Blue");
        };
        const generateButtons = (index) => new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId("first").setLabel("⏮️").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(index === 0), new discord_js_1.ButtonBuilder().setCustomId("prev").setLabel("◀️").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(index === 0), new discord_js_1.ButtonBuilder().setCustomId("next").setLabel("▶️").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(index === results.length - 1), new discord_js_1.ButtonBuilder().setCustomId("last").setLabel("⏭️").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(index === results.length - 1), new discord_js_1.ButtonBuilder().setCustomId(`add_${index}`).setLabel("Add to Watchlist").setStyle(discord_js_1.ButtonStyle.Success));
        let message = await interaction.editReply({
            embeds: [generateEmbed(currentIndex)],
            components: [generateButtons(currentIndex)]
        });
        const collector = message.createMessageComponentCollector({
            componentType: discord_js_1.ComponentType.Button,
            time: 120000
        });
        collector.on("collect", async (btn) => {
            if (btn.user.id !== interaction.user.id) {
                await btn.reply({ content: "You cannot interact with this search.", ephemeral: true });
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
                    components: [generateButtons(currentIndex)]
                });
                return;
            }
            // Step 1: Ask for personal/server
            if (btn.customId.startsWith("add_")) {
                const index = parseInt(btn.customId.split("_")[1]);
                const choiceRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`scope_user_${index}`).setLabel("Personal Watchlist").setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`scope_server_${index}`).setLabel("Server Watchlist").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(!interaction.guild));
                await btn.update({
                    content: "Where do you want to add this?",
                    embeds: [generateEmbed(index)],
                    components: [choiceRow]
                });
                return;
            }
            // Step 2: Handle personal/server selection (for TV shows, ask TV/Anime)
            if (btn.customId.startsWith("scope_")) {
                const [_, scope, indexStr] = btn.customId.split("_");
                const index = parseInt(indexStr);
                const item = results[index];
                if (item.media_type === "tv") {
                    const typeRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`final_${scope}_tv_${index}`).setLabel("Add as TV").setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`final_${scope}_anime_${index}`).setLabel("Add as Anime").setStyle(discord_js_1.ButtonStyle.Secondary));
                    await btn.update({
                        content: "Should I add this as a TV show or Anime?",
                        embeds: [generateEmbed(index)],
                        components: [typeRow]
                    });
                }
                else {
                    // If it's a movie, save directly
                    await saveToWatchlist(scope, item, "movie", btn, interaction);
                }
                return;
            }
            // Step 3: Final - save TV as TV or Anime
            if (btn.customId.startsWith("final_")) {
                const [_, scope, chosenType, indexStr] = btn.customId.split("_");
                const index = parseInt(indexStr);
                const item = results[index];
                await saveToWatchlist(scope, item, chosenType, btn, interaction);
            }
        });
        collector.on("end", async () => {
            await interaction.editReply({
                embeds: [generateEmbed(currentIndex)],
                components: [] // disable buttons
            });
        });
    }
};
async function saveToWatchlist(scope, item, chosenType, btn, interaction) {
    let watchlist = scope === "user"
        ? await (0, watchlistUtils_1.getOrCreateUserWatchlist)(btn.user.id)
        : await (0, watchlistUtils_1.getOrCreateServerWatchlist)(interaction.guild.id);
    if (watchlist.items.some((i) => i.tmdbId === item.id)) {
        await btn.update({ content: `⚠️ **${item.title ?? item.name}** is already in the ${scope} watchlist.`, embeds: [], components: [] });
        return;
    }
    watchlist.items.push({
        title: item.title ?? item.name ?? "Untitled",
        tmdbId: item.id,
        type: chosenType,
        status: "Planned",
        releaseDate: item.release_date ?? item.first_air_date,
        posterPath: item.poster_path,
        addedBy: btn.user.id,
        createdAt: new Date()
    });
    await watchlist.save();
    await WatchlistLog_1.WatchlistLog.create({
        watchlistId: watchlist._id,
        action: "add",
        itemId: item.id,
        itemTitle: item.title ?? item.name ?? "Untitled",
        updatedBy: btn.user.id,
        updatedAt: new Date()
    });
    if (interaction.guildId) {
        await (0, logUtils_1.sendLog)(interaction.client, interaction.guildId, `📌 **<@${btn.user.id}>** added **${item.title ?? item.name}** to the ${scope} watchlist.`);
    }
    await btn.update({ content: `✅ Added **${item.title ?? item.name}** as **${chosenType.toUpperCase()}** to the ${scope} watchlist.`, embeds: [], components: [] });
}
exports.default = command;
