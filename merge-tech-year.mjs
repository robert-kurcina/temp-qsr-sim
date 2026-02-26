import fs from 'fs';

const techLevelData = JSON.parse(fs.readFileSync('src/data/tech_level.json', 'utf-8'));
const techLevelRevised = JSON.parse(fs.readFileSync('docs/tech_level_REVISED.json', 'utf-8'));

// Create a map of tech_age to tech_year for quick lookup
const techAgeMap = {};
techLevelData.forEach(entry => {
  techAgeMap[entry.tech_age] = entry.tech_year;
});

// Update tech_level_REVISED.json with tech_year
techLevelRevised.forEach(entry => {
  if (entry.tech_age && techAgeMap.hasOwnProperty(entry.tech_age)) {
    entry.tech_year = techAgeMap[entry.tech_age];
  }
});

fs.writeFileSync('docs/tech_level_REVISED.json', JSON.stringify(techLevelRevised, null, 2));
console.log('Successfully added tech_year to tech_level_REVISED.json');
