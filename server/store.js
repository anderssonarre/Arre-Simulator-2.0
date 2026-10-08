// Lagring av konton, inloggningar och sparningar.
// Med DATABASE_URL används Postgres (behövs på Render, där filer försvinner vid omstart).
// Utan DATABASE_URL sparas allt i en JSON-fil i DATA_DIR (bra lokalt och på en egen server).
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function fileStore(dir) {
  const file = path.join(dir, 'arre-db.json');
  let db = { users: {}, saves: {}, sessions: {}, stats: {}, feedback: [] };
  try {
    db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {}
  let timer = null;
  const flush = () => {
    timer = null;
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, file);
  };
  const persist = () => (timer ??= setTimeout(flush, 200));
  return {
    kind: 'fil (' + file + ')',
    async getUser(key) {
      return db.users[key] || null;
    },
    async createUser(key, user) {
      if (db.users[key]) return false;
      db.users[key] = user;
      persist();
      return true;
    },
    async getSave(key) {
      return db.saves[key] || null;
    },
    async putSave(key, data, savedAt) {
      db.saves[key] = { data, savedAt };
      persist();
    },
    async getSession(hash) {
      return db.sessions[hash] || null;
    },
    async putSession(hash, key) {
      db.sessions[hash] = { key, created: Date.now() };
      persist();
    },
    async deleteSession(hash) {
      delete db.sessions[hash];
      persist();
    },
    // Anonyma räknare för statistiksidan.
    async addStats(delta) {
      for (const [k, n] of Object.entries(delta)) db.stats[k] = (db.stats[k] || 0) + n;
      persist();
    },
    async getStats() {
      return { ...db.stats };
    },
    async addFeedback(f) {
      db.feedback.push(f);
      db.feedback = db.feedback.slice(-200);
      persist();
    },
    async getFeedback(n) {
      return db.feedback.slice(-n).reverse();
    },
    flush,
  };
}

async function pgStore(url, pgModule) {
  const { Pool } = pgModule || require('pg');
  const pool = new Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) || pgModule ? false : { rejectUnauthorized: false },
    max: 4,
  });
  await pool.query(`create table if not exists arre_users (
    key text primary key, name text not null, salt text not null, hash text not null, created bigint not null)`);
  await pool.query(`create table if not exists arre_saves (
    key text primary key, data text not null, saved_at bigint not null)`);
  await pool.query(`create table if not exists arre_sessions (
    hash text primary key, key text not null, created bigint not null)`);
  await pool.query(`create table if not exists arre_stats (
    key text primary key, n double precision not null)`);
  await pool.query(`create table if not exists arre_feedback (
    id serial primary key, created bigint not null, fun text, stuck text, missing text)`);
  return {
    kind: 'postgres',
    async getUser(key) {
      const r = await pool.query(
        'select name, salt, hash, created from arre_users where key = $1',
        [key],
      );
      return r.rows[0] || null;
    },
    async createUser(key, u) {
      // Kolla först, och låt sedan primärnyckeln avgöra om två försöker samtidigt.
      if (await this.getUser(key)) return false;
      const r = await pool.query(
        'insert into arre_users (key, name, salt, hash, created) values ($1, $2, $3, $4, $5) on conflict (key) do nothing returning key',
        [key, u.name, u.salt, u.hash, u.created],
      );
      return r.rows.length === 1;
    },
    async getSave(key) {
      const r = await pool.query('select data, saved_at from arre_saves where key = $1', [key]);
      return r.rows[0] ? { data: r.rows[0].data, savedAt: Number(r.rows[0].saved_at) } : null;
    },
    async putSave(key, data, savedAt) {
      await pool.query(
        'insert into arre_saves (key, data, saved_at) values ($1, $2, $3) on conflict (key) do update set data = excluded.data, saved_at = excluded.saved_at',
        [key, data, savedAt],
      );
    },
    async getSession(hash) {
      const r = await pool.query('select key, created from arre_sessions where hash = $1', [hash]);
      return r.rows[0] ? { key: r.rows[0].key, created: Number(r.rows[0].created) } : null;
    },
    async putSession(hash, key) {
      await pool.query('insert into arre_sessions (hash, key, created) values ($1, $2, $3)', [
        hash,
        key,
        Date.now(),
      ]);
    },
    async deleteSession(hash) {
      await pool.query('delete from arre_sessions where hash = $1', [hash]);
    },
    async addStats(delta) {
      for (const [k, n] of Object.entries(delta))
        await pool.query(
          'insert into arre_stats (key, n) values ($1, $2) on conflict (key) do update set n = arre_stats.n + excluded.n',
          [k, n],
        );
    },
    async getStats() {
      const r = await pool.query('select key, n from arre_stats');
      return Object.fromEntries(r.rows.map((x) => [x.key, Number(x.n)]));
    },
    async addFeedback(f) {
      await pool.query(
        'insert into arre_feedback (created, fun, stuck, missing) values ($1, $2, $3, $4)',
        [f.created, f.fun, f.stuck, f.missing],
      );
    },
    async getFeedback(n) {
      const r = await pool.query(
        'select created, fun, stuck, missing from arre_feedback order by id desc limit $1',
        [n],
      );
      return r.rows.map((x) => ({ ...x, created: Number(x.created) }));
    },
    flush() {},
  };
}

async function openStore({
  url = process.env.DATABASE_URL,
  dir = process.env.DATA_DIR,
  pgModule,
} = {}) {
  if (url) return pgStore(url, pgModule);
  return fileStore(dir || path.join(__dirname, 'data'));
}
module.exports = { openStore };
