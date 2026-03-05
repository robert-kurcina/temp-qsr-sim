import { buildAssembly, buildProfile } from '../src/lib/mest-tactics/mission/assembly-builder';

// This script generates a random assembly and prints it to the console as JSON.
const profile = buildProfile('Average', { itemNames: [] });
const assembly = buildAssembly('Test Assembly', [profile]);

console.log(JSON.stringify(assembly, null, 2));
