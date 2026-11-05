# Agro+ Brasil — portal de gestão

Primeiro incremento independente do Flutter: central operacional do pequeno produtor, gestão de Produção e consulta de origem. Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Radix, Lucide e Recharts. Não exige mudanças no Express/MongoDB.

## Executar localmente

Requisito: Node.js 22.19 ou superior. Na raiz do monorepositório, iniciar o MongoDB e a API conforme o README existente. O portal usa a API local na porta 3000 e os tokens demonstrativos já emitidos pelo backend; não cria credenciais ou participantes automaticamente.

Em outro terminal PowerShell:

```powershell
cd apps/portal
npm ci
$env:PORTAL_DEMO_ENABLED = 'true'
$env:AGRO_API_URL = 'http://127.0.0.1:3000'
npm run dev
```

Abrir **http://127.0.0.1:3100**. Informar um token demonstrativo válido de pequeno produtor. A organização e a propriedade podem ser trocadas no cabeçalho, conforme os vínculos autorizados. A configuração pode ser guardada em `.env.local`, a partir de `.env.example`, sem incluir tokens.

Para verificar e executar o build:

```powershell
npm run typecheck
npm test
npm run build
npm start
```

`dev` e `start` escutam somente em 127.0.0.1. O adaptador demonstrativo fica desativado sem `PORTAL_DEMO_ENABLED=true`. Tokens ficam na memória do servidor; o navegador recebe somente um identificador de sessão HttpOnly. Reiniciar o servidor encerra as sessões. Esta configuração local não deve ser publicada como autenticação de produção.

## Validação de ponta a ponta

Na raiz, depois de instalar as dependências da raiz e do portal e gerar o build:

```powershell
node scripts/smoke-portal.mjs
```

O roteiro usa Microsoft Edge instalado no caminho padrão do Windows, MongoDB Memory Server e o Express real. Cria um banco isolado e efêmero de teste, sem ler `.env`, tokens existentes ou base operacional. A primeira execução pode precisar baixar o binário MongoDB. Não aceita `--existing`.

Inclui home em três resoluções, sidebar, gráficos/tooltips, tabela, filtros, paginação, seleção e CSV, drawer/eventos, cadastro persistido, falha/recuperação, troca de contexto, LEITOR, acesso cruzado e logout. Quatro auditorias axe são critérios de falha do roteiro. Falhas de rede são introduzidas somente para testar o estado de erro; os dados operacionais não são interceptados ou simulados.

Relatórios e screenshots: `docs/design/portal/`. Decisões e contratos: `arquitetura.md`; identidade: `design-system.md`; entrega: `resultado.md`; comparação: `revisao-visual.html`.

## Limites do incremento

- Espaço funcional do pequeno produtor; os demais públicos precisam de fluxos próprios.
- Ofertas possui listagem, criação e publicação em `/ofertas`; [contratos, motion e evidências](../../docs/design/portal/ofertas.md). Pedidos e Rastreabilidade completos são próximos incrementos. A home permite consulta do pedido prioritário e Produção mostra os eventos do lote.
- Sem edição de produção: o contrato existente oferece criação e consulta.
- Gráficos agregam os registros autorizados da propriedade, sem inventar séries históricas, finanças ou impacto.
- Clima depende da configuração existente no backend. Ausência não é substituída por dados fictícios.
- Até 10 mil registros por consulta paginada. Acima disso, erro explícito; agregação no servidor pode ser proposta futuramente.

Fontes e assets locais mantêm os respectivos avisos de licença em `public/`. Referências visuais não são distribuídas como assets do portal. Não há dependência da stack de demonstração stageshow.

Para testar Ofertas em banco isolado, depois do build: `node scripts/smoke-portal.mjs --offers` na raiz. Inclui perda de resposta e replay de criação/publicação, permissões, validações, paginação, filtros, acessibilidade e redução de movimento.
