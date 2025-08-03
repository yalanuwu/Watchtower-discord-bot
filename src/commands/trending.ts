// src/commands/trending.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from "discord.js";
import { SlashCommand } from "../types/ExtendedClient";
import { getOrCreateUserWatchlist, getOrCreateServerWatchlist } from "../utils/watchlistUtils";
import { WatchlistLog } from "../models/WatchlistLog";
import { sendLog } from "../utils/logUtils";


interface TMDBTrendingResult {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  vote_average?: number;
  popularity?: number;
  media_type?: "movie" | "tv";
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("trending")
    .setDescription("View trending movies or TV shows.")
    .addStringOption(option =>
      option.setName("type")
        .setDescription("Choose whether to view trending movies or TV shows.")
        .setRequired(true)
        .addChoices(
          { name: "Movie", value: "movie" },
          { name: "TV Show", value: "tv" }
        )
    )
    .addStringOption(option =>
      option.setName("time_window")
        .setDescription("Trending period (for movies only)")
        .addChoices(
          { name: "Day", value: "day" },
          { name: "Week", value: "week" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const type = interaction.options.getString("type", true);
    const timeWindow = interaction.options.getString("time_window") || "day";

    const url = `https://api.themoviedb.org/3/trending/${type}/${timeWindow}?api_key=${process.env.TMDB_API_KEY}&language=en-US`;

    const response = await fetch(url);
    if (!response.ok) {
      await interaction.editReply("⚠️ Failed to fetch trending results.");
      return;
    }

    const data = await response.json() as { results: TMDBTrendingResult[] };
    const results = data.results.slice(0, 20);

    if (results.length === 0) {
      await interaction.editReply("📭 No trending results found.");
      return;
    }

    let currentIndex = 0;

    const generateEmbed = (index: number) => {
      const item = results[index];
      const overview = item.overview && item.overview.length > 200
        ? item.overview.slice(0, 200) + "..."
        : item.overview || "No description available.";

      return new EmbedBuilder()
        .setTitle(item.title ?? item.name ?? "Untitled")
        .setDescription(`${overview}`)
        .addFields(
          { name: "Type", value: `${type.toUpperCase()}`, inline: true },
          { name: "Release", value: `${item.release_date ?? item.first_air_date ?? "Unknown"}`, inline: true },
          { name: "Rating", value: `${item.vote_average?.toFixed(1) ?? "N/A"} ⭐`, inline: true },
          { name: "Popularity", value: `${Math.round(item.popularity ?? 0)}`, inline: true }
        )
        .setImage(item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null)
        .setFooter({ text: `Result ${index + 1} of ${results.length}` })
        .setColor("Blue");
    };

    const generateButtons = (index: number) => {
      const paginationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("first").setLabel("⏮️").setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId("prev").setLabel("◀️").setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId("next").setLabel("▶️").setStyle(ButtonStyle.Secondary).setDisabled(index === results.length - 1),
        new ButtonBuilder().setCustomId("last").setLabel("⏭️").setStyle(ButtonStyle.Secondary).setDisabled(index === results.length - 1),
      );

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`add_personal_${results[index].id}`).setLabel("Add to Personal").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`add_server_${results[index].id}`).setLabel("Add to Server").setStyle(ButtonStyle.Secondary).setDisabled(!interaction.guild)
      );

      return [paginationRow, actionRow];
    };

    let message = await interaction.editReply({
      embeds: [generateEmbed(currentIndex)],
      components: generateButtons(currentIndex)
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 240000
    });

    collector.on("collect", async btn => {
      if (btn.user.id !== interaction.user.id) {
        await btn.reply({ content: "You cannot interact with this.", ephemeral: true });
        return;
      }

      if (["first", "prev", "next", "last"].includes(btn.customId)) {
        if (btn.customId === "first") currentIndex = 0;
        else if (btn.customId === "prev") currentIndex = Math.max(currentIndex - 1, 0);
        else if (btn.customId === "next") currentIndex = Math.min(currentIndex + 1, results.length - 1);
        else if (btn.customId === "last") currentIndex = results.length - 1;

        await btn.update({
          embeds: [generateEmbed(currentIndex)],
          components: generateButtons(currentIndex)
        });
        return;
      }

      if (btn.customId.startsWith("confirm_tv_") || btn.customId.startsWith("confirm_anime_")) {
    const selectedId = parseInt(btn.customId.split("_")[2]);
    const finalType = btn.customId.includes("anime") ? "anime" : "tv";
    const item = results.find(r => r.id === selectedId);
    const scope = "user"; // default to personal (we only ask type after personal/server selection)

    if (!item) {
      await btn.update({ content: "⚠️ Something went wrong. Try again.", embeds: [], components: [] });
      return;
    }

    const watchlist = await getOrCreateUserWatchlist(btn.user.id);
    if (watchlist.items.some((i: any) => i.tmdbId === item.id)) {
      await btn.update({ content: `⚠️ **${item.title ?? item.name}** is already in your watchlist.`, embeds: [], components: [] });
      return;
    }

    // Add to watchlist
    watchlist.items.push({
      title: item.title ?? item.name ?? "Untitled",
      tmdbId: item.id,
      type: finalType as "movie" | "tv" | "anime",
      status: "Planned",
      releaseDate: item.release_date ?? item.first_air_date,
      posterPath: item.poster_path,
      addedBy: btn.user.id,
      createdAt: new Date()
    });
    await watchlist.save();

    // Log
    await WatchlistLog.create({
      watchlistId: watchlist._id,
      action: "add",
      itemId: item.id,
      itemTitle: item.title ?? item.name ?? "Untitled",
      updatedBy: btn.user.id,
      updatedAt: new Date()
    });

    // Logging channel
        if (interaction.guildId) {
          sendLog(
            interaction.client,
            interaction.guildId,
            `📌 **<@${btn.user.id}>** added **${item.title ?? item.name}** to the ${scope} watchlist.`
          )
        }

    await btn.update({ content: `✅ Added **${item.title ?? item.name}** as **${finalType.toUpperCase()}** to your watchlist.`, embeds: [], components: [] });
    return;
  }

      if (btn.customId.startsWith("add_personal") || btn.customId.startsWith("add_server")) {
        const item = results[currentIndex];
        const scope = btn.customId.startsWith("add_personal") ? "user" : "server";

        // If TV, ask if Anime or TV
        let finalType = type;
        if (type === "tv") {
          const choiceRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`confirm_tv_${item.id}`).setLabel("TV Show").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`confirm_anime_${item.id}`).setLabel("Anime").setStyle(ButtonStyle.Secondary)
          );

          await btn.update({
            content: "Is this a TV Show or an Anime?",
            embeds: [generateEmbed(currentIndex)],
            components: [choiceRow]
          });
          return;
        }

        const watchlist = scope === "user"
          ? await getOrCreateUserWatchlist(btn.user.id)
          : await getOrCreateServerWatchlist(interaction.guild!.id);

        if (watchlist.items.some((i: any) => i.tmdbId === item.id)) {
          await btn.update({ content: `⚠️ **${item.title ?? item.name}** is already in the ${scope} watchlist.`, embeds: [], components: [] });
          return;
        }

        watchlist.items.push({
          title: item.title ?? item.name ?? "Untitled",
          tmdbId: item.id,
          type: finalType as "movie" | "tv" | "anime",
          status: "Planned",
          releaseDate: item.release_date ?? item.first_air_date,
          posterPath: item.poster_path,
          addedBy: btn.user.id,
          createdAt: new Date()
        });
        await watchlist.save();

        // Log
        await WatchlistLog.create({
          watchlistId: watchlist._id,
          action: "add",
          itemId: item.id,
          itemTitle: item.title ?? item.name ?? "Untitled",
          updatedBy: btn.user.id,
          updatedAt: new Date()
        });

        // Logging channel
        if (interaction.guildId) {
          sendLog(
            interaction.client,
            interaction.guildId,
            `📌 **<@${btn.user.id}>** added **${item.title ?? item.name}** to the ${scope} watchlist.`
          )
        }

        await btn.update({ content: `✅ Added **${item.title ?? item.name}** to the ${scope} watchlist.`, embeds: [], components: [] });
      }
    });

    collector.on("end", async () => {
      await interaction.editReply({
        embeds: [generateEmbed(currentIndex)],
        components: [] // disable buttons
      });
    });
  }
} as SlashCommand;

export default command;
