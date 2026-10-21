// Generates PWA icons: a gold Latin cross on ivory. Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const IVORY = "#FAFAF8";
const GOLD = "#B8860B";

// scale < 1 keeps the cross inside the maskable safe zone.
const svg = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" fill="${IVORY}"/>
<g transform="translate(256 256) scale(${scale}) translate(-256 -256)" fill="${GOLD}">
<rect x="226" y="86" width="60" height="340" rx="4"/>
<rect x="146" y="170" width="220" height="56" rx="4"/>
</g></svg>`;

mkdirSync("public/icons", { recursive: true });
const render = (scale, size, file) => sharp(Buffer.from(svg(scale))).resize(size, size).png().toFile(`public/icons/${file}`);
await render(1, 192, "icon-192.png");
await render(1, 512, "icon-512.png");
await render(0.8, 512, "icon-maskable-512.png");
await sharp(Buffer.from(svg(1))).resize(512, 512).png().toFile("src/app/icon.png");
await sharp(Buffer.from(svg(1))).resize(180, 180).png().toFile("src/app/apple-icon.png");
