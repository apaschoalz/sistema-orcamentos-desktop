# Memória Persistente do Sistema (AI Context & Rules)

> **ATENÇÃO IA:** Leia este documento inteiramente antes de realizar qualquer modificação no código, planejar arquitetura ou corrigir bugs neste projeto. Este documento contém o contexto arquitetural, regras inquebráveis e aprendizados de sessões anteriores.

## 1. Visão Geral e Stack Tecnológico
- **Aplicação:** Sistema Desktop para gerenciamento de Orçamentos, Vendas, Clientes e Custos para loja de Cortinas/Persianas (Entre Tramas).
- **Stack:** 
  - **Frontend:** React (SPA)
  - **Backend/Desktop:** Electron (Node.js)
  - **Banco de Dados Local (Primary):** SQLite (`better-sqlite3`) - Local-First.
  - **Banco de Dados Nuvem (Sync):** Supabase (PostgreSQL) com Realtime.
  - **Deploy & Update:** `electron-builder` com `electron-updater` (via GitHub Releases).

## 2. Arquitetura de Sincronização (CRÍTICO)
O sistema funciona na arquitetura **Local-First**.
1. Toda ação de criação/atualização (Ex: `createVenda`) é feita **primeiro** no SQLite (`electron/database.js`).
2. Imediatamente após o sucesso local, o objeto limpo é enviado para a fila de sincronização chamando `syncService.pushData(table, data, operation)`.
3. O Supabase funciona primariamente como um espelho de replicação. O sistema assina os eventos Realtime do Supabase e aplica localmente (`upsertLocal` ou `deleteLocal`) tudo que foi gerado por outros terminais.

### ⚠️ Regras de Ouro de Banco de Dados e Sync
- **Limpeza de Schema (Virtual Fields):** Nunca envie variáveis de estado do Frontend (ex: `subtotal`, `cliente_nome`) para o `pushData` do Supabase. O Supabase é rígido e falhará silenciosamente com erro de schema, quebrando o sync. **Solução padrão:** Após o `INSERT/UPDATE` no SQLite, faça um `getById(id)` para obter a linha limpa e oficial do banco local antes de enviar para a nuvem.
- **Evite Race Conditions (DELETE vs UPSERT):** Ao atualizar arrays de dados filhos (como `itens_orcamento`), **NUNCA** delete todos os itens locais e os recrie. Isso gera comandos de `DELETE` e `INSERT` que podem se inverter na rede devido à latência, apagando os dados na nuvem permanentemente. Use sempre a lógica de filtro: delete apenas o que foi removido e faça `UPSERT` no que foi mantido/adicionado.
- **Resolução de Conflito de IDs Sequenciais:** O sistema possui terminais offline. Se dois terminais criarem a venda `V-2024-0001` e ficarem online, o Supabase acusará erro `23505` (Unique Constraint) no segundo que enviar. O `supabase-sync.js` está programado para capturar esse erro, buscar o próximo número válido remotamente, atualizar o SQLite local e reenviar, sem perder os dados.

## 3. Regras de Design e UI (Inquebráveis)
- **Zero Emojis:** É TERMINANTEMENTE PROIBIDO o uso de emojis em qualquer parte do projeto (UI, alertas, logs, botões, relatórios PDF, documentação). Use estritamente ícones vetoriais (ex: FontAwesome `fas fa-icon`) se necessário.
- **Estética Profissional:** O design deve manter uma estética "Premium", utilizando animações sutis, cores harmoniosas (sem cores primárias gritantes) e tipografia moderna. O sistema não pode parecer um "MVP simples".

## 4. Deploy e Auto-Update
- A distribuição é feita pelo GitHub Releases usando o `electron-updater`.
- Para compilar uma nova versão e disponibilizar o update automático para todos os terminais, o comando oficial é:
  ```bash
  npm run build:win -- --publish always
  ```
- **Requisito:** É obrigatório possuir a variável de ambiente `GH_TOKEN` no sistema (User Environment Variable) contendo um token Classic do GitHub com escopo `repo`. O arquivo de configuração `package.json` possui a tag `publish` devidamente mapeada.
- O versionamento (`version` no `package.json`) dita a atualização. Sempre aumente a versão antes do build.

## 5. Estrutura Chave
- `electron/main.js`: Ponto de entrada. Controla janelas, AutoUpdater, Logs (redireciona console para `app-debug.log`) e endpoints IPC (`ipcMain.handle`).
- `electron/database.js`: Interações exclusivas com SQLite. Scripts DDL (criação de tabelas) e métodos de CRUD.
- `electron/supabase-sync.js`: Lógica de push/pull com Supabase e fila offline (`pending_sync`).
- `src/pages/*`: Telas em React. Comunicam-se com o backend estritamente via `window.electronAPI`.

## 6. Como agir como IA neste repositório
1. **Analise:** Sempre verifique o `database.js` e o `supabase-sync.js` ao criar uma nova entidade ou coluna. A coluna precisa existir no SQLite *e* no Supabase.
2. **Planeje:** Pense no comportamento Offline. Se o terminal estiver sem rede, a operação vai ser salva no `pending_sync`? Sim, o `pushData` faz isso automaticamente.
3. **Corrija:** Em caso de bugs de perda de dados, investigue imediatamente logs de Realtime (`handleIncomingChange`) ou Race Conditions.
4. **Execute:** Mantenha métodos atômicos e evite cascateamento assíncrono complexo fora do contexto do Electron `main` thread. Mantenha os erros verbosos usando `console.error` pois eles são salvos em arquivo de log.
