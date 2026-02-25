import fs from 'fs';
import csv from 'csv-parser';

const results = [];

fs.createReadStream('docs/MEST.Items-by-tech.csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', () => {
    fs.writeFileSync('docs/MEST.Items-by-tech.json', JSON.stringify(results, null, 2));
    console.log('Conversion complete');
  });