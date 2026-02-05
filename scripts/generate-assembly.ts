import { createAssembly } from '../src/lib/mest-tactics/assembly-factory';

// This script generates a random assembly and prints it to the console as JSON.
const assembly = createAssembly();

console.log(JSON.stringify(assembly, null, 2));
