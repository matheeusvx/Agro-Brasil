import { connectDatabase } from './database.mjs';
import { createApp } from './app.mjs';

const host = process.env.HOST || '127.0.0.1';
const demoAuthEnabled = process.env.DEMO_AUTH_ENABLED === 'true';
if (demoAuthEnabled && !['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Demonstração permitida somente em loopback.');
try {
  const { client, db } = await connectDatabase();
  const server = createApp(db, { demoAuthEnabled }).listen(Number(process.env.PORT || 3000), host, () => console.log(`Agro+ Brasil: http://${host}:${process.env.PORT || 3000} | autenticação demo: ${demoAuthEnabled}`));
  const stop = () => server.close(async () => { await client.close(); process.exit(0); });
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
} catch {
  console.error('Inicialização falhou. Verifique MongoDB, URI e permissões; detalhes de conexão omitidos para não expor credenciais.');
  process.exitCode = 1;
}
