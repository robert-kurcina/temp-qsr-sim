import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'src/data');
const outputDir = path.join(process.cwd(), 'src/data'); // Output to src/data
const outputFile = path.join(outputDir, 'bundledData.js');

const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));

let bundledData = {};

files.forEach(file => {
    const filePath = path.join(dataDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const key = path.basename(file, '.json').replace(/\s+/g, '_'); // Replace spaces with underscores
    bundledData[key] = JSON.parse(fileContent);
});

// Create the output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputFile, `export const pageContent = ${JSON.stringify(bundledData.page_content, null, 2)};\nexport const gameRules = ${JSON.stringify(bundledData.game_rules, null, 2)};`);

console.log('Data bundled successfully!');
