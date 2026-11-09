from pathlib import Path
s=Path('scripts/smoke-production.mjs').read_text(encoding='utf-8')
a=s.index('  await mkdir(directory, { recursive: true });');b=s.index('  // Headers/recurso reais:')
body=s[a:b]
prefix="""import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { connectDatabase } from '../services/api/src/database.mjs';
import { createApp } from '../services/api/src/app.mjs';
import { tokenHash } from '../services/api/src/auth.mjs';
import { productionDocument } from '../services/api/src/domain.mjs';
import { weatherProvider } from '../services/api/src/weather.mjs';
const existing=false, directory=resolve('.data/production-android');
let mongo, connection, server, token, base;
try {
"""
post="""  await writeFile(resolve(directory,'session.json'),JSON.stringify({token,port:server.address().port}));
  console.log('Servidor Android isolado pronto; identidade demonstrativa somente em arquivo local ignorado.');
  await new Promise(done=>process.once('SIGINT',done));
} finally {
  if(server) await new Promise(done=>server.close(done));
  if(connection) await connection.client.close();
  if(mongo) await mongo.stop({doCleanup:false});
}
"""
Path('scripts/serve-production-android.mjs').write_text(prefix+body+post,encoding='utf-8')
