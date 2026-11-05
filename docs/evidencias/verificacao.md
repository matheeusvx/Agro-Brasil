# Verificação executada — 05/11/2026

## Resultados reais

| Verificação | Resultado |
|---|---|
| `npm.cmd test` | 6 testes unitários aprovados, zero falhas/ignorados |
| `npm.cmd run test:integration` | 13 casos HTTP/MongoDB aprovados; runner contabiliza 14 incluindo o teste agrupador; zero falhas/ignorados |
| `npm.cmd run check` | Sintaxe dos arquivos JavaScript aprovada |
| `npm.cmd run seed:demo` | Executado com MongoDB local real; quatro perfis e organizações fictícias, propriedade e culturas |
| `npm.cmd start` | API e web iniciadas em loopback: http://127.0.0.1:3000 |
| Navegador integrado | Formulário preenchido e enviado; produção DEMO 2026/2, Alface 12,5 kg, São Paulo/SP, colheita 05/11/2026; retorno exibiu lote e evento de origem; listagem, indicador total 1/distribuição e histórico conferidos |

Logs reais: `testes-unitarios.txt`, `testes-integracao.txt`, `sintaxe.txt`. Verificação HTTP somente leitura da produção de demonstração: `demonstracao.json`, gerado por `npm.cmd run verify:demo` depois de cadastrar via formulário. Nenhum desses artefatos contém token ou URI com credencial.

## O que a integração verificou

1. Acesso sem identidade retorna 401.
2. Um usuário pode consultar dois vínculos ativos distintos.
3. Organização sem vínculo retorna 403 e não grava produção.
4. Instituição não pode registrar produção de pequeno produtor rural.
5. Propriedade de outra organização não é aceita.
6. Massa inválida e paginação negativa são recusadas.
7. POST 201 grava produção, lote e origem no MongoDB.
8. Listagem, indicadores e consulta do lote retornam valores persistidos.
9. Outra organização não lê produção/lote por ID e recebe listagem vazia.
10. LEITOR não cria; revogação de vínculo corta acesso.
11. JSON inválido, corpo >16kb e rota inexistente tratados; web retorna 200.
12. API, cliente e **processo MongoDB** encerrados e reiniciados com mesmo diretório WiredTiger; registro permanece consultável.
13. Token expirado retorna 401.

Na primeira tentativa, o sandbox bloqueou o download do binário MongoDB com EACCES; a falha foi real e não foi omitida como teste aprovado. Após acesso autorizado ao domínio oficial, a execução passou. A última execução usa o binário em cache e gerou o log versionável acima.

## Limites da evidência

Foi exercitado somente o primeiro recorte vertical. Ofertas, pedidos, retirada, recebimento, QR e aplicativos analíticos não foram implementados nem testados. O evento de origem é confirmado por participante **fictício**, sem geolocalização independente. Não houve validação com usuários reais, mensuração de desperdício, vídeo pitch, publicação, atualização Trello ou entrega acadêmica final. A revisão visual ocorreu em navegador integrado; não equivale a auditoria completa de acessibilidade ou matriz de navegadores.

O teste de integração usa banco isolado; não modifica os dados de demonstração da página. Os registros persistidos localmente são artefatos fictícios, não dados reais de pequenos produtores rurais.

## Inventário

Todos os arquivos foram criados nesta execução; não havia código anterior. Raiz: README.md, .gitignore, .env.example, package.json, package-lock.json. Código: apps/web (3 arquivos); services/api (package.json, 5 módulos src, 2 testes); scripts (banco, seed, checagem, verificação demo). Documentos: arquitetura, modelo, auditoria, API, conformidade, planejamento, relatório e logs. Pastas Flutter/Python/Java contêm somente README de escopo.

Arquivos locais não versionáveis: .env, .data, .cache, node_modules e metadados .git. Não há commits ou remoto. Responsável informado: Matheus Morelli Rodrigues — RM 562765.
