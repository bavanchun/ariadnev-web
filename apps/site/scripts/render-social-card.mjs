// Render public/social-card.png (1200x630) from assets/social-card.svg.
// Run after editing the SVG; the PNG is committed because the site build must
// not depend on a font stack that differs between machines.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "assets", "social-card.svg"));
await sharp(svg, { density: 144 }).resize(1200, 630).png().toFile(join(root, "public", "social-card.png"));
console.log("wrote public/social-card.png");
