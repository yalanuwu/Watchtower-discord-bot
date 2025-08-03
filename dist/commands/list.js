"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const watchlistUtils_1 = require("../utils/watchlistUtils");
const galleryUtils_1 = require("../utils/galleryUtils");
const ITEMS_PER_PAGE = 10;
const INITIAL_TIMEOUT = 180000; // 3 minutes
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("list")
        .setDescription("View your or the server's watchlist.")
        .addStringOption(option => option.setName("scope")
        .setDescription("Personal or server watchlist")
        .setRequired(true)
        .addChoices({ name: "Personal", value: "user" }, { name: "Server", value: "server" }))
        .addStringOption(option => option.setName("type")
        .setDescription("Filter by type")
        .addChoices({ name: "All", value: "all" }, { name: "Movie", value: "movie" }, { name: "TV Show", value: "tv" }, { name: "Anime", value: "anime" })),
    async execute(interaction) {
        await interaction.deferReply();
        const type = interaction.options.get("type")?.value || "all";
        const scope = interaction.options.get("scope")?.value;
        try {
            // Fetch watchlist
            let watchlist;
            if (scope === "user") {
                watchlist = await (0, watchlistUtils_1.getOrCreateUserWatchlist)(interaction.user.id);
            }
            else {
                if (!interaction.guild) {
                    await interaction.editReply("❌ Server watchlist can only be viewed in a server.");
                    return;
                }
                watchlist = await (0, watchlistUtils_1.getOrCreateServerWatchlist)(interaction.guild.id);
            }
            let items = watchlist.items;
            if (type !== "all")
                items = items.filter((i) => i.type === type);
            if (!items.length) {
                await interaction.editReply(`📭 No items found in ${scope === "user" ? "your" : "this server's"} watchlist${type !== "all" ? ` for ${type}` : ""}.`);
                return;
            }
            // State variables
            let sortOrder = "newest";
            let statusFilter = "all";
            let currentPage = 0;
            // Helper functions
            const typeDisplay = (t) => t === "movie" ? "🎬 Movie" : t === "tv" ? "📺 TV Show" : t === "anime" ? "🎌 Anime" : "Unknown";
            const applySort = () => {
                if (sortOrder === "newest")
                    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                if (sortOrder === "oldest")
                    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                if (sortOrder === "az")
                    items.sort((a, b) => a.title.localeCompare(b.title));
                if (sortOrder === "za")
                    items.sort((a, b) => b.title.localeCompare(a.title));
            };
            const applyFilter = () => {
                let filtered = watchlist.items;
                if (type !== "all")
                    filtered = filtered.filter((i) => i.type === type);
                if (statusFilter !== "all")
                    filtered = filtered.filter((i) => i.status === statusFilter);
                items = filtered;
            };
            const totalPages = () => Math.ceil(items.length / ITEMS_PER_PAGE);
            const generateEmbed = async (page) => {
                applyFilter();
                applySort();
                const start = page * ITEMS_PER_PAGE;
                const pagedItems = items.slice(start, start + ITEMS_PER_PAGE);
                const formatted = pagedItems.map((i, index) => {
                    const year = i.releaseDate ? ` (${new Date(i.releaseDate).getFullYear()})` : "";
                    const url = `https://www.themoviedb.org/${i.type}/${i.tmdbId}`;
                    const prefix = type === "all" ? `[${typeDisplay(i.type)}] ` : "";
                    return `**${start + index + 1}. ${prefix}[${i.title}${year}](${url})** — *${i.status}*`;
                });
                const posters = pagedItems.slice(0, 4).map((i) => i.posterPath || null);
                const galleryBuffer = await (0, galleryUtils_1.createGallery)(posters);
                const attachment = new discord_js_1.AttachmentBuilder(galleryBuffer, { name: "gallery.png" });
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(`${scope === "user" ? "Your" : "Server"} ${type !== "all" ? `${typeDisplay(type)} ` : ""}Watchlist`)
                    .setDescription(formatted.join("\n") || "No items found.")
                    .setColor("Purple")
                    .setImage("attachment://gallery.png")
                    .setFooter({ text: `Page ${page + 1} of ${totalPages()} • Sorted by ${sortOrder.toUpperCase()} • Status: ${statusFilter}` });
                return { embed, attachment };
            };
            // Components
            const sortDropdown = () => new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                .setCustomId("sort")
                .setPlaceholder("Sort by...")
                .addOptions({ label: "Newest Added", value: "newest" }, { label: "Oldest Added", value: "oldest" }, { label: "A–Z", value: "az" }, { label: "Z–A", value: "za" }));
            const statusDropdown = () => new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                .setCustomId("status")
                .setPlaceholder("Filter by status...")
                .addOptions({ label: "All", value: "all" }, { label: "Planned", value: "Planned" }, { label: "Watching", value: "Watching" }, { label: "Completed", value: "Completed" }));
            const paginationButtons = (page) => new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId("prev")
                .setLabel("Previous")
                .setStyle(discord_js_1.ButtonStyle.Secondary)
                .setDisabled(page === 0), new discord_js_1.ButtonBuilder()
                .setCustomId("next")
                .setLabel("Next")
                .setStyle(discord_js_1.ButtonStyle.Secondary)
                .setDisabled(page === totalPages() - 1));
            // Send initial message
            const { embed, attachment } = await generateEmbed(currentPage);
            let message = await interaction.editReply({
                embeds: [embed],
                files: [attachment],
                components: [sortDropdown(), statusDropdown(), paginationButtons(currentPage)],
            });
            // Collector with extended timeout on activity
            let collector = message.createMessageComponentCollector({ time: INITIAL_TIMEOUT });
            collector.on("collect", async (i) => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: "You cannot interact with this.", ephemeral: true });
                    return;
                }
                await i.deferUpdate(); // Acknowledge quickly
                if (i.isStringSelectMenu()) {
                    if (i.customId === "sort")
                        sortOrder = i.values[0];
                    if (i.customId === "status")
                        statusFilter = i.values[0];
                }
                else if (i.isButton()) {
                    if (i.customId === "prev" && currentPage > 0)
                        currentPage--;
                    else if (i.customId === "next" && currentPage < totalPages() - 1)
                        currentPage++;
                }
                const { embed: newEmbed, attachment: newAttachment } = await generateEmbed(currentPage);
                await message.edit({
                    embeds: [newEmbed],
                    files: [newAttachment],
                    components: [sortDropdown(), statusDropdown(), paginationButtons(currentPage)],
                });
                collector.resetTimer(); // Extend timeout on every interaction
            });
            collector.on("end", async () => {
                await message.edit({ components: [] });
            });
        }
        catch (err) {
            console.error(err);
            await interaction.editReply("⚠️ Something went wrong while fetching the watchlist.");
        }
    },
};
exports.default = command;
