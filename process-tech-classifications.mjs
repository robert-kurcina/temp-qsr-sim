import fs from 'fs';

const data = JSON.parse(fs.readFileSync('docs/MEST.Items-by-tech.json', 'utf-8'));

// Group by tech_period and tech_level
const result = {};

data.forEach(entry => {
  const item = entry.Item;
  
  // Split Period on underscore, take part 2
  const techPeriodParts = entry.Period.split('_');
  const techPeriod = techPeriodParts[1];
  
  // Split tech_age on dash, take part 1 as number and part 2 as tech_age
  const techAgeParts = entry.Age.split('-');
  const techLevel = parseInt(techAgeParts[0], 10);
  const techAge = techAgeParts[1];
  
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
});

// Convert object to array of values
const outputArray = Object.values(result).sort((a, b) => {
  if (a.tech_level !== b.tech_level) return a.tech_level - b.tech_level;
  return a.tech_period.localeCompare(b.tech_period);
});

fs.writeFileSync('docs/tech_level_REVISED.json', JSON.stringify(outputArray, null, 2));
console.log('Processing complete. Output written to docs/tech_level_REVISED.json');
console.log(`Total entries: ${outputArray.length}`);
