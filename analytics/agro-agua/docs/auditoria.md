# Auditoria AGUA-01 — 06/11/2026

O monorepositório contém portal Next.js em `apps/portal`, API Express/MongoDB em `services/api`, Flutter em `apps/mobile` e módulo Java independente. O diretório `analytics/agro-agua` continha apenas README de planejamento, sem coletor, dados, testes, lock de dependências ou modelos. Não foram encontrados AGENTS.md aplicáveis na raiz ou no módulo.

Um `.venv` já existia no módulo ao iniciar a auditoria. Foi reutilizado: CPython 3.13.7, requests 2.34.2, pandas 3.1.1, numpy 2.5.4, matplotlib 3.11.2 e pytest 9.2.0. As versões efetivas, inclusive transitivas, foram registradas em requirements.txt. Não houve instalação global nem mudança no Node/Flutter/backend. O processo Python precisou de execução fora da restrição de sandbox para acessar o interpretador instalado; a execução foi autorizada pela ferramenta.

O Git já apresentava modificações em `apps/portal/src/app/globals.css`, `apps/portal/src/components/productions.tsx` e imagens/JSON de `docs/design/portal/evidencias`. Essas alterações pertencem ao estado anterior e foram preservadas. Todo arquivo criado/modificado por AGUA-01 está em `analytics/agro-agua/`. Nenhum commit, push, alteração de índice, backend, Flutter ou portal.

O `.gitignore` da raiz já excluía `.venv` e `__pycache__`. Foi acrescentado `.gitignore` apenas no módulo para pytest e arquivos temporários. Dados reais originais e derivados são parte auditável da entrega, não cache descartável de desenvolvimento. Pesquisas sobre INMET/SP Águas ficaram separadas da base principal.

O limite de cinco horas foi tratado como teto de execução; não como necessidade de ocupar todo o período. Nenhum treinamento, dashboard ou dado meteorológico fictício foi criado. Os testes de erro alteram cópias de respostas reais apenas em memória/diretórios temporários do pytest.
