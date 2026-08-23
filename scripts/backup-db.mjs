#!/usr/bin/env node
/**
 * Dump the exchange-rate database to timestamped JSON files.
 *
 * Usage:
 *   npm run db:backup
 *   node scripts/backup-db.mjs
 *   node scripts/backup-db.mjs --out ./backups --tables daily_rates,exchange_rates
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment or .env.
 * If those are missing, copies the local temp store.json used in development.
 */

import { createClient } from "@supabase/supabase-js";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE_SIZE = 1000;

const BACKUP_TABLES = [
  "banks",
  "currencies",
  "bank_status",
  "daily_rates",
  "exchange_rates",
];

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key]) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = { out: join(ROOT, "backups"), tables: BACKUP_TABLES };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === "--out" && next) {
      args.out = resolve(next);
      i += 1;
    } else if (flag === "--tables" && next) {
      args.tables = next
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      i += 1;
    } else if (flag === "--help" || flag === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  const unknown = args.tables.filter((name) => !BACKUP_TABLES.includes(name));
  if (unknown.length) {
    throw new Error(
      `Unknown table(s): ${unknown.join(", ")}. Known: ${BACKUP_TABLES.join(", ")}`,
    );
  }
  return args;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function localStorePath() {
  return join(tmpdir(), "sl-exchange-rates", "store.json");
}

async function fetchAll(client, table) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function backupSupabase(client, outDir, tables) {
  const counts = {};
  const combined = {};
  for (const table of tables) {
    process.stdout.write(`Fetching ${table}… `);
    const rows = await fetchAll(client, table);
    counts[table] = rows.length;
    combined[table] = rows;
    writeJson(join(outDir, `${table}.json`), rows);
    console.log(`${rows.length} row${rows.length === 1 ? "" : "s"}`);
  }
  return { counts, combined };
}

function backupLocalStore(outDir) {
  const source = localStorePath();
  if (!existsSync(source)) {
    throw new Error(
      "No Supabase credentials and no local store.json found. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.",
    );
  }
  const dest = join(outDir, "local-store.json");
  copyFileSync(source, dest);
  const parsed = JSON.parse(readFileSync(source, "utf8"));
  return {
    source: "local",
    path: dest,
    counts: {
      rates: Array.isArray(parsed.rates) ? parsed.rates.length : 0,
      status: parsed.status ? Object.keys(parsed.status).length : 0,
      daily: parsed.daily ? Object.keys(parsed.daily).length : 0,
    },
  };
}

async function main() {
  loadEnvFile(join(ROOT, ".env"));
  loadEnvFile(join(ROOT, ".env.local"));

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Backup the exchange-rate database.

Usage:
  npm run db:backup
  node scripts/backup-db.mjs [--out DIR] [--tables a,b]

Writes timestamped JSON under backups/ (gitignored).
Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or a local store.json.`);
    return;
  }

  const outDir = join(args.out, stamp());
  mkdirSync(outDir, { recursive: true });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let manifest;

  if (url && key) {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { counts, combined } = await backupSupabase(client, outDir, args.tables);
    writeJson(join(outDir, "backup.json"), combined);
    manifest = {
      createdAt: new Date().toISOString(),
      source: "supabase",
      projectUrl: url,
      tables: args.tables,
      counts,
    };
  } else {
    console.log("Supabase not configured; backing up local store.json");
    const local = backupLocalStore(outDir);
    manifest = {
      createdAt: new Date().toISOString(),
      source: "local",
      localPath: localStorePath(),
      counts: local.counts,
    };
  }

  writeJson(join(outDir, "manifest.json"), manifest);
  console.log(`\nBackup written to ${outDir}`);
  for (const [name, count] of Object.entries(manifest.counts)) {
    console.log(`  ${name}: ${count}`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
