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
        this.realtimeChannel = null;
        this._processingPending = false; // evita execuções paralelas
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

            // Processar fila offline e puxar histórico do Supabase ao iniciar
            setTimeout(async () => {
                await this.processPendingSync();
                await this.syncFromRemote();
            }, 5000);

            // Verificar fila offline periodicamente (a cada 2 minutos)
            setInterval(() => this.processPendingSync(), 120000);

            return true;
        }

        this.isConfigured = false;
        console.log('Supabase não configurado');
        return false;
    }

    initializeRealtime() {
        if (!this.checkConnection()) return;

        console.log('Iniciando escuta Realtime...');

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

                // Quando (re)conectar: processar fila offline e sincronizar histórico
                if (status === 'SUBSCRIBED') {
                    console.log('[Sync] Realtime conectado. Verificando fila offline e histórico...');
                    setTimeout(async () => {
                        await this.processPendingSync();
                        await this.syncFromRemote();
                    }, 2000);
                }
            });
    }

    handleIncomingChange(payload) {
        console.log('[Sync] Recebido evento externo:', payload.eventType, payload.table);

        const { eventType, table, new: newRecord, old: oldRecord } = payload;

        try {
            // Converter undefined para null para evitar erros no SQLite local
            const cleanRecord = newRecord
                ? Object.fromEntries(Object.entries(newRecord).map(([k, v]) => [k, v === undefined ? null : v]))
                : null;

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
        console.log(`[Sync] Aplicando ${table} localmente:`, record.id);

        this.db.setSyncing(true);

        try {
            if (table === 'clientes') {
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
                    // =========================================================
                    // RESOLUÇÃO DE CONFLITO DE NÚMERO
                    // Cenário: dois terminais criaram orçamentos com o mesmo número
                    // simultaneamente (offline ou race condition)
                    // =========================================================
                    const conflito = this.db.getOrcamentoByNumero(record.numero);
                    if (conflito && conflito.id !== record.id) {
                        // O número já existe com um ID diferente (outro orçamento)
                        // O registro remoto precisa ser renumerado
                        const novoNumero = this.db.getNextNumero();
                        console.warn(
                            `[Sync] CONFLITO de numero detectado! ` +
                            `Numero ${record.numero} (id: ${record.id}) ja pertence ao id: ${conflito.id}. ` +
                            `Renumerando para: ${novoNumero}`
                        );
                        record = { ...record, numero: novoNumero };

                        // Corrigir o número no Supabase também (apos sair do lock de syncing)
                        setTimeout(() => {
                            console.log(`[Sync] Corrigindo numero no Supabase: ${record.id} -> ${novoNumero}`);
                            this.pushData('orcamentos', record, 'UPDATE');
                        }, 1500);

                        // Notificar o usuario
                        this.emitSyncEvent({
                            type: 'conflict_resolved',
                            table: 'orcamentos',
                            id: record.id,
                            message: `Conflito de numero resolvido: ${record.numero}`
                        });
                    }
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
            this.emitSyncEvent({ type: 'upsert', table, id: record.id, orcamento_id: record.orcamento_id });
        }
    }

    deleteLocal(table, id) {
        console.log(`[Sync] Deletando ${table} localmente:`, id);
        this.db.setSyncing(true);
        try {
            if (table === 'clientes') this.db.deleteCliente(id);
            else if (table === 'orcamentos') this.db.deleteOrcamento(id);
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
        if (!this.checkConnection()) {
            // Sem conexão Supabase configurada — não enfileirar
            return;
        }

        // Se estivermos aplicando uma mudança vinda da nuvem, não devolvemos (evita loop)
        if (this.db.isSyncing) return;

        console.log(`[Sync] Enviando ${operation} em ${table} para nuvem:`, data.id);

        try {
            if (operation === 'DELETE') {
                const { error } = await this.supabase.from(table).delete().eq('id', data.id);
                if (error) throw error;
            } else {
                // INSERT ou UPDATE (Upsert)
                const cleanData = this._cleanDataForPush(data);

                const { error } = await this.supabase.from(table).upsert(cleanData);

                if (error) {
                    // =========================================================
                    // RESOLUÇÃO DE CONFLITO DE NÚMERO NO SUPABASE
                    // Cenário: terminal offline criou ORC-0100, Supabase ja tem ORC-0100
                    // de outro terminal. Postgres retorna erro de unique constraint.
                    // =========================================================
                    const isUniqueViolation = error.code === '23505' ||
                        (error.message && (
                            error.message.includes('unique') ||
                            error.message.includes('duplicate') ||
                            error.message.includes('already exists')
                        ));

                    if (table === 'orcamentos' && isUniqueViolation) {
                        console.warn(`[Sync] Conflito de numero no Supabase para orcamento ${cleanData.id}. Obtendo proximo numero disponivel...`);

                        const novoNumero = await this.getNextNumeroRemoto();
                        console.log(`[Sync] Renumerando no Supabase: ${cleanData.numero} -> ${novoNumero}`);

                        cleanData.numero = novoNumero;

                        // Atualizar localmente primeiro
                        this.db.setSyncing(true);
                        try {
                            this.db.updateOrcamento(cleanData.id, { ...data, numero: novoNumero });
                        } finally {
                            this.db.setSyncing(false);
                        }

                        // Retry no Supabase com o novo número
                        const { error: retryError } = await this.supabase.from(table).upsert(cleanData);
                        if (retryError) throw retryError;

                        console.log(`[Sync] Orcamento renumerado com sucesso: ${data.numero} -> ${novoNumero}`);
                        this.emitSyncEvent({
                            type: 'conflict_resolved',
                            table: 'orcamentos',
                            id: cleanData.id,
                            message: `Numero corrigido: ${data.numero} -> ${novoNumero}`
                        });
                    } else {
                        throw error;
                    }
                }
            }
        } catch (error) {
            // Detectar erro de rede (terminal sem internet)
            const isNetworkError = this._isNetworkError(error);

            if (isNetworkError) {
                // Enfileirar para processar quando a internet voltar
                this.db.addPendingSync(table, data, operation);
                console.warn(`[Sync] Sem internet. Operacao enfileirada para retry: ${operation} ${table} ${data.id}`);
            } else {
                console.error(`[Sync] Erro ao enviar para nuvem (${table}):`, error);
            }
        }
    }

    // ========================================
    // FILA OFFLINE — Processar pendências ao reconectar
    // ========================================

    async processPendingSync() {
        if (!this.checkConnection()) return;
        if (this._processingPending) return; // evita execuções paralelas

        const pending = this.db.getPendingSync();
        if (pending.length === 0) return;

        this._processingPending = true;
        console.log(`[Sync] Processando ${pending.length} operacao(oes) pendente(s) da fila offline...`);

        for (const item of pending) {
            try {
                // Remover da fila ANTES de processar para evitar duplicatas
                // (se falhar, vai ser re-adicionado no catch do pushData)
                this.db.removePendingSync(item.id);

                // Orçamentos criados offline têm número local que pode conflitar.
                // Antes de subir, reservar um número definitivo no Supabase.
                if (item.table_name === 'orcamentos' && item.operation === 'INSERT') {
                    const numeroReservado = await this.reservarNumeroOrcamento();
                    if (numeroReservado && numeroReservado !== item.record_data.numero) {
                        const numAnterior = item.record_data.numero;
                        item.record_data = { ...item.record_data, numero: numeroReservado };

                        // Atualizar localmente para refletir o número definitivo
                        this.db.setSyncing(true);
                        try {
                            this.db.updateOrcamento(item.record_data.id, { numero: numeroReservado });
                        } finally {
                            this.db.setSyncing(false);
                        }

                        console.log(`[Sync] Offline orcamento renumerado: ${numAnterior} -> ${numeroReservado}`);
                        this.emitSyncEvent({
                            type: 'numero_corrigido',
                            table: 'orcamentos',
                            id: item.record_data.id,
                            numero: numeroReservado
                        });
                    }
                }

                // Processar com resolução de conflito inclusa no pushData
                await this.pushData(item.table_name, item.record_data, item.operation);

                console.log(`[Sync] Pendencia processada: ${item.operation} ${item.table_name} ${item.record_data.id || ''}`);
            } catch (e) {
                console.error(`[Sync] Erro ao processar pendencia ${item.id}:`, e);

                // Se ainda falhou (ex: erro permanente), verificar limite de tentativas
                if (item.retry_count < 5) {
                    // Re-enfileirar com contagem de retry
                    const newId = this.db.addPendingSync(item.table_name, item.record_data, item.operation);
                    this.db.incrementPendingSyncRetry(newId);
                } else {
                    console.error(`[Sync] Operacao removida apos ${item.retry_count} tentativas:`, item);
                }
            }
        }

        this._processingPending = false;
        console.log('[Sync] Fila offline processada.');
        this.emitSyncEvent({ type: 'pending_sync_done' });
    }

    // ========================================
    // HELPERS
    // ========================================

    // Reserva um número único no Supabase via função atômica (UPDATE...RETURNING)
    // Requer que a função next_orcamento_numero() exista no Supabase (ver docs/supabase-sequencia.sql)
    async reservarNumeroOrcamento() {
        if (!this.checkConnection()) return null;
        try {
            const { data, error } = await this.supabase.rpc('next_orcamento_numero');
            if (error) {
                console.warn('[Sync] RPC next_orcamento_numero indisponível, usando fallback local:', error.message);
                return null;
            }
            console.log('[Sync] Número reservado centralmente:', data);
            return data; // ex: 'ORC-0139'
        } catch (e) {
            console.warn('[Sync] Erro ao reservar número no Supabase:', e.message);
            return null;
        }
    }

    // Obtém o próximo número de orçamento consultando tanto local quanto remoto
    async getNextNumeroRemoto() {
        try {
            const { data } = await this.supabase
                .from('orcamentos')
                .select('numero')
                .like('numero', 'ORC-%')
                .order('numero', { ascending: false })
                .limit(1);

            let remoteMax = 0;
            if (data && data.length > 0) {
                const parts = data[0].numero.split('-');
                if (parts.length === 2) remoteMax = parseInt(parts[1]) || 0;
            }

            // Comparar com o máximo local
            const localNextStr = this.db.getNextNumero(); // já retorna o PRÓXIMO (max+1)
            const localParts = localNextStr.split('-');
            const localNext = localParts.length === 2 ? (parseInt(localParts[1]) || 1) : 1;
            const localMax = localNext - 1;

            // Usar o maior entre remoto e local, + 1
            const nextNum = Math.max(remoteMax, localMax) + 1;
            return `ORC-${String(nextNum).padStart(4, '0')}`;
        } catch (e) {
            console.error('[Sync] Erro ao obter proximo numero remoto:', e);
            // Fallback para número local
            return this.db.getNextNumero();
        }
    }

    _cleanDataForPush(data) {
        const clean = { ...data };
        // Remover campos virtuais (joins) que não existem nas tabelas do Supabase
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
        // Remover undefined
        Object.keys(clean).forEach(key => clean[key] === undefined && delete clean[key]);
        return clean;
    }

    _isNetworkError(error) {
        if (!error) return false;
        const msg = error.message || '';
        return (
            msg.includes('fetch') ||
            msg.includes('Failed to fetch') ||
            msg.includes('network') ||
            msg.includes('ENOTFOUND') ||
            msg.includes('ECONNREFUSED') ||
            msg.includes('ETIMEDOUT') ||
            msg.includes('getaddrinfo') ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT'
        );
    }

    checkConnection() {
        return this.isConfigured && this.supabase !== null;
    }

    // ========================================
    // SYNC FROM REMOTE (NUVEM -> LOCAL, não-destrutivo)
    // Preenche lacunas históricas sem sobrescrever mudanças locais pendentes
    // ========================================

    async syncFromRemote() {
        if (!this.checkConnection()) return;
        if (this._syncingFromRemote) return;
        this._syncingFromRemote = true;

        console.log('[SyncFromRemote] Iniciando sync histórico da nuvem...');

        try {
            // IDs com mudanças locais pendentes — não sobrescrever
            const pendingItems = this.db.getPendingSync();
            const protectedIds = new Set(pendingItems.map(p => p.record_data?.id).filter(Boolean));

            const [
                { data: remoteClientes },
                { data: remoteOrcamentos },
                { data: remoteItens },
                { data: remoteVendas },
                { data: remoteFornecedores },
                { data: remoteCustos }
            ] = await Promise.all([
                this.supabase.from('clientes').select('*'),
                this.supabase.from('orcamentos').select('*'),
                this.supabase.from('itens_orcamento').select('*'),
                this.supabase.from('vendas').select('*'),
                this.supabase.from('fornecedores').select('*'),
                this.supabase.from('custos').select('*')
            ]);

            const filter = (rows) => (rows || []).filter(r => !protectedIds.has(r.id));

            this.db.setSyncing(true);
            try {
                // Clientes
                const stmtCli = this.db.db.prepare(`
                    INSERT OR REPLACE INTO clientes (id, nome, email, telefone, cpf_cnpj, endereco, numero, complemento, bairro, cidade, cep, condominio, created_at, updated_at, sync_id)
                    VALUES (@id, @nome, @email, @telefone, @cpf_cnpj, @endereco, @numero, @complemento, @bairro, @cidade, @cep, @condominio, @created_at, @updated_at, @sync_id)
                `);
                this.db.db.transaction((rows) => { for (const r of rows) stmtCli.run(r); })(filter(remoteClientes));

                // Orçamentos
                const stmtOrc = this.db.db.prepare(`
                    INSERT OR REPLACE INTO orcamentos (id, numero, cliente_id, vendedor, status, valor_total, observacoes, prazo_pagamento, prazo_entrega, garantia, pdf_path, created_at, updated_at, sync_id)
                    VALUES (@id, @numero, @cliente_id, @vendedor, @status, @valor_total, @observacoes, @prazo_pagamento, @prazo_entrega, @garantia, @pdf_path, @created_at, @updated_at, @sync_id)
                `);
                this.db.db.transaction((rows) => { for (const r of rows) stmtOrc.run(r); })(filter(remoteOrcamentos));

                // Itens de orçamento
                const stmtItem = this.db.db.prepare(`
                    INSERT OR REPLACE INTO itens_orcamento (id, orcamento_id, quantidade, descricao, valor_unitario, valor_total, categoria)
                    VALUES (@id, @orcamento_id, @quantidade, @descricao, @valor_unitario, @valor_total, @categoria)
                `);
                this.db.db.transaction((rows) => { for (const r of rows) stmtItem.run(r); })(filter(remoteItens));

                // Vendas
                const stmtVenda = this.db.db.prepare(`
                    INSERT OR REPLACE INTO vendas (id, numero, cliente_id, orcamento_id, data_venda, valor, custo, costureira, instalacao, outros_custos, lucro, observacoes, tipo_fluxo, etapa_atual, nome_costureira, nome_instalador, data_entrega_prevista, valor_entrada, falta_pagar, desconto, created_at, updated_at)
                    VALUES (@id, @numero, @cliente_id, @orcamento_id, @data_venda, @valor, @custo, @costureira, @instalacao, @outros_custos, @lucro, @observacoes, @tipo_fluxo, @etapa_atual, @nome_costureira, @nome_instalador, @data_entrega_prevista, @valor_entrada, @falta_pagar, @desconto, @created_at, @updated_at)
                `);
                this.db.db.transaction((rows) => { for (const r of rows) stmtVenda.run(r); })(filter(remoteVendas));

                // Fornecedores
                const stmtForn = this.db.db.prepare(`
                    INSERT OR REPLACE INTO fornecedores (id, nome, contato, telefone, email, endereco, categoria, observacoes, created_at, updated_at, sync_id)
                    VALUES (@id, @nome, @contato, @telefone, @email, @endereco, @categoria, @observacoes, @created_at, @updated_at, @sync_id)
                `);
                this.db.db.transaction((rows) => { for (const r of rows) stmtForn.run(r); })(filter(remoteFornecedores));

                // Custos
                const stmtCusto = this.db.db.prepare(`
                    INSERT OR REPLACE INTO custos (id, descricao, categoria, valor, data_vencimento, data_pagamento, status, observacoes, created_at, updated_at, sync_id)
                    VALUES (@id, @descricao, @categoria, @valor, @data_vencimento, @data_pagamento, @status, @observacoes, @created_at, @updated_at, @sync_id)
                `);
                this.db.db.transaction((rows) => { for (const r of rows) stmtCusto.run(r); })(filter(remoteCustos));
            } finally {
                this.db.setSyncing(false);
            }

            console.log('[SyncFromRemote] Concluído. Tabelas atualizadas com dados históricos.');
            this.emitSyncEvent({ type: 'sync_from_remote' });

        } catch (error) {
            console.error('[SyncFromRemote] Erro:', error);
        } finally {
            this._syncingFromRemote = false;
        }
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
        if (localData.length > 0) {
            const cleanData = localData.map(item => this._cleanDataForPush(item));

            const { error: upsertError } = await this.supabase
                .from(tableName)
                .upsert(cleanData);

            if (upsertError) throw upsertError;
        }

        const localIds = localData.map(d => d.id);

        if (localIds.length > 0) {
            const { error: deleteError } = await this.supabase
                .from(tableName)
                .delete()
                .not('id', 'in', `(${localIds.join(',')})`);

            if (deleteError) throw deleteError;
        } else {
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

            // Limpeza (respeitando ordem de FKs)
            this.db.db.prepare('DELETE FROM itens_orcamento').run();
            this.db.db.prepare('DELETE FROM vendas').run();
            this.db.db.prepare('DELETE FROM orcamentos').run();
            this.db.db.prepare('DELETE FROM clientes').run();
            this.db.db.prepare('DELETE FROM fornecedores').run();
            this.db.db.prepare('DELETE FROM custos').run();

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
                INSERT INTO vendas (id, numero, cliente_id, orcamento_id, data_venda, valor, custo, costureira, instalacao, outros_custos, lucro, observacoes, tipo_fluxo, etapa_atual, nome_costureira, nome_instalador, data_entrega_prevista, valor_entrada, falta_pagar, desconto, created_at, updated_at)
                VALUES (@id, @numero, @cliente_id, @orcamento_id, @data_venda, @valor, @custo, @costureira, @instalacao, @outros_custos, @lucro, @observacoes, @tipo_fluxo, @etapa_atual, @nome_costureira, @nome_instalador, @data_entrega_prevista, @valor_entrada, @falta_pagar, @desconto, @created_at, @updated_at)
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

            // Limpar fila offline (dados foram restaurados da nuvem)
            this.db.clearPendingSync();

            console.log('[Restore] Concluído com sucesso!');
            this.emitSyncEvent({ type: 'restore' });
            return { success: true };

        } catch (error) {
            console.error('[Restore] Erro:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SupabaseSync;
