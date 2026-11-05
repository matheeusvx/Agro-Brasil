import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const dbPath = resolve('.data/mongodb');
await mkdir(dbPath, { recursive: true });
const mongo = await MongoMemoryReplSet.create({
  binary: { version: process.env.MONGOMS_VERSION || '8.0.16', downloadDir: resolve('.cache/mongodb-binaries') },
  instanceOpts: [{ port: 27017, dbPath }],
  replSet: { name: 'agroLocal', count: 1, ip: '127.0.0.1', storageEngine: 'wiredTiger' }
});
console.log('MongoDB REAL replica set agroLocal em 127.0.0.1:27017; transações habilitadas, dados preservados em .data/mongodb. Ctrl+C encerra sem apagar dados.');
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await mongo.stop({ doCleanup: false }); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
