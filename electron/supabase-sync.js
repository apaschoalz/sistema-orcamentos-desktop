// Serviço de Sincronização com Supabase
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

// Polyfill para WebSocket no Node.js (necessário para o Realtime do Supabase no processo Main do Electron)
if (typeof global.WebSocket === 'undefined') {
    global.WebSocket = WebSocket;
}

class SupabaseSync {
    constructor(database) {
        this.db = database;
        this.supabase = null;
        this.isConfigured = false;
        this.mainWindow = null;
    }

    setMainWindow(win) {
        this.mainWindow = win;
    }

    emitSyncEvent(info) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('sync:dataChanged', info);
        }
    }

    async initialize() {
        const url = this.db.getConfig('supabase.url');
        const key = this.db.getConfig('supabase.anon_key');

        if (url && key) {
            this.supabase = createClient(url, key);
            this.isConfigured = true;
            console.log('Supabase configurado com sucesso');

            // Iniciar Realtime
            this.initializeRealtime();

            return true;
        }

        this.isConfigured = false;
        console.log('Supabase não configurado');
        return false;
    }

    initializeRealtime() {
        if (!this.checkConnection()) return;

        console.log('Iniciando escuta Realtime...');

        // Escutar insert/update/delete em todas as tabelas relevantes
        const tables = ['clientes', 'orcamentos', 'itens_orcamento', 'vendas', 'fornecedores', 'custos'];

        // Remover canais anteriores se houver (para evitar duplicidade no re-init)
        if (this.realtimeChannel) {
            this.supabase.removeChannel(this.realtimeChannel);
        }

        this.realtimeChannel = this.supabase
            .channel('public-db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public' },
                (payload) => {
                    this.handleIncomingChange(payload);
                }
            )
            .subscribe((status) => {
                console.log('Supabase Realtime status:', status);
            });
    }

    handleIncomingChange(payload) {
        console.log('[Sync] Recebido evento externo:', payload.eventType, payload.table);

        // Ignorar alterações enviadas por mim mesmo?
        // O Supabase não manda "meu client_id", mas podemos comparar o timestamp ou verificar se o dado local já é igual.
        // Estratégia simples: Sempre atualizar local se o 'updated_at' externo for mais novo que o local. (Last Write Wins)
        // Para INSERT, apenas insere se não existir.

        const { eventType, table, new: newRecord, old: oldRecord } = payload;

        try {
            // Converter undefined para null para evitar erros no SQLite local
            const cleanRecord = newRecord ? Object.fromEntries(Object.entries(newRecord).map(([k, v]) => [k, v === undefined ? null : v])) : null;
            
            if (eventType === 'INSERT') {
                this.upsertLocal(table, cleanRecord);
            } else if (eventType === 'UPDATE') {
                this.upsertLocal(table, cleanRecord);
            } else if (eventType === 'DELETE') {
                this.deleteLocal(table, oldRecord.id);
            }
        } catch (error) {
            console.error('[Sync] Erro ao processar mudança externa:', error);
        }
    }

    upsertLocal(table, record) {
        // Mapear tabela do Supabase para métodos do DB local
        // Nota: record vem com todas colunas. Precisamos adaptar se houver diferenças.
        // O SQLite local tem estruturas compatíveis (criadas via SQL igual).

        console.log(`[Sync] Aplicando ${table} localmente:`, record.id);

        // Prevenir loop infinito:
        // Se eu acabei de salvar isso localmente, o DB emite evento de salvar, que emite Push.
        // Se eu recebo do Realtime, salvo local. Isso dispararia Push de novo?
        // Sim! Precisamos de um flag "isSyncing" para não disparar Push quando for alteração vinda da Nuvem.

        this.db.setSyncing(true); // Bloqueia Push temporariamente nesta thread

        try {
            if (table === 'clientes') {
                // Verificar se existe para decidir se é create ou update (embora 'INSERT OR REPLACE' fosse ideal)
                const exists = this.db.getClienteById(record.id);
                if (exists) {
                    this.db.updateCliente(record.id, record);
                } else {
                    this.db.createCliente(record);
                }
            } else if (table === 'orcamentos') {
                const exists = this.db.getOrcamentoById(record.id);
                if (exists) {
                    this.db.updateOrcamento(record.id, record);
                } else {
                    this.db.createOrcamento(record);
                }
            } else if (table === 'vendas') {
                const exists = this.db.getVendaById(record.id);
                if (exists) {
                    this.db.updateVenda(record.id, record);
                } else {
                    this.db.createVenda(record);
                }
            } else if (table === 'itens_orcamento') {
                // Itens é chato. Geralmente deletamos tudo e recriamos ao salvar orçamento.
                // Mas aqui vem um item por vez ou update.
                // Melhor estratégia: Inserir/Update direto via SQL cru para ser genérico?
                // Vou fazer um método específico no DB para upsertItem
                this.db.upsertItemOrcamento(record);
            } else if (table === 'fornecedores') {
                const exists = this.db.getFornecedorById(record.id);
                if (exists) {
                    this.db.updateFornecedor(record.id, record);
                } else {
                    this.db.createFornecedor(record);
                }
            } else if (table === 'custos') {
                const exists = this.db.getCustoById(record.id);
                if (exists) {
                    this.db.updateCusto(record.id, record);
                } else {
                    this.db.createCusto(record);
                }
            }
        } catch (e) {
            console.error(`[Sync] Erro ao aplicar ${table}:`, e);
        } finally {
            this.db.setSyncing(false);
            this.emitSyncEvent({ type: 'upsert', table, id: record.id });
        }
    }

    deleteLocal(table, id) {
        console.log(`[Sync] Deletando ${table} localmente:`, id);
        this.db.setSyncing(true);
        try {
            if (table === 'clientes') this.db.deleteCliente(id);
            else if (table === 'orcamentos') this.db.deleteOrcamento(id); // Isso cascata itens? O método deleteOrcamento deleta itens.
            else if (table === 'vendas') this.db.deleteVenda(id);
            else if (table === 'itens_orcamento') this.db.deleteItemOrcamento(id);
            else if (table === 'fornecedores') this.db.deleteFornecedor(id);
            else if (table === 'custos') this.db.deleteCusto(id);
        } catch (e) {
            console.error(`[Sync] Erro ao deletar ${table}:`, e);
        } finally {
            this.db.setSyncing(false);
            this.emitSyncEvent({ type: 'delete', table, id });
        }
    }

    // ========================================
    // PUSH (LOCAL -> NUVEM)
    // ========================================

    async pushData(table, data, operation) {
        if (!this.checkConnection()) return;

        // Se estivermos aplicando uma mudança vinda da nuvem, não devolvemos (evita loop)
        if (this.db.isSyncing) return;

        console.log(`[Sync] Enviando ${operation} em ${table} para nuvem:`, data.id);

        try {
            if (operation === 'DELETE') {
                await this.supabase.from(table).delete().eq('id', data.id);
            } else {
                // INSERT ou UPDATE (Upsert)
                // Limpar campos virtuais
                const cleanData = { ...data };
                delete cleanData.cliente_nome;
                delete cleanData.cliente_email;
                delete cleanData.cliente_cpf_cnpj;
                delete cleanData.cliente_telefone;
                delete cleanData.cliente_endereco;
                delete cleanData.cliente_bairro;
                delete cleanData.cliente_cidade;
                delete cleanData.cliente_cep;
                delete cleanData.cliente_condominio;
                delete cleanData.cliente_numero;
                delete cleanData.cliente_complemento;
                delete cleanData.orcamento_numero;

                // Remover undefined (JSON stringify remove, mas supabase pode reclamar)
                Object.keys(cleanData).forEach(key => cleanData[key] === undefined && delete cleanData[key]);

                const { error } = await this.supabase.from(table).upsert(cleanData);
                if (error) throw error;
            }
        } catch (error) {
            console.error(`[Sync] Erro ao enviar para nuvem (${table}):`, error);
            // TODO: Adicionar a uma fila de retry local?
        }
    }

    checkConnection() {
        return this.isConfigured && this.supabase !== null;
    }

    // ========================================
    // BACKUP (LOCAL -> NUVEM)
    // ========================================

    async backup() {
        if (!this.checkConnection()) return { success: false, error: 'Supabase não configurado' };

        try {
            console.log('[Backup] Iniciando backup...');

            // 1. Clientes
            const clientesLocais = this.db.getClientes();
            await this._backupTable('clientes', clientesLocais);

            // 2. Orçamentos
            const orcamentosLocais = this.db.getOrcamentos();
            await this._backupTable('orcamentos', orcamentosLocais);

            // 3. Itens de Orçamento (Todos)
            // Preciso pegar TODOS os itens de todos os orçamentos locais
            let todosItens = [];
            for (const orc of orcamentosLocais) {
                const itens = this.db.getItensOrcamento(orc.id);
                todosItens = [...todosItens, ...itens];
            }
            await this._backupTable('itens_orcamento', todosItens);

            // 4. Vendas
            const vendasLocais = this.db.getVendas();
            await this._backupTable('vendas', vendasLocais);

            // 5. Fornecedores
            const fornecedoresLocais = this.db.getFornecedores();
            await this._backupTable('fornecedores', fornecedoresLocais);

            // 6. Custos
            const custosLocais = this.db.getCustos();
            await this._backupTable('custos', custosLocais);

            console.log('[Backup] Concluído com sucesso!');
            return { success: true };

        } catch (error) {
            console.error('[Backup] Erro:', error);
            return { success: false, error: error.message };
        }
    }

    // Método genérico para espelhar tabela Local -> Remoto
    async _backupTable(tableName, localData) {
        // 1. Upsert dados locais no remoto
        if (localData.length > 0) {
            // Supabase tem limite de tamanho no body, ideal fazer em lotes se for muito grande
            // Para simplificar, assumindo volume razoável.
            // Remover campos "extras" que vêm dos joins (ex: cliente_nome) antes de enviar
            const cleanData = localData.map(item => {
                const clean = { ...item };
                // Remove campos virtuais comuns que não existem na tabela
                delete clean.cliente_nome;
                delete clean.cliente_email;
                delete clean.cliente_cpf_cnpj;
                delete clean.cliente_telefone;
                delete clean.cliente_endereco;
                delete clean.cliente_bairro;
                delete clean.cliente_cidade;
                delete clean.cliente_cep;
                delete clean.cliente_condominio;
                delete clean.cliente_numero;
                delete clean.cliente_complemento;
                delete clean.orcamento_numero;
                return clean;
            });

            const { error: upsertError } = await this.supabase
                .from(tableName)
                .upsert(cleanData); // Upsert atualiza se ID existir

            if (upsertError) throw upsertError;
        }

        // 2. Deletar no remoto o que não existe no local (Espelhamento)
        const localIds = localData.map(d => d.id);

        // Buscar IDs remotos para comparar (evitar delete * perigoso se lista local vazia?? Não, se local vazia, remoto deve ser vazio)
        // Mas o "not.in" é seguro.
        if (localIds.length > 0) {
            const { error: deleteError } = await this.supabase
                .from(tableName)
                .delete()
                .not('id', 'in', `(${localIds.join(',')})`); // Sintaxe Postgrest para NOT IN

            if (deleteError) throw deleteError;
        } else {
            // Se local vazio, apagar tudo remoto dessa tabela?
            // Sim, é um espelho.
            // Cuidado: .delete().neq('id', '0') ou algo assim para garantir delete all
            // Mas Supabase exige WHERE.

            // Buscar todos remotos e deletar
            const { data: allRemote } = await this.supabase.from(tableName).select('id');
            if (allRemote && allRemote.length > 0) {
                const idsToDelete = allRemote.map(r => r.id);
                await this.supabase.from(tableName).delete().in('id', idsToDelete);
            }
        }
    }

    // ========================================
    // RESTORE (NUVEM -> LOCAL)
    // ========================================

    async restore() {
        if (!this.checkConnection()) return { success: false, error: 'Supabase não configurado' };

        try {
            console.log('[Restore] Iniciando restauração...');

            // Ordem importa devido a Foreign Keys!
            // Para deletar localmente: Itens -> Vendas -> Orçamentos -> Clientes (mas vendas depende de orcamento e cliente)
            // Para inserir: Clientes -> Orçamentos -> Itens -> Vendas

            // Vamos adotar estratégia drástica mas segura para consistência:
            // 1. Limpar banco local (respeitando FKs)
            // 2. Baixar tudo do remoto e inserir

            // Baixar dados remotos primeiro para garantir que temos antes de apagar local
            const { data: remoteClientes, error: errCli } = await this.supabase.from('clientes').select('*');
            if (errCli) throw errCli;

            const { data: remoteOrcamentos, error: errOrc } = await this.supabase.from('orcamentos').select('*');
            if (errOrc) throw errOrc;

            const { data: remoteItens, error: errItens } = await this.supabase.from('itens_orcamento').select('*');
            if (errItens) throw errItens;

            const { data: remoteVendas, error: errVendas } = await this.supabase.from('vendas').select('*');
            if (errVendas) throw errVendas;

            const { data: remoteFornecedores, error: errFornecedores } = await this.supabase.from('fornecedores').select('*');
            if (errFornecedores) throw errFornecedores;

            const { data: remoteCustos, error: errCustos } = await this.supabase.from('custos').select('*');
            if (errCustos) throw errCustos;

            // Transação para limpeza e inserção
            // Better-sqlite3 é síncrono, podemos fazer sequencial

            // Desativar FK checks temporariamente para limpeza pode ajudar, mas vamos tentar ordem correta
            // Limpeza:
            this.db.db.prepare('DELETE FROM itens_orcamento').run();
            this.db.db.prepare('DELETE FROM vendas').run(); // Vendas referenciam orçamentos e clientes
            this.db.db.prepare('DELETE FROM itens_orcamento').run();
            this.db.db.prepare('DELETE FROM orcamentos').run(); // Orçamentos referenciam clientes
            this.db.db.prepare('DELETE FROM clientes').run();
            this.db.db.prepare('DELETE FROM fornecedores').run();
            this.db.db.prepare('DELETE FROM custos').run();

            // Inserção (Ordem: Clientes -> Orçamentos -> Vendas. Itens dependem de Orç.)

            // 1. Clientes
            const stmtCli = this.db.db.prepare(`
                INSERT INTO clientes (id, nome, email, telefone, cpf_cnpj, endereco, numero, complemento, bairro, cidade, cep, condominio, created_at, updated_at, sync_id)
                VALUES (@id, @nome, @email, @telefone, @cpf_cnpj, @endereco, @numero, @complemento, @bairro, @cidade, @cep, @condominio, @created_at, @updated_at, @sync_id)
            `);
            const insertClientes = this.db.db.transaction((clientes) => {
                for (const c of clientes) stmtCli.run(c);
            });
            insertClientes(remoteClientes);

            // 2. Orçamentos
            const stmtOrc = this.db.db.prepare(`
                INSERT INTO orcamentos (id, numero, cliente_id, vendedor, status, valor_total, observacoes, prazo_pagamento, prazo_entrega, garantia, pdf_path, created_at, updated_at, sync_id)
                VALUES (@id, @numero, @cliente_id, @vendedor, @status, @valor_total, @observacoes, @prazo_pagamento, @prazo_entrega, @garantia, @pdf_path, @created_at, @updated_at, @sync_id)
            `);
            const insertOrcamentos = this.db.db.transaction((items) => {
                for (const i of items) stmtOrc.run(i);
            });
            insertOrcamentos(remoteOrcamentos);

            // 3. Itens
            const stmtItem = this.db.db.prepare(`
                INSERT INTO itens_orcamento (id, orcamento_id, quantidade, descricao, valor_unitario, valor_total, categoria)
                VALUES (@id, @orcamento_id, @quantidade, @descricao, @valor_unitario, @valor_total, @categoria)
            `);
            const insertItens = this.db.db.transaction((items) => {
                for (const i of items) stmtItem.run(i);
            });
            insertItens(remoteItens);

            // 4. Vendas
            const stmtVenda = this.db.db.prepare(`
                INSERT INTO vendas (id, numero, cliente_id, orcamento_id, data_venda, valor, custo, costureira, instalacao, outros_custos, lucro, observacoes, created_at, updated_at)
                VALUES (@id, @numero, @cliente_id, @orcamento_id, @data_venda, @valor, @custo, @costureira, @instalacao, @outros_custos, @lucro, @observacoes, @created_at, @updated_at)
            `);
            const insertVendas = this.db.db.transaction((items) => {
                for (const i of items) stmtVenda.run(i);
            });
            insertVendas(remoteVendas);

            // 5. Fornecedores
            const stmtFornecedor = this.db.db.prepare(`
                INSERT INTO fornecedores (id, nome, contato, telefone, email, endereco, categoria, observacoes, created_at, updated_at, sync_id)
                VALUES (@id, @nome, @contato, @telefone, @email, @endereco, @categoria, @observacoes, @created_at, @updated_at, @sync_id)
            `);
            const insertFornecedores = this.db.db.transaction((items) => {
                for (const i of items) stmtFornecedor.run(i);
            });
            insertFornecedores(remoteFornecedores);

            // 6. Custos
            const stmtCusto = this.db.db.prepare(`
                INSERT INTO custos (id, descricao, categoria, valor, data_vencimento, data_pagamento, status, observacoes, created_at, updated_at, sync_id)
                VALUES (@id, @descricao, @categoria, @valor, @data_vencimento, @data_pagamento, @status, @observacoes, @created_at, @updated_at, @sync_id)
            `);
            const insertCustos = this.db.db.transaction((items) => {
                for (const i of items) stmtCusto.run(i);
            });
            insertCustos(remoteCustos);

            console.log('[Restore] Concluído com sucesso!');
            this.emitSyncEvent({ type: 'restore' });
            return { success: true };

        } catch (error) {
            console.error('[Restore] Erro:', error);
            // Tentar recuperar? Difícil se já apagou.
            return { success: false, error: error.message };
        }
    }
}

module.exports = SupabaseSync;
