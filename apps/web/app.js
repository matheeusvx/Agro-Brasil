/* A identidade é apenas de demonstração. Nenhum token é salvo no navegador. */
const $ = selector => document.querySelector(selector);
let token = '';
let memberships = [];
let generation = 0;
const form = $('#production-form');
function message(text, kind = 'success') { $('#message').textContent = text; $('#message').dataset.kind = kind; }
function node(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; }
async function api(path, options = {}, organizationId = $('#organization').value) {
  const response = await fetch(`/api/v1${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'X-Organization-Id': organizationId, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.error?.message || 'Não foi possível carregar os dados.'); error.status = response.status; throw error; }
  return body;
}
function options(select, items) { select.replaceChildren(...items.map(item => { const option = node('option', item.name); option.value = item.id; return option; })); }
async function refresh() {
  const current = ++generation;
  const organizationId = $('#organization').value;
  $('#workspace').hidden = true;
  $('#history-section').hidden = true;
  message('Carregando dados da organização…');
  try {
    const [catalog, productions, indicators] = await Promise.all([api('/catalog', {}, organizationId), api('/productions', {}, organizationId), api('/productions/indicators', {}, organizationId)]);
    if (current !== generation) return;
    options(form.elements.propertyId, catalog.properties); options(form.elements.cropId, catalog.crops);
    const membership = memberships.find(m => m.organizationId === organizationId);
    $('#producer-section').hidden = membership.type !== 'PEQUENO_PRODUTOR_RURAL' || !['ADMIN', 'EDITOR'].includes(membership.role);
    $('#total').textContent = indicators.total;
    $('#distribution').replaceChildren(...indicators.distribution.map(row => node('li', `${row.cropName}: ${row.count} registro(s) · ${row.quantityKg.toLocaleString('pt-BR')} kg`)));
    if (!indicators.distribution.length) $('#distribution').append(node('li', 'Sem registros nesta organização.'));
    $('#productions').replaceChildren();
    for (const production of productions.data) {
      const li = document.createElement('li');
      li.append(node('h3', `${production.cropName} · ${production.quantityKg.toLocaleString('pt-BR')} kg`), node('p', `Safra ${production.seasonLabel} · Colheita ${production.harvestedOn} · DEMONSTRAÇÃO`), node('p', `Lote: ${production.lot.id}`, 'identifier'));
      const button = node('button', 'Consultar origem do lote', 'secondary'); button.type = 'button';
      button.addEventListener('click', () => showLot(production.lot.id)); li.append(button); $('#productions').append(li);
    }
    $('#list-info').textContent = productions.pagination.total ? `Exibindo ${productions.data.length} de ${productions.pagination.total} registros (até 50 nesta tela).` : 'Nenhuma produção registrada nesta organização.';
    await refreshCommerce(current, productions.data);
    if (current !== generation) return;
    $('#workspace').hidden = false; message('Dados carregados. Registros persistidos no MongoDB.');
  } catch (error) { if (current === generation) message(error.message, 'error'); }
}
async function showLot(id) {
  const current = generation;
  try {
    const { data, pagination } = await api(`/lots/${id}/events?limit=100`);
    if (current !== generation) return;
    $('#lot-id').textContent = id;
    $('#history-info').textContent = `Exibindo ${data.length} de ${pagination.total} eventos autorizados (até 100 nesta tela).`;
    $('#history').replaceChildren(...data.map(event => node('li', `${event.type} · ${new Date(event.occurredAt).toLocaleString('pt-BR')} · ${event.location.municipality}/${event.location.uf} · organização responsável: ${event.responsibleOrganizationId} · localização confirmada pelo participante. DEMONSTRAÇÃO.`)));
    $('#history-section').hidden = false; $('#history-section').scrollIntoView({ behavior: 'smooth' });
  } catch (error) { if (current === generation) message(error.message, 'error'); }
}
$('#session-form').addEventListener('submit', async event => {
  event.preventDefault();
  generation++; $('#workspace').hidden = true; $('#organization-box').hidden = true; memberships = [];
  token = $('#token').value.trim(); $('#token').value = '';
  try {
    const session = await api('/me'); memberships = session.memberships;
    if (!memberships.length) throw new Error('Nenhuma organização ativa autorizada.');
    options($('#organization'), memberships.map(m => ({ id: m.organizationId, name: `${m.name} · ${m.role}` })));
    $('#organization-box').hidden = false; await refresh();
  } catch (error) { token = ''; message(error.message, 'error'); }
});
$('#organization').addEventListener('change', refresh);
$('#refresh').addEventListener('click', refresh);
$('#logout').addEventListener('click', () => { generation++; token = ''; memberships = []; $('#organization').replaceChildren(); $('#workspace').hidden = true; $('#organization-box').hidden = true; message('Sessão encerrada.'); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button[type=submit]'); button.disabled = true;
  const fields = form.elements;
  const current = generation;
  const organizationId = $('#organization').value;
  const body = { propertyId: fields.propertyId.value, cropId: fields.cropId.value, seasonLabel: fields.seasonLabel.value, quantityKg: Number(fields.quantityKg.value), harvestedOn: fields.harvestedOn.value, location: { municipality: fields.municipality.value, uf: fields.uf.value }, locationConfirmed: fields.locationConfirmed.checked };
  try {
    message('Salvando produção e origem do lote…');
    const result = await api('/productions', { method: 'POST', body: JSON.stringify(body) }, organizationId);
    if (current !== generation) return;
    form.reset(); await refresh(); message(`Produção salva. Lote ${result.data.lot.id} criado com evento de origem.`);
  } catch (error) { if (current === generation) message(error.message, 'error'); }
  finally { button.disabled = false; }
});
for (const uf of 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')) { const option = node('option', uf); option.value = uf; form.elements.uf.append(option); }
form.elements.harvestedOn.max = new Date().toISOString().slice(0, 10);
