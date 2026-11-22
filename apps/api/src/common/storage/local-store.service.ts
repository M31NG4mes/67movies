import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface LocalDbSchema {
  users: Record<string, any>;
  sessions: Record<string, any>;
  profiles: Record<string, any>;
  favorites: Record<string, any>;
  history: Record<string, any>;
  progress: Record<string, any>;
  settings: Record<string, any>;
  friendships: Record<string, any>;
  ratings: Record<string, any>;
  collections: Record<string, any>;
  messages: Record<string, any>;
}

const EMPTY_DB: LocalDbSchema = {
  users: {},
  sessions: {},
  profiles: {},
  favorites: {},
  history: {},
  progress: {},
  settings: {},
  friendships: {},
  ratings: {},
  collections: {},
  messages: {},
};

/**
 * Persistent local JSON database used automatically when PostgreSQL is offline,
 * so accounts, profiles, avatars, friends, ratings, and settings survive API restarts.
 */
@Injectable()
export class LocalStoreService {
  private readonly logger = new Logger(LocalStoreService.name);
  private readonly dbPath = path.join(process.cwd(), 'data', 'local-db.json');
  private state: LocalDbSchema = structuredClone(EMPTY_DB);

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!fs.existsSync(this.dbPath)) return;
      const raw = fs.readFileSync(this.dbPath, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = { ...structuredClone(EMPTY_DB), ...parsed };
      this.logger.log(
        `Loaded local persistent store (${Object.keys(this.state.users).length} users)`,
      );
    } catch (err) {
      this.logger.warn(`Could not read local-db.json, starting fresh: ${err}`);
      this.state = structuredClone(EMPTY_DB);
    }
  }

  public save() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.dbPath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      this.logger.warn(`Failed to save local-db.json: ${err}`);
    }
  }

  public get data(): LocalDbSchema {
    return this.state;
  }
}
