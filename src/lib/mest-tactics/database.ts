
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { Character } from './Character';
import { Profile } from './Profile';
import { Assembly } from './Assembly';

// Define the structure of our database
interface DatabaseSchema {
  profiles: Profile[];
  characters: Character[];
  assemblies: Assembly[];
}

// Define the default state of the database
const defaultState: DatabaseSchema = {
  profiles: [],
  characters: [],
  assemblies: [],
};

class DatabaseService {
  private db: Low<DatabaseSchema>;

  constructor(filename: string) {
    const adapter = new JSONFile<DatabaseSchema>(filename);
    this.db = new Low(adapter, defaultState);
  }

  async read() {
    await this.db.read();
  }

  async write() {
    await this.db.write();
  }

  get profiles() {
    return this.db.data.profiles;
  }

  get characters() {
    return this.db.data.characters;
  }

  get assemblies() {
    return this.db.data.assemblies;
  }
}

// Export a singleton instance of the database service
export const databaseService = new DatabaseService('db.json');
