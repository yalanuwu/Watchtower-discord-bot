// utils/galleryUtil.ts
import { createCanvas, loadImage } from "canvas";
import path from "path";

const POSTER_WIDTH = 300;
const POSTER_HEIGHT = 450;
const GRID_COLS = 2;
const GRID_ROWS = 2;
// const PLACEHOLDER = path.join(__dirname, "../../assets/no-poster.png"); 
const PLACEHOLDER = "https://placehold.co/300x450?text=Watch+Tower"; // Add a placeholder image

export async function createGallery(posters: (string | null)[]) {
    const canvas = createCanvas(POSTER_WIDTH * GRID_COLS, POSTER_HEIGHT * GRID_ROWS);
    const ctx = canvas.getContext("2d");

    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
        const x = (i % GRID_COLS) * POSTER_WIDTH;
        const y = Math.floor(i / GRID_COLS) * POSTER_HEIGHT;
        const poster = posters[i] ? `https://image.tmdb.org/t/p/w500${posters[i]}` : PLACEHOLDER;
        try {
            const img = await loadImage(poster);
            ctx.drawImage(img, x, y, POSTER_WIDTH, POSTER_HEIGHT);
        } catch (err) {
            const img = await loadImage(PLACEHOLDER);
            ctx.drawImage(img, x, y, POSTER_WIDTH, POSTER_HEIGHT);
        }
    }

    return canvas.toBuffer("image/png");
}
