import test from 'node:test';import assert from 'node:assert/strict';import {buildFlow,flowEvents,type TraceOrder,type FlowEvent} from '../src/lib/trace-flow';
const order:TraceOrder={id:'pedido-a',lotId:'lote',offerId:'oferta',status:'SOLICITADO',quantityKg:5,sellerOrganizationId:'org',createdAt:'2026-11-01'};
const event=(type:string,more:Partial<FlowEvent>={}):FlowEvent=>({id:type,type,recordedAt:'2026-11-01T12:00:00Z',lotId:'lote',...more});
test('isola pedidos e relaciona a publicação à oferta exata',()=>{const data=[event('ORIGEM_REGISTRADA'),event('OFERTA_PUBLICADA',{operationId:'oferta'}),event('OFERTA_PUBLICADA',{operationId:'outra'}),event('PEDIDO_SOLICITADO',{orderId:'pedido-a'}),event('RETIRADA_REGISTRADA',{orderId:'pedido-b'})];assert.equal(flowEvents(order,data).length,3);const flow=buildFlow(order,data);assert.equal(flow.nodes.filter(n=>n.future).length,3);assert.equal(flow.nodes.find(n=>n.key===flow.current)?.type,'PEDIDO_SOLICITADO');});
test('cancelamento encerra o fluxo, sem retirada ou recebimento futuros',()=>{const flow=buildFlow({...order,status:'CANCELADO'},[event('ORIGEM_REGISTRADA'),event('PEDIDO_CANCELADO',{orderId:order.id,recordedAt:'2026-11-02T12:00:00Z'})]);assert.equal(flow.nodes.length,2);assert.equal(flow.nodes.some(n=>n.future),false);});
test('status sozinho nunca cria etapas concluídas',()=>{const flow=buildFlow({...order,status:'RECEBIDO'},[event('ORIGEM_REGISTRADA')]);assert.equal(flow.nodes.filter(n=>!n.future).length,1);});
test('cooperativa/instituição: etapa não compartilhada aparece concluída, sem data inventada',()=>{
  const data=[event('ORIGEM_REGISTRADA'),event('PEDIDO_SOLICITADO',{orderId:'pedido-a'}),event('PEDIDO_ACEITO',{orderId:'pedido-a',recordedAt:'2026-11-02T12:00:00Z'})];
  const flow=buildFlow({...order,status:'ACEITO'},data,{fillWithheld:true});
  assert.deepEqual(flow.nodes.map(n=>n.type),['ORIGEM_REGISTRADA','OFERTA_PUBLICADA','PEDIDO_SOLICITADO','PEDIDO_ACEITO','RETIRADA_REGISTRADA','RECEBIMENTO_CONFIRMADO']);
  const offer=flow.nodes[1];assert.equal(offer.withheld,true);assert.equal(offer.event,undefined);assert.equal(offer.future,false);
  assert.equal(flow.nodes.find(n=>n.key===flow.current)?.type,'PEDIDO_ACEITO');
  assert.equal(flow.nodes.filter(n=>n.future).length,2);
  // Sem a opção, o produtor mantém exatamente o comportamento anterior.
  assert.equal(buildFlow({...order,status:'ACEITO'},data).nodes.some(n=>n.withheld),false);
});
test('cancelado após aceite: sem etapas futuras e cancelamento por último',()=>{
  const data=[event('ORIGEM_REGISTRADA'),event('PEDIDO_SOLICITADO',{orderId:'pedido-a'}),event('PEDIDO_CANCELADO',{orderId:'pedido-a',recordedAt:'2026-11-03T12:00:00Z'})];
  const flow=buildFlow({...order,status:'CANCELADO'},data,{fillWithheld:true});
  assert.equal(flow.nodes.at(-1)?.type,'PEDIDO_CANCELADO');assert.equal(flow.nodes.some(n=>n.future),false);
});
