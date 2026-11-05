import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Mesma origem da CSP do Express; não editar arquivos gerados manualmente.
const result = spawnSync('flutter', ['build', 'web', '--base-href', '/mobile/', '--no-web-resources-cdn'], {
  cwd: fileURLToPath(new URL('../apps/mobile/', import.meta.url)),
  stdio: 'inherit', shell: process.platform === 'win32'
});
if (result.error) console.error('Flutter indisponível: confira o SDK no PATH.');
process.exitCode = result.status ?? 1;
