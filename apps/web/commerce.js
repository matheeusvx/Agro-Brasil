/* Formulários mínimos; tokens e chaves de repetição ficam somente na memória. */
const pendingCommands = new Map();
function operationLocation() {
  const municipality = $('#operation-city').value.trim(); const uf = $('#operation-uf').value.trim().toUpperCase();
  const locationConfirmed = $('#operation-confirmed').checked;
  if (!municipality || !uf || !locationConfirmed) throw new Error('Preencha e confirme o local da operação antes de continuar.');
  return { location: { municipality, uf }, locationConfirmed };
}
async function mutateCommerce(endpoint, body) {
  const scope = JSON.stringify([token, $('#organization').value, endpoint, body]);
  const key = pendingCommands.get(scope) || crypto.randomUUID(); pendingCommands.set(scope, key);
  try {
    const result = await api(endpoint, { method: 'POST', body: JSON.stringify(body), headers: { 'Idempotency-Key': key } });
    pendingCommands.delete(scope); return result;
  } catch (error) {
    // Resposta definitiva permite corrigir e reenviar; erro de rede mantém a chave.
    if (error.status && error.status < 500) pendingCommands.delete(scope);
    throw error;
  }
}
function actionButton(label, callback) {
  const button = node('button', label, 'secondary'); button.type = 'button';
  button.addEventListener('click', async () => {
    const current = generation; button.disabled = true;
    try { await callback(); if (current !== generation) return; await refresh(); message('Operação registrada. Consulte o histórico atualizado do lote.'); }
    catch (error) { if (current === generation) message(error.message, 'error'); }
    finally { button.disabled = false; }
  });
  return button;
}
async function refreshCommerce(current, productions) {
  const membership = memberships.find(m => m.organizationId === $('#organization').value);
  const producer = membership.type === 'PEQUENO_PRODUTOR_RURAL'; const writer = ['ADMIN', 'EDITOR'].includes(membership.role);
  const [offers, orders, cooperatives] = await Promise.all([api(producer ? '/offers?scope=mine' : '/offers'), api('/orders'), api('/cooperatives')]);
  if (current !== generation) return;
  $('#offer-section').hidden = !producer || !writer;
  const usedLots = new Set(offers.data.map(o => o.lotId));
  options($('#offer-lot'), productions.filter(p => !usedLots.has(p.lot.id)).map(p => ({ id: p.lot.id, name: `${p.cropName} · ${p.quantityKg} kg · ${p.lot.id}` })));
  $('#offer-form button').disabled = !$('#offer-lot').options.length;
  $('#offers-info').textContent = `Exibindo ${offers.data.length} de ${offers.pagination.total} ofertas${producer ? ' próprias (inclui rascunhos)' : ' publicadas com saldo'}. Dados fictícios.`;
  $('#offers').replaceChildren();
  for (const offer of offers.data) {
    const li = document.createElement('li');
    li.append(node('h3', `${offer.cropName} · ${offer.availableKg} kg disponíveis · ${offer.status}`), node('p', `${offer.sellerName} · ${offer.territory.municipality}/${offer.territory.uf} · ${offer.destinationMode} · ${(offer.unitPriceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/kg`), node('p', `Oferta ${offer.id}`, 'identifier'));
    if (writer && producer && offer.status === 'RASCUNHO') li.append(actionButton('Publicar oferta', () => mutateCommerce(`/offers/${offer.id}/publish`, operationLocation())));
    if (writer && ['INSTITUICAO', 'COMPRADOR_LOCAL'].includes(membership.type)) {
      const label = node('label', 'Quantidade solicitada (kg)'); const amount = document.createElement('input'); amount.type = 'number'; amount.min = '.001'; amount.step = '.001'; amount.max = offer.availableKg; label.append(amount); li.append(label);
      li.append(actionButton('Solicitar excedente', () => mutateCommerce('/orders', { offerId: offer.id, quantityKg: Number(amount.value), ...operationLocation() })));
    }
    $('#offers').append(li);
  }
  if (!offers.data.length) $('#offers').append(node('li', 'Nenhuma oferta disponível nesta visão.'));
  $('#orders').replaceChildren();
  for (const order of orders.data) {
    const li = document.createElement('li');
    li.append(node('h3', `${order.quantityKg} kg · ${order.status}`), node('p', `Pedido ${order.id} · Lote ${order.lotId}`, 'identifier'));
    if (order.shipment) li.append(node('p', `Remessa ${order.shipment.status} · ${order.shipment.carrierOrganizationId ? `cooperativa ${order.shipment.carrierOrganizationId}` : 'operação direta, sem cooperativa'}`));
    const isSeller = membership.organizationId === order.sellerOrganizationId; const isBuyer = membership.organizationId === order.requesterOrganizationId;
    if (writer && isSeller && order.status === 'SOLICITADO') {
      const label = node('label', 'Cooperativa autorizada (opcional)'); const select = document.createElement('select');
      options(select, [{ id: '', name: 'Operação direta — sem cooperativa' }, ...cooperatives.data]); label.append(select); li.append(label);
      li.append(actionButton('Aceitar pedido e reservar', () => mutateCommerce(`/orders/${order.id}/accept`, { ...operationLocation(), ...(select.value ? { cooperativeOrganizationId: select.value } : {}) })));
    }
    if (writer && (isSeller || isBuyer) && ['SOLICITADO', 'ACEITO'].includes(order.status)) li.append(actionButton('Cancelar pedido', () => mutateCommerce(`/orders/${order.id}/cancel`, operationLocation())));
    if (writer && order.status === 'ACEITO' && (isSeller || order.shipment?.carrierOrganizationId === membership.organizationId)) li.append(actionButton('Registrar retirada', () => mutateCommerce(`/shipments/${order.shipment.id}/pickup`, operationLocation())));
    if (writer && isBuyer && order.status === 'RETIRADO') li.append(actionButton('Confirmar recebimento integral', () => mutateCommerce(`/shipments/${order.shipment.id}/receipts`, { quantityAcceptedKg: order.quantityKg, ...operationLocation() })));
    if (order.shipment) {
      const history = node('button', 'Consultar histórico autorizado', 'secondary'); history.type = 'button'; history.addEventListener('click', () => showLot(order.lotId)); li.append(history);
    }
    $('#orders').append(li);
  }
  if (!orders.data.length) $('#orders').append(node('li', 'Nenhum pedido autorizado nesta organização.'));
}
$('#offer-form').addEventListener('submit', async event => {
  event.preventDefault(); const current = generation; const button = $('#offer-form button'); button.disabled = true;
  try {
    const elements = event.target.elements; const until = new Date(elements.availableUntil.value);
    if (!Number.isFinite(until.getTime())) throw new Error('Informe a validade da oferta.');
    await mutateCommerce('/offers', { lotId: $('#offer-lot').value, quantityKg: Number(elements.quantityKg.value), destinationMode: elements.destinationMode.value, unitPriceCents: Number(elements.unitPriceCents.value), availableUntil: until.toISOString() });
    if (current !== generation) return; event.target.reset(); await refresh(); message('Rascunho criado. Confirme o local e publique a oferta.');
  } catch (error) { if (current === generation) message(error.message, 'error'); }
  finally { button.disabled = !$('#offer-lot').options.length; }
});
$('#logout').addEventListener('click', () => pendingCommands.clear());
