import { SlashCommandBuilder, ChatInputCommandInteraction, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, ButtonBuilder, ButtonStyle } from "discord.js";
import { getOrCreateUserWatchlist, getOrCreateServerWatchlist } from "../utils/watchlistUtils";
import { SlashCommand } from "../types/ExtendedClient";
import { WatchlistLog } from "../models/WatchlistLog";
import { sendLog } from "../utils/logUtils";

// Temporary buffer for undo
const undoBuffer = new Map<string, { items: any[], scope: "user" | "server", watchlistId: string }>();

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove one or more items from your or the server's watchlist.")
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
    await interaction.deferReply({ ephemeral: true });

    const type = interaction.options.get("type")?.value as "all" | "movie" | "tv" | "anime" || "all";
    const scope = interaction.options.get("scope")?.value as "user" | "server";

    try {
      // Get watchlist
      let watchlist;
      if (scope === "user") {
        watchlist = await getOrCreateUserWatchlist(interaction.user.id);
      } else {
        if (!interaction.guild) {
          await interaction.editReply("❌ Server watchlist can only be modified in a server.");
          return;
        }
        watchlist = await getOrCreateServerWatchlist(interaction.guild.id);
      }

      let items = watchlist.items;
      if (type !== "all") {
        items = items.filter((i: any) => i.type === type);
      }

      if (!items.length) {
        await interaction.editReply(`📭 No items found in ${scope === "user" ? "your" : "this server's"} watchlist${type !== "all" ? ` for ${type}` : ""}.`);
        return;
      }

      // Build multi-select dropdown
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_item")
        .setPlaceholder("Select item(s) to remove")
        .setMinValues(1)
        .setMaxValues(Math.min(25, items.length))
        .addOptions(
          items.slice(0, 25).map((i: any) => ({
            label: i.title.length > 50 ? i.title.slice(0, 47) + "..." : i.title,
            description: `${i.type.toUpperCase()} • ${i.status}${i.releaseDate ? ` (${new Date(i.releaseDate).getFullYear()})` : ""}`,
            value: i.tmdbId.toString(),
          }))
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      const msg = await interaction.editReply({ content: "Select item(s) to remove:", components: [row] });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 30000
      });

      collector.on("collect", async (menuInteraction) => {
        if (menuInteraction.user.id !== interaction.user.id) {
          await menuInteraction.reply({ content: "You cannot select for this action.", ephemeral: true });
          return;
        }

        const selectedIds = menuInteraction.values.map(v => parseInt(v));
        const selectedItems = items.filter((i: any) => selectedIds.includes(i.tmdbId));

        if (!selectedItems.length) {
          await menuInteraction.update({ content: "❌ Items not found.", components: [] });
          return;
        }

        // Ask for confirmation
        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("confirm_remove").setLabel(`Yes, remove ${selectedItems.length} item(s)`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("cancel_remove").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
        );

        await menuInteraction.update({ content: `Are you sure you want to remove:\n**${selectedItems.map(i => i.title).join(", ")}**`, components: [confirmRow] });

        const btnCollector = msg.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000
        });

        btnCollector.on("collect", async (btnInteraction) => {
          if (btnInteraction.user.id !== interaction.user.id) {
            await btnInteraction.reply({ content: "You cannot confirm this action.", ephemeral: true });
            return;
          }

          if (btnInteraction.customId === "confirm_remove") {
            // Backup for undo
            const backupKey = `${interaction.user.id}-${Date.now()}`;
            undoBuffer.set(backupKey, { items: selectedItems, scope, watchlistId: scope === "user" ? interaction.user.id : interaction.guild!.id });

            // Remove from DB
            watchlist.items = watchlist.items.filter((i: any) => !selectedIds.includes(i.tmdbId));
            await watchlist.save();

            // **Log removals (per item)**
            for (const item of selectedItems) {
              await WatchlistLog.create({
                watchlistId: watchlist._id,
                action: "remove",
                itemId: item._id,
                itemTitle: item.title,
                itemType: item.type,
                oldStatus: item.status,
                updatedBy: interaction.user.id,
                updatedAt: new Date(),
              });
              if (interaction.guildId){
              await sendLog(
                interaction.client,
                interaction.guildId!,
                `🗑️ **<@${interaction.user.id}>** removed the **Item: ${item.title}** from ${scope} watch-list.`
              );}
            }

            // Undo button
            const undoRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId(`undo_${backupKey}`).setLabel("Undo").setStyle(ButtonStyle.Secondary)
            );

            await btnInteraction.update({ content: `✅ Removed **${selectedItems.length}** item(s): ${selectedItems.map(i => i.title).join(", ")}\n*(You can undo this within 30s)*`, components: [undoRow] });

            // Auto-expire undo after 30s
            setTimeout(() => undoBuffer.delete(backupKey), 30000);

            // Listen for Undo
            const undoCollector = msg.createMessageComponentCollector({
              componentType: ComponentType.Button,
              time: 30000
            });

            undoCollector.on("collect", async (undoInteraction) => {
              if (undoInteraction.user.id !== interaction.user.id) {
                await undoInteraction.reply({ content: "You cannot undo this action.", ephemeral: true });
                return;
              }

              if (undoInteraction.customId === `undo_${backupKey}`) {
                const backup = undoBuffer.get(backupKey);
                if (backup) {
                  // Restore items
                  let restoreList = backup.scope === "user" ? await getOrCreateUserWatchlist(backup.watchlistId) : await getOrCreateServerWatchlist(backup.watchlistId);
                  restoreList.items.push(...backup.items);
                  await restoreList.save();

                  // **Log one undo action**
                  await WatchlistLog.create({
                    watchlistId: restoreList._id,
                    action: "undo_remove",
                    itemTitle: backup.items.map(i => i.title).join(", "),
                    itemType: "multiple",
                    updatedBy: interaction.user.id,
                    updatedAt: new Date(),
                  });

                  if (interaction.guildId){
                  await sendLog(
                    interaction.client,
                    interaction.guildId!,
                    `↩️ **<@${interaction.user.id}>** restored the **Item: ${backup.items.map(i => i.title).join(", ")}** from ${scope} watch-list.`
                  );}

                  undoBuffer.delete(backupKey);
                  await undoInteraction.update({ content: `↩️ Undo successful! Restored **${backup.items.length}** item(s).`, components: [] });
                } else {
                  await undoInteraction.update({ content: "❌ Undo expired.", components: [] });
                }
              }
            });

          } else {
            await btnInteraction.update({ content: "❌ Removal canceled.", components: [] });
          }
          btnCollector.stop();
        });
        collector.stop();
      });
    } catch (err) {
      console.error(err);
      await interaction.editReply("⚠️ Something went wrong while removing the item.");
    }
  },
} as SlashCommand;

export default command;
