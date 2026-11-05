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
assert.ok(!process.argv.includes('--existing'), 'Este roteiro aceita somente banco isolado de teste.');
const existing = false;
const directory = resolve(process.env.SMOKE_EVIDENCE_DIR || 'docs/design/desktop/evidencias');
const executablePath = process.env.SMOKE_BROWSER_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'
].find(existsSync);
assert.ok(executablePath, 'Informe SMOKE_BROWSER_PATH para um navegador Chromium instalado.');
assert.ok(existsSync('apps/mobile/build/web/flutter_bootstrap.js'), 'Execute npm run build:mobile primeiro.');
let mongo, connection, server, browser, page;
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
    await db.collection('users').updateOne({_id:userId},{$set:{displayName:'Maria · teste fictício'}});
    const property=await db.collection('properties').findOne({organizationId});
    const lotIds=[];
    for(const [cropName,quantityKg] of [['Alface',12.5],['Tomate',8],['Cenoura',5]]) {
      const cropId=randomUUID();await db.collection('crops').insertOne({_id:cropId,name:cropName,status:'ATIVA'});
      const response=await fetch(base+'/api/v1/productions',{method:'POST',headers:{Authorization:'Bearer '+token,'X-Organization-Id':organizationId,'Content-Type':'application/json'},body:JSON.stringify({propertyId:property._id,cropId,quantityKg,seasonLabel:'Teste 2026',harvestedOn:new Date().toISOString().slice(0,10),location:{municipality:'São Paulo',uf:'SP'},locationConfirmed:true})});
      assert.equal(response.status,201);lotIds.push((await response.json()).data.lot.id);
    }
    for(const [i,status] of ['SOLICITADO','ACEITO','RETIRADO','CANCELADO','SOLICITADO'].entries()) {
      await db.collection('orders').insertOne({_id:randomUUID(),lotId:lotIds[i%3],sellerOrganizationId:organizationId,requesterOrganizationId:randomUUID(),quantityGrams:1000,status,createdAt:new Date().toISOString()});
    }

  }
  // Headers/recurso reais: impede regressão para CDN mesmo se o computador tem internet.
  for (const [path,type] of [['/mobile/','text/html'],['/mobile/flutter_bootstrap.js','javascript'],['/mobile/main.dart.js','javascript'],['/mobile/canvaskit/chromium/canvaskit.js','javascript'],['/mobile/canvaskit/chromium/canvaskit.wasm','application/wasm'],['/mobile/assets/assets/fonts/roboto-regular.ttf','font/ttf']]) {
    const response = await fetch(base+path); assert.equal(response.status,200,path); assert.equal(response.redirected,false,path); assert.ok(response.headers.get('content-type')?.includes(type),path);
    if(path==='/mobile/') assert.match(await response.text(), /<base href="\/mobile\/">/);
  }
  browser = await chromium.launch({executablePath,headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:900}});
  page = await context.newPage();
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
  await page.getByText('Produção por cultura',{exact:true}).waitFor();
  await page.screenshot({path:resolve(directory,'home.png')});
    for(const [width,height] of [[1440,900],[1366,768],[1024,768],[768,1024],[390,844]]) {
    await page.setViewportSize({width,height});await page.waitForLoadState('networkidle');await page.waitForTimeout(400);
    await page.screenshot({path:resolve(directory,'home-'+width+'.png'),fullPage:true});
  }
  await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(1000);
  await page.getByRole('button',{name:'Produção',exact:true}).first().click();
  await page.getByText('Minha produção',{exact:false}).waitFor();
  await page.screenshot({path:resolve(directory,'production.png')});
  await page.getByRole('button',{name:'Início',exact:true}).click();
  await page.getByText('Produção por cultura',{exact:true}).waitFor();
  await page.mouse.move(1100,650);await page.mouse.wheel(0,500);await page.waitForTimeout(500);
  await page.screenshot({path:resolve(directory,'charts.png')});
  await page.screenshot({path:resolve(directory,'bar.png'),clip:{x:244,y:85,width:572,height:470}});
  await page.screenshot({path:resolve(directory,'ring.png'),clip:{x:840,y:85,width:572,height:560}});
  const culture=page.getByRole('button',{name:'Tomate · 8 kg',exact:true});
  await culture.hover();await culture.click();await page.waitForTimeout(250);
  await page.screenshot({path:resolve(directory,'selected.png'),fullPage:true});

  await connection.db.collection('productions').deleteMany({});
  await connection.db.collection('orders').deleteMany({});
  await page.getByRole('button',{name:'Atualizar informações',exact:true}).click();
  await page.waitForLoadState('networkidle');await page.mouse.move(1100,650);await page.mouse.wheel(0,500);await page.waitForTimeout(500);
  await page.screenshot({path:resolve(directory,'empty.png')});
  await connection.db.collection('memberships').updateMany({},{$set:{role:'LEITOR'}});
  await page.getByRole('button',{name:'Atualizar informações',exact:true}).click();
  await page.waitForLoadState('networkidle');
  await page.mouse.move(1100,300);await page.mouse.wheel(0,-2000);await page.waitForTimeout(500);
  assert.equal(await page.getByRole('button',{name:'Cadastrar minha primeira produção',exact:true}).isDisabled(),true);
  await page.screenshot({path:resolve(directory,'read-only.png')});
  // Reload com o mesmo perfil exercita eventuais registros do service worker do build.
  await page.reload(); await page.getByRole('button',{name:'Verificar acesso',exact:true}).waitFor();
  assert.equal(responses.some(r=>r.url.endsWith('.wasm') && r.status===200 && r.type?.includes('application/wasm')),true,'WebAssembly foi carregado');
  assert.equal(responses.some(r=>r.url.endsWith('roboto-regular.ttf') && r.status===200),true,'Fonte local carregada');
  assert.deepEqual(responses.filter(r=>r.status>=400),[],'Nenhum HTTP de erro');
  assert.deepEqual(failedRequests,[],'Nenhum recurso bloqueado ou externo'); assert.deepEqual(errors,[],'Console sem erro');
  const evidence={verifiedAt:new Date().toISOString(),browser:await browser.version(),executable:executablePath,mode:existing?'EXISTING_LOCAL_DEMONSTRATION':'ISOLATED_FICTITIOUS_DATABASE',viewports:[[1440,900],[1366,768],[1024,768],[768,1024],[390,844]],chartHoverAndClickVerified:true,readOnlyVerified:true,loginRendered:true,authenticationVerified:true,producerHomeRendered:true,weather:weatherBody,reloadVerified:true,externalRequestsBlockedByTest:true,errors,failedRequests,responses};
  await writeFile(resolve(directory,'result.json'),JSON.stringify(evidence,null,2)); console.log('Smoke desktop aprovado: cinco resoluções, navegação, gráficos, vazio, LEITOR, reload e recursos locais.');
} catch (error) {
  if(typeof page!=='undefined')await page.screenshot({path:resolve(directory,'failure.png')}).catch(()=>{});
  const sanitize = value => String(value).split(token || '\0').join('[REDACTED]');
  await mkdir(directory,{recursive:true});
  await writeFile(resolve(directory,'failure.json'),JSON.stringify({error:sanitize(error.message),errors:errors.map(sanitize),failedRequests},null,2));
  console.error('Smoke falhou. Consulte failure.json sanitizado.'); process.exitCode=1;
} finally {
  if(browser) await browser.close(); if(server) await new Promise(r=>server.close(r));
  if(connection) await connection.client.close(); if(mongo) await mongo.stop({doCleanup:false});
}
