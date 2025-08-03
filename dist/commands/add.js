"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const axios_1 = __importDefault(require("axios"));
const watchlistUtils_1 = require("../utils/watchlistUtils");
const WatchlistLog_1 = require("../models/WatchlistLog");
const logUtils_1 = require("../utils/logUtils");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("add")
        .setDescription("Add a movie, TV show, or anime to your watchlist.")
        .addStringOption(option => option.setName("title")
        .setDescription("Name of the movie/show/anime")
        .setRequired(true))
        .addStringOption(option => option.setName("type")
        .setDescription("Type of content")
        .setRequired(true)
        .addChoices({ name: "Movie", value: "movie" }, { name: "TV Show", value: "tv" }, { name: "Anime", value: "anime" }))
        .addStringOption(option => option.setName("scope")
        .setDescription("Personal or server watchlist")
        .setRequired(true)
        .addChoices({ name: "Personal", value: "user" }, { name: "Server", value: "server" }))
        .addIntegerOption(option => option.setName("year")
        .setDescription("Release year (optional)")),
    async execute(interaction) {
        await interaction.deferReply();
        const title = interaction.options.get("title")?.value;
        const type = interaction.options.get("type")?.value;
        const scope = interaction.options.get("scope")?.value;
        const year = interaction.options.get("year")?.value;
        // **Validate inputs**
        if (!title || !["movie", "tv", "anime"].includes(type)) {
            await interaction.editReply("❌ Invalid type provided. Please choose Movie, TV, or Anime.");
            return;
        }
        if (!["user", "server"].includes(scope)) {
            await interaction.editReply("❌ Invalid scope provided. Please choose Personal or Server.");
            return;
        }
        try {
            // Build TMDB URL with optional year filter
            let tmdbUrl = `https://api.themoviedb.org/3/search/${type === "anime" ? "tv" : type}?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
            if (year) {
                tmdbUrl += `&year=${year}`;
            }
            const response = await axios_1.default.get(tmdbUrl);
            let results = response.data.results;
            // **Normalize for matching**
            const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
            const normalizedTitle = normalize(title);
            // Step 1: Prefer exact title match (ignoring punctuation/case)
            results = results.filter((r) => normalize(r.title || r.name) === normalizedTitle || (r.original_title && normalize(r.original_title) === normalizedTitle));
            // Step 2: Apply year filter if provided
            if (year) {
                results = results.filter((r) => r.release_date?.startsWith(year.toString()));
            }
            // Step 3: Handle no results
            if (!results.length) {
                await interaction.editReply(`❌ No results found for **${title}**${year ? ` (${year})` : ""}. Try using the exact title.`);
                return;
            }
            // Step 4: Warn if multiple matches and no year
            if (results.length > 1 && !year) {
                await interaction.editReply(`⚠️ Multiple results found for **${title}**. Please provide a release year using the \`year\` option for better accuracy.`);
                return;
            }
            const item = results[0];
            const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
            // Get watchlist
            let watchlist;
            if (scope === "user") {
                watchlist = await (0, watchlistUtils_1.getOrCreateUserWatchlist)(interaction.user.id);
            }
            else {
                if (!interaction.guild) {
                    await interaction.editReply("❌ Server watchlist can only be used in a server.");
                    return;
                }
                watchlist = await (0, watchlistUtils_1.getOrCreateServerWatchlist)(interaction.guild.id);
            }
            // **Check for duplicates**
            const exists = watchlist.items.some((i) => i.tmdbId === item.id && i.type === type);
            if (exists) {
                await interaction.editReply(`⚠️ **${item.title || item.name}** is already in this watchlist.`);
                return;
            }
            // Add to DB
            watchlist.items.push({
                title: item.title || item.name,
                type,
                status: "Planned",
                addedBy: interaction.user.id,
                tmdbId: item.id,
                posterPath: item.poster_path,
                createdAt: new Date()
            });
            await watchlist.save();
            // Reply with nice embed
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(item.title || item.name)
                .setDescription(`Added to ${scope === "user" ? "your personal" : "this server's"} watchlist.`)
                .setThumbnail(poster || "")
                .addFields({ name: "Type", value: type, inline: true }, { name: "Status", value: "Planned", inline: true }, { name: "Release Year", value: item.release_date ? item.release_date.split("-")[0] : "N/A", inline: true })
                .setColor("Blue");
            await interaction.editReply({ embeds: [embed] });
            //Logging
            await WatchlistLog_1.WatchlistLog.create({
                watchlistId: watchlist._id,
                action: "add",
                itemId: item._id,
                itemTitle: item.title,
                itemType: item.type,
                newStatus: item.status,
                updatedBy: interaction.user.id,
                updatedAt: new Date(),
            });
            if (interaction.guildId) {
                await (0, logUtils_1.sendLog)(interaction.client, interaction.guildId, `📌 **<@${interaction.user.id}>** added **${item.title ?? item.name}** to the ${scope} watchlist.`);
            }
        }
        catch (err) {
            console.error(err);
            await interaction.editReply("⚠️ Something went wrong while adding this item.");
        }
    },
};
exports.default = command;
