import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
} from "discord.js";
import { getOrCreateUserWatchlist, getOrCreateServerWatchlist } from "../utils/watchlistUtils";
import { createGallery } from "../utils/galleryUtils";
import { SlashCommand } from "../types/ExtendedClient";

const ITEMS_PER_PAGE = 10;
const INITIAL_TIMEOUT = 180000; // 3 minutes

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("View your or the server's watchlist.")
    .addStringOption(option =>
      option.setName("scope")
        .setDescription("Personal or server watchlist")
        .setRequired(true)
        .addChoices(
          { name: "Personal", value: "user" },
          { name: "Server", value: "server" },
        ))
    .addStringOption(option =>
      option.setName("type")
        .setDescription("Filter by type")
        .addChoices(
          { name: "All", value: "all" },
          { name: "Movie", value: "movie" },
          { name: "TV Show", value: "tv" },
          { name: "Anime", value: "anime" },
        )),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const type = interaction.options.get("type")?.value as "all" | "movie" | "tv" | "anime" || "all";
    const scope = interaction.options.get("scope")?.value as "user" | "server";

    try {
      // Fetch watchlist
      let watchlist;
      if (scope === "user") {
        watchlist = await getOrCreateUserWatchlist(interaction.user.id);
      } else {
        if (!interaction.guild) {
          await interaction.editReply("❌ Server watchlist can only be viewed in a server.");
          return;
        }
        watchlist = await getOrCreateServerWatchlist(interaction.guild.id);
      }

      let items = watchlist.items;
      if (type !== "all") items = items.filter((i: any) => i.type === type);

      if (!items.length) {
        await interaction.editReply(`📭 No items found in ${scope === "user" ? "your" : "this server's"} watchlist${type !== "all" ? ` for ${type}` : ""}.`);
        return;
      }

      // State variables
      let sortOrder: "newest" | "oldest" | "az" | "za" = "newest";
      let statusFilter: "all" | "Planned" | "Watching" | "Completed" = "all";
      let currentPage = 0;

      // Helper functions
      const typeDisplay = (t: string) => t === "movie" ? "🎬 Movie" : t === "tv" ? "📺 TV Show" : t === "anime" ? "🎌 Anime" : "Unknown";

      const applySort = () => {
        if (sortOrder === "newest") items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        if (sortOrder === "oldest") items.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        if (sortOrder === "az") items.sort((a: any, b: any) => a.title.localeCompare(b.title));
        if (sortOrder === "za") items.sort((a: any, b: any) => b.title.localeCompare(a.title));
      };

      const applyFilter = () => {
        let filtered = watchlist.items;
        if (type !== "all") filtered = filtered.filter((i: any) => i.type === type);
        if (statusFilter !== "all") filtered = filtered.filter((i: any) => i.status === statusFilter);
        items = filtered;
      };

      const totalPages = () => Math.ceil(items.length / ITEMS_PER_PAGE);

      const generateEmbed = async (page: number) => {
        applyFilter();
        applySort();

        const start = page * ITEMS_PER_PAGE;
        const pagedItems = items.slice(start, start + ITEMS_PER_PAGE);

        const formatted = pagedItems.map((i: any, index: number) => {
          const year = i.releaseDate ? ` (${new Date(i.releaseDate).getFullYear()})` : "";
          const url = `https://www.themoviedb.org/${i.type}/${i.tmdbId}`;
          const prefix = type === "all" ? `[${typeDisplay(i.type)}] ` : "";
          return `**${start + index + 1}. ${prefix}[${i.title}${year}](${url})** — *${i.status}*`;
        });

        const posters = pagedItems.slice(0, 4).map((i: any) => i.posterPath || null);
        const galleryBuffer = await createGallery(posters);
        const attachment = new AttachmentBuilder(galleryBuffer, { name: "gallery.png" });

        const embed = new EmbedBuilder()
          .setTitle(`${scope === "user" ? "Your" : "Server"} ${type !== "all" ? `${typeDisplay(type)} ` : ""}Watchlist`)
          .setDescription(formatted.join("\n") || "No items found.")
          .setColor("Purple")
          .setImage("attachment://gallery.png")
          .setFooter({ text: `Page ${page + 1} of ${totalPages()} • Sorted by ${sortOrder.toUpperCase()} • Status: ${statusFilter}` });

        return { embed, attachment };
      };

      // Components
      const sortDropdown = () =>
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("sort")
            .setPlaceholder("Sort by...")
            .addOptions(
              { label: "Newest Added", value: "newest" },
              { label: "Oldest Added", value: "oldest" },
              { label: "A–Z", value: "az" },
              { label: "Z–A", value: "za" }
            )
        );

      const statusDropdown = () =>
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("status")
            .setPlaceholder("Filter by status...")
            .addOptions(
              { label: "All", value: "all" },
              { label: "Planned", value: "Planned" },
              { label: "Watching", value: "Watching" },
              { label: "Completed", value: "Completed" },
            )
        );

      const paginationButtons = (page: number) =>
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("prev")
            .setLabel("Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
          new ButtonBuilder()
            .setCustomId("next")
            .setLabel("Next")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages() - 1)
        );

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
          if (i.customId === "sort") sortOrder = i.values[0] as any;
          if (i.customId === "status") statusFilter = i.values[0] as any;
        } else if (i.isButton()) {
          if (i.customId === "prev" && currentPage > 0) currentPage--;
          else if (i.customId === "next" && currentPage < totalPages() - 1) currentPage++;
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
    } catch (err) {
      console.error(err);
      await interaction.editReply("⚠️ Something went wrong while fetching the watchlist.");
    }
  },
} as SlashCommand;

export default command;
