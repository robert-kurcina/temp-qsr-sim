import fs from 'fs';

const data = JSON.parse(fs.readFileSync('docs/MEST.Items-by-tech.json', 'utf-8'));

// Group by tech_period and tech_level
const result = {};

// Build item_tech_window array
const itemTechWindow = [];

data.forEach(entry => {
  const item = entry.item;

  // Split Period on underscore, take part 2
  const techPeriodParts = entry.tech_period.split('_');
  const techPeriod = techPeriodParts[1];

  // Split tech_age on dash, take part 1 as number and part 2 as tech_age
  const techAgeParts = entry.tech_age.split('-');
  const techLevel = parseInt(techAgeParts[0], 10);
  const techAge = techAgeParts[1];

  // Split tech_age_latest on dash, take part 1 as number for tech_level_latest
  const techAgeLatestParts = entry.tech_age_latest.split('-');
  const techLevelLatest = parseInt(techAgeLatestParts[0], 10);

  // Create a unique key for grouping
  const key = `${techPeriod}_${techLevel}`;

  // Initialize if not exists
  if (!result[key]) {
    result[key] = {
      tech_period: techPeriod,
      tech_level: techLevel,
      tech_age: techAge,
      items: []
    };
  }

  // Append item to array
  result[key].items.push(item);

  // Add to item_tech_window array
  itemTechWindow.push({
    item: item,
    tech_window: {
      early: techLevel,
      latest: techLevelLatest
    }
  });
});

// Convert object to array of values
const outputArray = Object.values(result).sort((a, b) => {
  if (a.tech_level !== b.tech_level) return a.tech_level - b.tech_level;
  return a.tech_period.localeCompare(b.tech_period);
});

fs.writeFileSync('docs/tech_level_REVISED.json', JSON.stringify(outputArray, null, 2));
console.log('Processing complete. Output written to docs/tech_level_REVISED.json');
console.log(`Total entries: ${outputArray.length}`);

fs.writeFileSync('docs/item_tech_window.json', JSON.stringify(itemTechWindow, null, 2));
console.log('Item tech window written to docs/item_tech_window.json');
console.log(`Total items: ${itemTechWindow.length}`);
