import { Profile } from "./Profile";
import { promises as fs } from 'fs';
import path from 'path';

const profilesDir = path.join(process.cwd(), 'src', 'data', 'profiles');

export async function loadProfiles(): Promise<Profile[]> {
  const filenames = await fs.readdir(profilesDir);
  const profiles = filenames.map(async (filename) => {
    const filePath = path.join(profilesDir, filename);
    const fileContents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileContents) as Profile;
  });
  return Promise.all(profiles);
}

export function loadProfile(name: string): Profile {
  // This is a placeholder implementation. In a real application, you would
  // load the profile from the database or a file.
  return {
    name,
    archetype: {
      name: 'Test Archetype',
      attributes: {
        cca: 1,
        rca: 1,
        ref: 1,
        int: 1,
        pow: 1,
        str: 1,
        for: 1,
        mov: 1,
        siz: 1,
      },
      traits: [],
      bp: 0,
      species: 'Humanoid',
      class: 'common',
    },
    equipment: [],
  };
}
