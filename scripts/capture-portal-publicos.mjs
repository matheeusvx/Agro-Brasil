// Capturas e verificações de interface do portal multi-público contra a API
// real. Tokens são lidos de .data/ e digitados apenas no navegador headless.
// Uso: node scripts/capture-portal-publicos.mjs [http://127.0.0.1:3101]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:3101';
const out = 'docs/design/publicos-web/';
await mkdir(out, { recursive: true });
const demo = JSON.parse(await readFile('.data/demo-sessions.json', 'utf8')).sessions;
const extra = JSON.parse(await readFile('.data/demo-sessions-publicos.json', 'utf8')).sessions;
const tokens = {
  produtor: demo.find(s => s.type === 'PEQUENO_PRODUTOR_RURAL').token,
  cooperativa: demo.find(s => s.type === 'COOPERATIVA').token,
  instituicao: demo.find(s => s.type === 'INSTITUICAO').token,
  multiplo: extra.find(s => s.key === 'demo-publicos-multiplo').token,
  leitor: extra.find(s => s.key === 'demo-publicos-leitor-cooperativa').token,
};
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const results = [];
const errors = [];
async function session(name, run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  const requests = [];
  page.on('request', r => { if (r.url().includes('/api/agro/')) requests.push(new URL(r.url()).pathname.replace('/api/agro', '')); });
  await page.goto(base + '/visao-geral');
  await page.getByLabel('Acesso temporário').fill(tokens[name]);
  await page.getByRole('button', { name: 'Entrar no portal' }).click();
  await page.locator('.portal-frame').waitFor();
  try { results.push({ name, ok: true, ...(await run(page, requests)) }); }
  catch (e) { results.push({ name, ok: false, error: e.message }); }
  finally {
    // Tokens e IDs nunca entram nas evidências: armazenamento do navegador deve estar vazio.
    const storage = await page.evaluate(() => localStorage.length + sessionStorage.length);
    assert.equal(storage, 0);
    await context.close();
  }
}
const noOverflow = page => page.evaluate(() => {
  if (document.documentElement.scrollWidth <= innerWidth) return true;
  const wide = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.skip-link'));
  return 'excede: ' + wide.slice(0, 3).map(e => e.tagName + '.' + e.className.toString().split(' ')[0]).join(', ');
});
async function shots(page, prefix) {
  const overflow = {};
  for (const [w, h] of [[1440, 900], [390, 844], [320, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    overflow[w] = await noOverflow(page);
    await page.screenshot({ path: out + prefix + '-' + w + '.png', fullPage: true });
  }
  await page.addStyleTag({ content: 'html{font-size:200% !important} body{font-size:200%}' , });
  await page.evaluate(() => document.documentElement.setAttribute('data-texto-200', ''));
  await page.waitForTimeout(150);
  overflow['320-texto-200'] = await noOverflow(page);
  await page.screenshot({ path: out + prefix + '-320-texto-200.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  return overflow;
}

await session('produtor', async (page, requests) => {
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  await page.getByRole('navigation', { name: 'Espaço do produtor' }).waitFor();
  const links = await page.locator('.portal-sidebar nav a').allTextContents();
  assert.ok(links.includes('Minha Fazenda') && links.includes('Rastreabilidade'));
  await page.waitForLoadState('networkidle');
  assert.ok(requests.some(r => r === '/producer-home'));
  assert.ok(!requests.some(r => /cooperative-home|institution-home/.test(r)));
  await page.screenshot({ path: out + 'produtor-1440.png' });
  await page.goto(base + '/remessas');
  await page.getByText('Esta área não faz parte do perfil ativo.').waitFor();
  return { links, guardRemessas: true };
});

await session('cooperativa', async (page, requests) => {
  await page.locator('.pb-home[data-audience="cooperative"]').waitFor();
  await page.waitForLoadState('networkidle');
  assert.deepEqual([...new Set(requests)], ['/cooperative-home']);
  const stats = await page.locator('.pb-stats > div span').allTextContents();
  const writeActions = await page.locator('[data-write-action]').count();
  const demo = await page.locator('.pb-demo').count();
  const overflow = await shots(page, 'cooperativa-home');
  await page.getByRole('link', { name: 'Remessas' }).click();
  await page.getByRole('heading', { name: 'Remessas', level: 1 }).waitFor();
  await page.locator('.pb-ops').waitFor();
  await page.screenshot({ path: out + 'cooperativa-remessas-1440.png', fullPage: true });
  for (const path of ['/producao', '/ofertas-disponiveis', '/minha-fazenda']) {
    await page.goto(base + path);
    await page.getByText('Esta área não faz parte do perfil ativo.').waitFor();
  }
  await page.screenshot({ path: out + 'cooperativa-area-bloqueada.png' });
  assert.ok(!requests.some(r => /producer-home|catalog|productions|institution-home|offers/.test(r)));
  return { stats, writeActions, demoNotice: demo > 0, overflow, requested: [...new Set(requests)] };
});

await session('instituicao', async (page, requests) => {
  await page.locator('.pb-home[data-audience="institution"]').waitFor();
  const stats = await page.locator('.pb-stats > div span').allTextContents();
  const overflow = await shots(page, 'instituicao-home');
  await page.getByRole('link', { name: 'Ofertas disponíveis' }).first().click();
  await page.getByRole('heading', { name: 'Ofertas disponíveis', level: 1 }).waitFor();
  await page.locator('.pb-offers, .empty-inline').first().waitFor();
  const offerCards = await page.locator('.pb-offers > li').count();
  const offerOverflow = await shots(page, 'instituicao-ofertas');
  await page.getByRole('link', { name: 'Solicitações' }).click();
  await page.getByRole('heading', { name: 'Solicitações', level: 1 }).waitFor();
  await page.locator('.pb-ops, .empty-inline').first().waitFor();
  await page.screenshot({ path: out + 'instituicao-solicitacoes-1440.png', fullPage: true });
  assert.ok(!requests.some(r => /producer-home|catalog|productions|cooperative-home/.test(r)));
  return { stats, offerCards, overflow, offerOverflow, requested: [...new Set(requests)] };
});

await session('multiplo', async (page, requests) => {
  const select = page.getByLabel('Organização ativa');
  const groups = await page.locator('select[aria-label="Organização ativa"] optgroup').evaluateAll(g => g.map(x => x.label + ':' + x.children.length));
  const options = await page.locator('select[aria-label="Organização ativa"] option').evaluateAll(o => o.map(x => ({ value: x.value, text: x.textContent })));
  const pick = text => options.find(o => o.text.startsWith(text)).value;
  const steps = [];
  // Produtor (LEITOR) → cooperativa (EDITOR) → instituição (LEITOR) → instituição vazia (ADMIN) → produtor.
  await page.waitForLoadState('networkidle');
  steps.push({ to: 'produtor', heading: await page.locator('h1').first().textContent() });
  await select.selectOption(pick('Cooperativa'));
  await page.locator('.pb-home[data-audience="cooperative"]').waitFor();
  assert.equal(await page.locator('.ov-hero').count(), 0, 'resíduo do produtor');
  assert.equal(await page.getByLabel('Propriedade').count(), 0);
  steps.push({ to: 'cooperativa', writeActions: await page.locator('[data-write-action]').count() });
  await page.screenshot({ path: out + 'multiplo-cooperativa-1440.png', fullPage: true });
  await select.selectOption(pick('Instituição —'));
  await page.locator('.pb-home[data-audience="institution"]').waitFor();
  assert.equal(await page.locator('.pb-home[data-audience="cooperative"]').count(), 0, 'resíduo da cooperativa');
  const readonly = await page.locator('.pb-readonly').count();
  steps.push({ to: 'instituicao-leitor', writeActions: await page.locator('[data-write-action]').count(), readonlyBadge: readonly > 0 });
  assert.equal(await page.locator('[data-write-action]').count(), 0);
  await page.screenshot({ path: out + 'multiplo-instituicao-leitor-1440.png', fullPage: true });
  await select.selectOption(pick('Instituição sem pedidos'));
  await page.getByText('Nenhuma solicitação enviada até agora.').waitFor();
  steps.push({ to: 'instituicao-vazia', empty: true });
  await page.screenshot({ path: out + 'estado-vazio-instituicao-1440.png', fullPage: true });
  // Página de outro perfil após troca: proteção de interface.
  await page.goto(base + '/remessas');
  await page.getByText('Esta área não faz parte do perfil ativo.').waitFor();
  await page.goto(base + '/visao-geral');
  await select.selectOption(pick('Produtor'));
  await page.locator('.ov-hero, .state-panel').first().waitFor();
  assert.equal(await page.locator('.pb-home').count(), 0, 'resíduo da instituição');
  steps.push({ to: 'produtor', propertySelector: await page.getByLabel('Propriedade').count() });
  await page.screenshot({ path: out + 'multiplo-produtor-leitor-1440.png' });
  return { groups, steps };
});

await session('leitor', async page => {
  await page.locator('.pb-home[data-audience="cooperative"]').waitFor();
  const writeActions = await page.locator('[data-write-action]').count();
  const readonlyChips = await page.locator('.pb-step[data-kind="readonly"]').count();
  assert.equal(writeActions, 0);
  await page.screenshot({ path: out + 'leitor-cooperativa-1440.png', fullPage: true });
  return { writeActions, readonlyChips };
});

// Erro: API indisponível para a home é exibido como erro, não como zero.
await session('cooperativa', async page => {
  await page.locator('.pb-home').waitFor();
  await page.route('**/api/agro/cooperative-home**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Não foi possível acessar o serviço. Tente novamente.' } }) }));
  await page.getByRole('button', { name: 'Atualizar dados' }).click();
  await page.getByText('Não foi possível carregar as informações.').waitFor();
  assert.equal(await page.locator('.pb-stats').count(), 0);
  await page.screenshot({ path: out + 'estado-erro-cooperativa-1440.png' });
  return { simulated: 'falha 503 interceptada no navegador (único caso simulado)', statsHidden: true };
});

await browser.close();
const report = { capturedAt: new Date().toISOString(), base, browser: 'Microsoft Edge headless (playwright-core)', results, pageErrors: errors };
await writeFile(out + 'captura-publicos.json', JSON.stringify(report, null, 2) + '\n');
for (const r of results) console.log(r.ok ? 'ok' : 'FALHA', r.name, r.error ?? '');
console.log('Erros de página:', errors.length);
process.exit(results.every(r => r.ok) && !errors.length ? 0 : 1);
