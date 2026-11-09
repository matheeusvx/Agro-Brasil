import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { connectDatabase } from '../services/api/src/database.mjs';
import { createApp } from '../services/api/src/app.mjs';
import { tokenHash } from '../services/api/src/auth.mjs';
import { weatherProvider } from '../services/api/src/weather.mjs';

// Navegador real, build compilado, Express e API reais. Sem mocks de HTTP/renderização.
// Perfil temporário, sem abrir sessão pessoal nem persistir tokens em evidências.
const existing = process.argv.includes('--existing');
const directory = resolve(process.env.SMOKE_EVIDENCE_DIR || '.data/mobile-smoke');
const executablePath = process.env.SMOKE_BROWSER_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'
].find(existsSync);
assert.ok(executablePath, 'Informe SMOKE_BROWSER_PATH para um navegador Chromium instalado.');
assert.ok(existsSync('apps/mobile/build/web/flutter_bootstrap.js'), 'Execute npm run build:mobile primeiro.');
let mongo, connection, server, browser;
let token, base = 'http://127.0.0.1:3000';
const errors = [], failedRequests = [], responses = [];
try {
  await mkdir(directory, { recursive: true });
  if (existing) {
    const sessions = JSON.parse(await readFile('.data/demo-sessions.json', 'utf8'));
    token = sessions.sessions.find(s => s.type === 'PEQUENO_PRODUTOR_RURAL')?.token;
    assert.ok(token, 'Seed de demonstração necessário, sem imprimir token.');
  } else {
    const dbPath = resolve(`.data/mobile-smoke-${randomUUID()}`); await mkdir(dbPath, {recursive:true});
    mongo = await MongoMemoryServer.create({binary:{version:process.env.MONGOMS_VERSION || '8.0.16',downloadDir:resolve('.cache/mongodb-binaries')},instance:{dbPath,ip:'127.0.0.1'}});
    connection = await connectDatabase({uri:mongo.getUri(),name:'mobile_smoke'});
    const db = connection.db, userId = randomUUID(), organizationId = randomUUID(); token = randomBytes(32).toString('base64url');
    await db.collection('users').insertOne({_id:userId,status:'ATIVO',isDemonstration:true});
    await db.collection('organizations').insertOne({_id:organizationId,name:'Pequeno produtor fictício — SMOKE',type:'PEQUENO_PRODUTOR_RURAL',status:'ATIVA',isDemonstration:true});
    await db.collection('memberships').insertOne({userId,organizationId,role:'ADMIN',status:'ATIVO'});
    await db.collection('demoTokens').insertOne({userId,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+3600000)});
    await db.collection('properties').insertOne({_id:randomUUID(),organizationId,name:'Propriedade fictícia — SMOKE',municipality:'São Paulo',uf:'SP',status:'ATIVA',isDemonstration:true});
    server = createApp(db,{demoAuthEnabled:true,weather:weatherProvider({enabled:false})}).listen(0,'127.0.0.1');
    await once(server,'listening'); base = `http://127.0.0.1:${server.address().port}`;
  }
  // Headers/recurso reais: impede regressão para CDN mesmo se o computador tem internet.
  for (const [path,type] of [['/mobile/','text/html'],['/mobile/flutter_bootstrap.js','javascript'],['/mobile/main.dart.js','javascript'],['/mobile/canvaskit/chromium/canvaskit.js','javascript'],['/mobile/canvaskit/chromium/canvaskit.wasm','application/wasm'],['/mobile/assets/assets/fonts/roboto-regular.ttf','font/ttf']]) {
    const response = await fetch(base+path); assert.equal(response.status,200,path); assert.equal(response.redirected,false,path); assert.ok(response.headers.get('content-type')?.includes(type),path);
    if(path==='/mobile/') assert.match(await response.text(), /<base href="\/mobile\/">/);
  }
  browser = await chromium.launch({executablePath,headless:true});
  const context = await browser.newContext({viewport:{width:390,height:844}});
  const page = await context.newPage();
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
  page.on('response',r=>responses.push({url:r.url(),status:r.status(),type:r.headers()['content-type']}));
  await context.route('**/*',route=>new URL(route.request().url()).origin===base ? route.continue() : route.abort('blockedbyclient'));
  await page.goto(base+'/mobile/');
  await page.getByRole('button',{name:'Verificar acesso',exact:true}).waitFor({timeout:30000});
  await page.screenshot({path:resolve(directory,'login.png')});
  await page.getByLabel('Token temporário de demonstração',{exact:true}).fill(token);
  const identity = page.waitForResponse(r=>r.url()===base+'/api/v1/me');
  await page.getByRole('button',{name:'Verificar acesso',exact:true}).click(); assert.equal((await identity).status(),200);
  await page.getByRole('button',{name:'Entrar na minha propriedade',exact:true}).waitFor();
  const weather = page.waitForResponse(r=>/\/api\/v1\/properties\/[^/]+\/weather$/.test(r.url()));
  await page.getByRole('button',{name:'Entrar na minha propriedade',exact:true}).click();
  const weatherResponse = await weather; assert.equal(weatherResponse.status(),200);
  const weatherBody = await weatherResponse.json(); assert.equal(weatherBody.status,'unavailable'); assert.equal(weatherBody.reason,'NOT_CONFIGURED');
  await page.getByText('Clima indisponível',{exact:true}).waitFor();
  await page.getByText('Cadastrar minha primeira produção',{exact:true}).or(page.getByText('Ações rápidas',{exact:true})).first().waitFor();
  await page.screenshot({path:resolve(directory,'home.png')});
  // Territorial history is independent of the fictitious property's live weather.
  await page.getByRole('button',{name:'Inteligência hídrica territorial',exact:true}).click();
  // Flutter merges adjacent text into accessible paragraphs on web.
  await page.getByText('Mogi das Cruzes/SP',{exact:false}).first().waitFor();
  await page.getByText('86,57',{exact:false}).first().waitFor();
  await page.getByText('Choveu 54% menos que a média histórica',{exact:false}).first().waitFor();
  await page.getByText('Dados históricos até 31/12/2025 · NASA POWER',{exact:false}).first().waitFor();
  await page.screenshot({path:resolve(directory,'water-dashboard.png')});
  await page.getByRole('button',{name:'Voltar',exact:true}).click();
  await page.getByText('Clima indisponível',{exact:true}).waitFor();
  // Reload com o mesmo perfil exercita eventuais registros do service worker do build.
  await page.reload(); await page.getByRole('button',{name:'Verificar acesso',exact:true}).waitFor();
  assert.equal(responses.some(r=>r.url.endsWith('.wasm') && r.status===200 && r.type?.includes('application/wasm')),true,'WebAssembly foi carregado');
  assert.equal(responses.some(r=>r.url.endsWith('roboto-regular.ttf') && r.status===200),true,'Fonte local carregada');
  assert.deepEqual(responses.filter(r=>r.status>=400),[],'Nenhum HTTP de erro');
  assert.deepEqual(failedRequests,[],'Nenhum recurso bloqueado ou externo'); assert.deepEqual(errors,[],'Console sem erro');
  const evidence={verifiedAt:new Date().toISOString(),browser:await browser.version(),executable:executablePath,mode:existing?'EXISTING_LOCAL_DEMONSTRATION':'ISOLATED_FICTITIOUS_DATABASE',viewport:{width:390,height:844},loginRendered:true,authenticationVerified:true,producerHomeRendered:true,waterDashboardVerified:true,weather:weatherBody,reloadVerified:true,externalRequestsBlockedByTest:true,errors,failedRequests,responses};
  await writeFile(resolve(directory,'result.json'),JSON.stringify(evidence,null,2)); console.log('Smoke aprovado: autenticação, home, painel hídrico real, clima desabilitado, reload, fontes e WebAssembly locais.');
} catch (error) {
  const sanitize = value => String(value).split(token || '\0').join('[REDACTED]');
  await mkdir(directory,{recursive:true});
  const failedPage = browser?.contexts()[0]?.pages()[0];
  if (failedPage) {
    await failedPage.screenshot({path:resolve(directory,'failure.png')}).catch(()=>{});
    await writeFile(resolve(directory,'failure-accessibility.txt'),sanitize(await failedPage.locator('body').ariaSnapshot()));
  }
  await writeFile(resolve(directory,'failure.json'),JSON.stringify({error:sanitize(error.message),errors:errors.map(sanitize),failedRequests,responses},null,2));
  console.error('Smoke falhou. Consulte failure.json sanitizado.'); process.exitCode=1;
} finally {
  if(browser) await browser.close(); if(server) await new Promise(r=>server.close(r));
  if(connection) await connection.client.close(); if(mongo) await mongo.stop({doCleanup:false});
}
