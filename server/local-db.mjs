import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function openLocalDatabase(filename, projectRoot) {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (tag TEXT PRIMARY KEY NOT NULL)');
  const journal = JSON.parse(readFileSync(path.join(projectRoot, 'drizzle/meta/_journal.json'), 'utf8'));
  for (const migration of journal.entries) {
    if (sqlite.prepare('SELECT tag FROM local_migrations WHERE tag=?').get(migration.tag)) continue;
    sqlite.exec('BEGIN');
    try {
      sqlite.exec(readFileSync(path.join(projectRoot, 'drizzle', migration.tag + '.sql'), 'utf8').replaceAll('--> statement-breakpoint', ''));
      sqlite.prepare('INSERT INTO local_migrations (tag) VALUES (?)').run(migration.tag);
      sqlite.exec('COMMIT');
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  }
  function prepare(query, args = []) {
    const statement = sqlite.prepare(query);
    return {
      bind(...values) { return prepare(query, values); },
      async first() { return statement.get(...args) || null; },
      async all() { return { results: statement.all(...args) }; },
      async run() { return this.execute(); },
      execute() { const result = statement.run(...args); return { success: true, meta: { changes: Number(result.changes) } }; }
    };
  }
  return {
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const result = statements.map(statement => statement.execute()); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close() { sqlite.close(); }
  };
}
