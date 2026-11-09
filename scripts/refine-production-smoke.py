from pathlib import Path
p=Path('scripts/smoke-production.mjs');s=p.read_text(encoding='utf-8');s=s.replace("  await page.getByText('Venda: 0,600 kg',{exact:false}).first().waitFor();\n  await page.getByText('Doação: 0,200 kg',{exact:false}).first().waitFor();", "  await page.getByRole('group',{name:/^Suas ofertas Venda: 0,6 kg Doação: 0,2 kg/}).first().waitFor();")
mark="  assert.equal(responses.some(r=>r.url.includes('/productions?')"
i=s.index(mark);checks="""  await page.mouse.wheel(0,-1800);
  await page.getByRole('button',{name:/^Propriedade /}).click();
  await page.getByText('Outra propriedade vazia',{exact:false}).last().click();
  await page.getByText('0 kg',{exact:false}).first().waitFor();
  await page.screenshot({path:resolve(directory,'production-empty-property.png')});
""";s=s[:i]+checks+s[i:];p.write_text(s,encoding='utf-8')
