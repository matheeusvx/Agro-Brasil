from pathlib import Path
s=Path('scripts/smoke-mobile.mjs').read_text(encoding='utf-8')
s=s.replace("import { weatherProvider }", "import { productionDocument } from '../services/api/src/domain.mjs';\nimport { weatherProvider }")
mark="    server = createApp(db,{demoAuthEnabled:true"
i=s.index(mark)
seed='''    const mainProperty = (await db.collection('properties').findOne({organizationId}))._id;
    const secondProperty = randomUUID();
    await db.collection('properties').insertOne({_id:secondProperty,organizationId,name:'Outra propriedade vazia',municipality:'Suzano',uf:'SP',status:'ATIVA',isDemonstration:true});
    const context = {organizationId,userId,isDemonstration:true};
    const crops = [{_id:randomUUID(),name:'Alface',status:'ATIVA'},{_id:randomUUID(),name:'Tomate',status:'ATIVA'}];
    await db.collection('crops').insertMany(crops);
    const productions = Array.from({length:205},(_,i)=>productionDocument({propertyId:mainProperty,cropId:crops[i%2]._id,seasonLabel:'Primavera 2026',quantityKg:1,harvestedOn:'2026-10-01',location:{municipality:'São Paulo',uf:'SP'}},context,crops[i%2]));
    await db.collection('productions').insertMany(productions);
    const until = new Date(Date.now()+2*86400000).toISOString();
    const offers = productions.slice(0,4).map((p,i)=>({_id:randomUUID(),lotId:p.lot.id,sellerOrganizationId:organizationId,sellerName:'Produtor fictício',cropName:p.cropName,territory:p.location,quantityGrams:1000,availableGrams:i===0?600:i===1?200:1000,reservedGrams:i===0?400:0,dispatchedGrams:0,receivedGrams:i===1?800:0,destinationMode:i===1?'DOACAO':'VENDA',status:i===2?'RASCUNHO':'PUBLICADA',availableUntil:i===3?'2000-01-01T00:00:00Z':until,createdAt:new Date().toISOString(),isDemonstration:true}));
    await db.collection('offers').insertMany(offers);
    await db.collection('orders').insertMany([{_id:randomUUID(),offerId:offers[0]._id,lotId:offers[0].lotId,sellerOrganizationId:organizationId,requesterOrganizationId:randomUUID(),status:'ACEITO',quantityGrams:400,createdAt:new Date().toISOString(),isDemonstration:true},{_id:randomUUID(),offerId:offers[1]._id,lotId:offers[1].lotId,sellerOrganizationId:organizationId,requesterOrganizationId:randomUUID(),status:'SOLICITADO',quantityGrams:100,createdAt:new Date().toISOString(),isDemonstration:true}]);
'''
s=s[:i]+seed+s[i:]
mark="  // Reload com o mesmo perfil";i=s.index(mark)
checks='''  await page.getByRole('button',{name:/^Produção/}).or(page.getByRole('tab',{name:/^Produção/})).first().click();
  await page.getByRole('button',{name:'Produção e excedentes',exact:true}).click();
  await page.getByText('205 kg',{exact:false}).first().waitFor();
  await page.screenshot({path:resolve(directory,'production-main.png')});
  await page.mouse.wheel(0,600);
  await page.getByText('Venda: 0,600 kg',{exact:false}).first().waitFor();
  await page.getByText('Doação: 0,200 kg',{exact:false}).first().waitFor();
  await page.screenshot({path:resolve(directory,'production-balances.png')});
  assert.equal(responses.some(r=>r.url.includes('/productions?') && r.url.includes('offset=200')),true,'Todas as páginas consultadas');
'''
s=s[:i]+checks+s[i:]
s=s.replace('waterDashboardVerified:true,','waterDashboardVerified:true,productionDashboardVerified:true,expectedProductionKg:205,expectedSaleKg:0.6,expectedDonationKg:0.2,')
s=s.replace('Smoke aprovado: autenticação, home, painel hídrico real, clima desabilitado, reload, fontes e WebAssembly locais.','Smoke produção aprovado: API real, 205 registros paginados, 0,600 kg venda, 0,200 kg doação, painel hídrico e autenticação preservados.')
Path('scripts/smoke-production.mjs').write_text(s,encoding='utf-8')
