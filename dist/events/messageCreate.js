"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/events/messageCreate.ts
const discord_js_1 = require("discord.js");
const watchlistUtils_1 = require("../utils/watchlistUtils");
const WatchlistLog_1 = require("../models/WatchlistLog");
const logUtils_1 = require("../utils/logUtils");
const tmdbRegex = /https?:\/\/(?:www\.)?themoviedb\.org\/(movie|tv)\/(\d+)/i;
const imdbRegex = /https?:\/\/(?:www\.)?imdb\.com\/title\/(tt\d+)/i;
// Fetch details (TMDB or IMDB)
async function fetchTMDBDetails(url) {
    const tmdbMatch = url.match(tmdbRegex);
    if (tmdbMatch) {
        const [, type, id] = tmdbMatch;
        let tmdbType = (type === "anime" ? "tv" : type);
        const response = await fetch(`https://api.themoviedb.org/3/${tmdbType}/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US`);
        if (!response.ok)
            throw new Error("Failed to fetch from TMDB");
        const data = (await response.json());
        return {
            title: data.title || data.name || "Untitled",
            tmdbId: data.id,
            type,
            releaseDate: data.release_date || data.first_air_date,
            posterPath: data.poster_path,
            status: "Planned"
        };
    }
    const imdbMatch = url.match(imdbRegex);
    if (imdbMatch) {
        const [, imdbId] = imdbMatch;
        const findResponse = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${process.env.TMDB_API_KEY}&language=en-US&external_source=imdb_id`);
        if (!findResponse.ok)
            throw new Error("Failed to fetch IMDB mapping");
        const findData = (await findResponse.json());
        const result = (findData.movie_results[0] || findData.tv_results[0]);
        if (!result)
            throw new Error("No TMDB data found for this IMDB link");
        return {
            title: result.title || result.name || "Untitled",
            tmdbId: result.id,
            type: findData.movie_results.length ? "movie" : "tv",
            releaseDate: result.release_date || result.first_air_date,
            posterPath: result.poster_path,
            status: "Planned"
        };
    }
    return null;
}
exports.default = {
    name: "messageCreate",
    async execute(message) {
        if (message.author.bot)
            return;
        const urlMatch = message.content.match(tmdbRegex) || message.content.match(imdbRegex);
        if (!urlMatch)
            return;
        try {
            const details = await fetchTMDBDetails(urlMatch[0]);
            if (!details)
                return;
            // Build preview embed
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(details.title)
                .setDescription(`Type: **${details.type.toUpperCase()}**\nRelease: **${details.releaseDate || "Unknown"}**`)
                .setThumbnail(details.posterPath ? `https://image.tmdb.org/t/p/w500${details.posterPath}` : null)
                .setColor("Blue")
                .setFooter({ text: "Click a button to add this to a watchlist" });
            // First button: Add to Watchlist
            const initialButtons = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`choose_add_${details.tmdbId}`).setLabel("Add to Watchlist").setStyle(discord_js_1.ButtonStyle.Success));
            const sent = await message.reply({ embeds: [embed], components: [initialButtons] });
            const collector = sent.createMessageComponentCollector({ time: 30000 });
            collector.on("collect", async (btn) => {
                if (btn.user.id !== message.author.id) {
                    await btn.reply({ content: "You cannot use this button.", ephemeral: true });
                    return;
                }
                // Step 1: Clicked Add
                if (btn.customId.startsWith("choose_add_")) {
                    if (details.type === "tv") {
                        // Ask if anime or tv
                        const typeRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`type_tv_${details.tmdbId}`).setLabel("Add as TV Show").setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`type_anime_${details.tmdbId}`).setLabel("Add as Anime").setStyle(discord_js_1.ButtonStyle.Secondary));
                        await btn.update({
                            content: "Is this a TV show or an Anime?",
                            embeds: [embed],
                            components: [typeRow]
                        });
                    }
                    else {
                        // Go straight to watchlist choice for movies
                        const choiceRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`add_personal_${details.tmdbId}_${details.type}`).setLabel("Personal Watchlist").setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`add_server_${details.tmdbId}_${details.type}`).setLabel("Server Watchlist").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(!message.guild));
                        await btn.update({
                            content: "Where do you want to add this?",
                            embeds: [embed],
                            components: [choiceRow]
                        });
                    }
                    return;
                }
                // Step 2: Chose Anime or TV
                if (btn.customId.startsWith("type_")) {
                    const selectedType = btn.customId.includes("anime") ? "anime" : "tv";
                    details.type = selectedType;
                    const choiceRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`add_personal_${details.tmdbId}_${selectedType}`).setLabel("Personal Watchlist").setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`add_server_${details.tmdbId}_${selectedType}`).setLabel("Server Watchlist").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(!message.guild));
                    await btn.update({
                        content: `Great! Adding as **${selectedType.toUpperCase()}**. Where do you want to add it?`,
                        embeds: [embed],
                        components: [choiceRow]
                    });
                    return;
                }
                // Step 3: Personal/Server selection
                if (btn.customId.startsWith("add_personal") || btn.customId.startsWith("add_server")) {
                    const [_, scope, tmdbId, finalType] = btn.customId.split("_");
                    details.type = finalType;
                    let watchlist = scope === "personal"
                        ? await (0, watchlistUtils_1.getOrCreateUserWatchlist)(btn.user.id)
                        : await (0, watchlistUtils_1.getOrCreateServerWatchlist)(message.guild.id);
                    if (watchlist.items.some((i) => i.tmdbId === details.tmdbId)) {
                        await btn.update({ content: `⚠️ **${details.title}** is already in the ${scope} watchlist.`, embeds: [], components: [] });
                        return;
                    }
                    // Add to watchlist
                    watchlist.items.push({
                        title: details.title,
                        tmdbId: details.tmdbId,
                        type: details.type,
                        status: details.status,
                        releaseDate: details.releaseDate,
                        posterPath: details.posterPath,
                        addedBy: btn.user.id,
                        createdAt: new Date()
                    });
                    await watchlist.save();
                    // Log
                    await WatchlistLog_1.WatchlistLog.create({
                        watchlistId: watchlist._id,
                        action: "add",
                        itemId: details.tmdbId,
                        itemTitle: details.title,
                        updatedBy: btn.user.id,
                        updatedAt: new Date()
                    });
                    const client = message.client;
                    const guildId = message.guild?.id;
                    if (guildId) {
                        await (0, logUtils_1.sendLog)(client, guildId, `📌 **${btn.user.username}** added **${details.title}** to the ${scope} watchlist.`);
                    }
                    await btn.update({ content: `✅ Added **${details.title}** as **${details.type.toUpperCase()}** to the ${scope} watchlist.`, embeds: [], components: [] });
                }
            });
        }
        catch (err) {
            console.error(err);
            await message.reply("⚠️ Couldn't fetch details for that link.");
        }
    }
};
