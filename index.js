import fetch from "node-fetch";
import { parse } from "csv-parse/sync";
import fs from "fs";
import sharp from "sharp";
import dotenv from "dotenv";
dotenv.config();

const sheetUrl = process.env.GOOGLE_SHEET_URL;
const apiUrl = process.env.API_URL;

async function getSheetRows() {
  const url = sheetUrl;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch sheet: ${response.statusText}`);

  const csvText = await response.text();

  const records = parse(csvText, {
    columns: false,
    skip_empty_lines: true,
  });
  return records.flat();
}

async function main() {
  const rows = await getSheetRows();
  const imageDir = `./images`;

  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
    console.log("Created ./images folder successfully!");
  } else {
    console.log("./images folder already exist!");
  }

  for (let row of rows) {
    try {
      const response = await fetch(`${apiUrl}${row}`);
      if (!response.ok) {
        console.warn(`Failed to fetch Nexon API for ${row}: ${response.statusText}`);
        continue;
      }
      const data = await response.json();

      if (!data.ranks || !data.ranks[0] || !data.ranks[0].characterImgURL) {
        console.warn(`No image URL found for ${row}`);
        continue;
      }

      const image = await fetch(data.ranks[0].characterImgURL);
      if (!image.ok) {
        console.warn(`Failed to fetch image for ${row}: ${image.statusText}`);
        continue;
      }

      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const imagePath = `${imageDir}/${row}.png`;
      const flipImagePath = `${imageDir}/${row}_f.png`;

      let needWrite = false;
      if (!fs.existsSync(imagePath)) {
        needWrite = true;
      } else {
        const imageBuffer = fs.readFileSync(imagePath);
        if (!buffer.equals(imageBuffer)) {
          needWrite = true;
        }
      }

      if (needWrite) {
        const flippedBuffer = await sharp(buffer).flop(true).toBuffer();
        await fs.promises.writeFile(imagePath, buffer);
        await fs.promises.writeFile(flipImagePath, flippedBuffer);
        console.log(`Downloaded and updated images for: ${row}`);
      } else {
        console.log(`No update needed for: ${row}`);
      }
    } catch (error) {
      console.error(`Error processing ${row}:`, error);
    }
  }
}

main().catch(console.error);
