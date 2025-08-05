![WatchTower Banner](assets/watchtowerBanner.gif)


# 🎬 WatchTower Bot

**WatchTower** is a Discord bot for managing your personal and server watchlists, tracking trending & upcoming movies/TV shows, and setting reminders for releases.  
It integrates with **TMDB** (The Movie Database) API to fetch accurate movie and TV data, and supports **automated event creation**, **custom logs**, and **personalized reminders**.

([Try it out here](https://discord.com/oauth2/authorize?client_id=1400031633037594644&permissions=1755919637020353&integration_type=0&scope=applications.commands+bot))

---

## 🚀 Features
- **Watchlist Management**
  - Add movies/TV shows/anime to personal or server watchlists.
  - Export & import your watchlist easily.
  - Clear or remove items with interactive controls.
- **Trending & Upcoming**
  - Browse trending or upcoming movies and TV shows.
  - Interactive paginated embeds with detailed descriptions.
- **Reminders**
  - Set reminders for movie/TV show releases.
  - Choose delivery method: **DM**, **server channel**, or **Discord event**.
  - Missed reminders are automatically caught up if the bot was offline.
  - Old reminders are automatically cleaned up after 10 days.
- **Logging**
  - Set a dedicated server channel for logging watchlist & reminder activities.
- **Admin Tools**
  - Server watchlist clearing (only for Admins/Moderators).
- **Interactive UI**
  - Dropdowns, buttons, and embeds for smooth user interaction.

---

## 🛠️ Tech Stack
- **Discord.js v14** – Bot framework
- **MongoDB + Mongoose** – Data storage
- **TMDB API** – Movie & TV show information
- **TypeScript** – Main language
- **Render** – Deployment-ready setup with an Express web service

---

## 📦 Installation

### Prerequisites
- **Node.js** v18+
- **MongoDB** database
- **TMDB API Key** ([Get one here](https://www.themoviedb.org/documentation/api))
- **Discord Bot Token** ([Create a bot](https://discord.com/developers/applications))

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/WatchTower-bot.git
   cd WatchTower-bot
    ```
2. Install Dependencies:
    ```bash
    npm install
        ```
3. Create a .env file:
  ```bash
    DISCORD_TOKEN=your-bot-token
    CLIENT_ID=your-client-id
    MONGODB_URI=your-mongodb-uri
    TMDB_API_KEY=your-tmdb-api-key
    ```
4. Build the project:
    ```bash
    npm run build
        ```
5. Deploy slash commands:
    ```bash
    npm run deploy
        ```
6. Start the bot:
    ```bash
    npm start
    ```

---

## ⚡ Available Commands
- `/add` – Add an item to your watchlist
- `/remove` – Remove an item from your watchlist
- `/list` – View your watchlist
- `/clear-watchlist` – Clear server or personal watchlist
- `/trending` – View trending movies/TV shows
- `/upcoming` – View upcoming releases & set reminders
- `/remind-me` – Manually set a release reminder
- `/my-reminders` – View your reminders
- `/remove-reminder` – Remove a reminder
- `/set-log-channel` – Set a log channel for server activities
- `/import` - Import your watchlist from a JSON file
- `/export` - Export your watchlist as a JSON file
- `/logs` – View the logs for server activities
- `/update` – Update the bot and slash commands
- `/search` – Search for movies/TV shows with a given title

---

## 🔧 Development
Run the bot in development mode:
```bash
npm run dev
```

Watch for changes and rebuild automatically.

---

## 🖥️ Deployment
The bot is **Render-ready**:
- It includes an **Express server** to keep the service alive.
- Add your environment variables in the Render dashboard.
- Use `npm run build && npm start` for the startup command.

---

## 🤝 Contributing
Feel free to open issues or submit pull requests. Contributions are welcome!

---

## 👨‍💻 Author
Developed by **Abhigyan Mandal**.  
For suggestions or feature requests, open an issue on GitHub!


