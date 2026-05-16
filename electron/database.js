const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { v4: uuidv4 } = require('uuid');

class AppDatabase {
    constructor() {
        this.db = null;
        this.syncService = null;
        this.isSyncing = false;
    }

    setSyncService(service) {
        this.syncService = service;
    }

    setSyncing(value) {
        this.isSyncing = value;
    }

    getDbPath() {
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'orcamentos.db');
    }

    getBackupPath() {
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'backups');
    }

    performStartupBackup() {
        const dbPath = this.getDbPath();
        // Se o banco não existe ainda, não tem o que fazer backup
        if (!fs.existsSync(dbPath)) return;

        const backupDir = this.getBackupPath();
        // Garantir diretório de backups
        if (!fs.existsSync(backupDir)) {
            try {
                fs.mkdirSync(backupDir, { recursive: true });
            } catch (err) {
                console.error('Erro ao criar diretório de backups:', err);
                return;
            }
        }

        // Nome do arquivo: orcamentos_startup_YYYY-MM-DD_HH-mm-ss.db
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `orcamentos_startup_${timestamp}.db`);

        try {
            fs.copyFileSync(dbPath, backupFile);
            console.log('Backup de inicialização criado:', backupFile);
            this.cleanupOldBackups(backupDir);
        } catch (err) {
            console.error('Erro ao criar backup de inicialização:', err);
        }
    }

    cleanupOldBackups(backupDir) {
        try {
            const files = fs.readdirSync(backupDir);
            // Filtrar apenas backups de startup
            const startupBackups = files.filter(f => f.startsWith('orcamentos_startup_') && f.endsWith('.db'));

            // Se tiver mais que 30, deletar os mais antigos
            if (startupBackups.length > 30) {
                // Sort padrão (alfabética) funciona bem para timestamps ISO (YYYY-MM-DD...)
                startupBackups.sort();

                // Os primeiros da lista são os mais antigos
                const countToDelete = startupBackups.length - 30;
                const filesToDelete = startupBackups.slice(0, countToDelete);

                filesToDelete.forEach(file => {
                    const filePath = path.join(backupDir, file);
                    fs.unlinkSync(filePath);
                    console.log('Backup antigo removido (rotação):', file);
                });
            }
        } catch (err) {
            console.error('Erro ao limpar backups antigos:', err);
        }
    }

    setupRecurringBackup() {
        // 1 hora em milissegundos
        const INTERVAL_MS = 60 * 60 * 1000;

        // Iniciar intervalo
        setInterval(() => {
            this.performRecurringBackup();
        }, INTERVAL_MS);

        console.log('Agendador de backup recorrente iniciado (1h).');
    }

    performRecurringBackup() {
        if (!this.db) return;

        const backupDir = this.getBackupPath();
        if (!fs.existsSync(backupDir)) {
            try {
                fs.mkdirSync(backupDir, { recursive: true });
            } catch (err) {
                console.error('Erro ao criar dir backup recorrente:', err);
                return;
            }
        }

        // Arquivo único que será sobrescrito
        const backupFile = path.join(backupDir, 'orcamentos_auto_current.db');

        // Usar API de backup do better-sqlite3 (não bloqueia leitura, seguro com banco aberto)
        this.db.backup(backupFile)
            .then(() => {
                const time = new Date().toLocaleTimeString();
                console.log(`Backup recorrente atualizado com sucesso às ${time}:`, backupFile);
            })
            .catch((err) => {
                console.error('Erro no backup recorrente:', err);
            });
    }

    initialize() {
        // 1. Relizar Backup de Inicialização (antes de mexer no banco)
        this.performStartupBackup();

        const dbPath = this.getDbPath();

        // Garantir que o diretório existe
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');

        // Criar tabelas
        this.createTables();

        // Migração: adicionar coluna numero se não existir
        this.runMigrations();

        // Inserir configurações padrão
        this.insertDefaultConfig();

        // 2. Iniciar agendador de backup recorrente
        this.setupRecurringBackup();

        console.log('Banco de dados inicializado em:', dbPath);
    }

    runMigrations() {
        try {
            // Migrações Clientes
            const columnsClientes = this.db.prepare("PRAGMA table_info(clientes)").all();

            if (!columnsClientes.some(col => col.name === 'numero')) {
                this.db.exec("ALTER TABLE clientes ADD COLUMN numero TEXT");
                console.log('Migração: coluna numero adicionada em clientes');
            }

            if (!columnsClientes.some(col => col.name === 'complemento')) {
                this.db.exec("ALTER TABLE clientes ADD COLUMN complemento TEXT");
                console.log('Migração: coluna complemento adicionada em clientes');
            }

            // Migrações Vendas (Workflow)
            // Verificar colunas em vendas (pode não existir ainda se for primeira execução, mas createTables cuida disso.
            // Se tabela já existe, precisamos alterar)
            const tableVendasExists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='vendas'").get();

            if (tableVendasExists) {
                const columnsVendas = this.db.prepare("PRAGMA table_info(vendas)").all();

                if (!columnsVendas.some(col => col.name === 'tipo_fluxo')) {
                    this.db.exec("ALTER TABLE vendas ADD COLUMN tipo_fluxo TEXT");
                    console.log('Migração: coluna tipo_fluxo adicionada em vendas');
                }
                if (!columnsVendas.some(col => col.name === 'etapa_atual')) {
                    this.db.exec("ALTER TABLE vendas ADD COLUMN etapa_atual TEXT");
                    console.log('Migração: coluna etapa_atual adicionada em vendas');
                }
                if (!columnsVendas.some(col => col.name === 'nome_costureira')) {
                    this.db.exec("ALTER TABLE vendas ADD COLUMN nome_costureira TEXT");
                    console.log('Migração: coluna nome_costureira adicionada em vendas');
                }
                if (!columnsVendas.some(col => col.name === 'data_entrega_prevista')) {
                    this.db.exec("ALTER TABLE vendas ADD COLUMN data_entrega_prevista DATE");
                    console.log('Migração: coluna data_entrega_prevista adicionada em vendas');
                }
                if (!columnsVendas.some(col => col.name === 'nome_instalador')) {
                    this.db.exec("ALTER TABLE vendas ADD COLUMN nome_instalador TEXT");
                    console.log('Migração: coluna nome_instalador adicionada em vendas');
                }

                // Novas colunas Vendas (Entrada / Falta Pagar / Desconto)
                if (!columnsVendas.some(col => col.name === 'valor_entrada')) {
                    this.db.exec("ALTER TABLE vendas ADD COLUMN valor_entrada REAL DEFAULT 0");
                    console.log('Migração: coluna valor_entrada adicionada em vendas');
                }
                if (!columnsVendas.some(col => col.name === 'falta_pagar')) {
                    this.db.exec("ALTER TABLE vendas ADD COLUMN falta_pagar REAL DEFAULT 0");
                    console.log('Migração: coluna falta_pagar adicionada em vendas');
                }
                if (!columnsVendas.some(col => col.name === 'desconto')) {
                    this.db.exec("ALTER TABLE vendas ADD COLUMN desconto REAL DEFAULT 0");
                    console.log('Migração: coluna desconto adicionada em vendas');
                }
            }

            // Migração: tabela vendas (Create if not exists já está no createTables, mas mantendo histórico aqui se necessário)
            /* 
               A lógica original criava a tabela no runMigrations se não existisse, 
               mas o ideal é deixar o createTables cuidar da criação inicial completa 
               e aqui só ALTERs. Vou manter o CREATE TABLE abaixo mas ele tem IF NOT EXISTS.
            */
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS vendas (
                    id TEXT PRIMARY KEY,
                    numero TEXT UNIQUE NOT NULL,
                    cliente_id TEXT REFERENCES clientes(id),
                    orcamento_id TEXT REFERENCES orcamentos(id),
                    data_venda DATE DEFAULT CURRENT_DATE,
                    valor REAL DEFAULT 0,
                    custo REAL DEFAULT 0,
                    costureira REAL DEFAULT 0,
                    instalacao REAL DEFAULT 0,
                    outros_custos REAL DEFAULT 0,
                    lucro REAL DEFAULT 0,
                    observacoes TEXT,
                    tipo_fluxo TEXT,
                    etapa_atual TEXT,
                    nome_costureira TEXT, 
                    nome_instalador TEXT,
                    data_entrega_prevista DATE,
                    valor_entrada REAL DEFAULT 0,
                    falta_pagar REAL DEFAULT 0,
                    desconto REAL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Índices para vendas
            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_vendas_cliente_id ON vendas(cliente_id);
                CREATE INDEX IF NOT EXISTS idx_vendas_orcamento_id ON vendas(orcamento_id);
            `);


            // Migrações Itens Orçamento
            const columnsItens = this.db.prepare("PRAGMA table_info(itens_orcamento)").all();
            if (!columnsItens.some(col => col.name === 'categoria')) {
                this.db.exec("ALTER TABLE itens_orcamento ADD COLUMN categoria TEXT");
                console.log('Migração: coluna categoria adicionada em itens_orcamento');
            }

            if (!columnsItens.some(col => col.name === 'categoria')) {
                this.db.exec("ALTER TABLE itens_orcamento ADD COLUMN categoria TEXT");
                console.log('Migração: coluna categoria adicionada em itens_orcamento');
            }

            // Migrações Custos
            const columnsCustos = this.db.prepare("PRAGMA table_info(custos)").all();
            if (!columnsCustos.some(col => col.name === 'fornecedor')) {
                this.db.exec("ALTER TABLE custos ADD COLUMN fornecedor TEXT");
                console.log('Migração: coluna fornecedor adicionada em custos');
            }

        } catch (error) {
            console.error('Erro na migração:', error);
        }
    }

    createTables() {
        // Clientes
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS clientes (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                email TEXT,
                telefone TEXT,
                cpf_cnpj TEXT,
                endereco TEXT,
                bairro TEXT,
                cidade TEXT,
                cep TEXT,
                complemento TEXT,
                numero TEXT,
                condominio TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sync_id TEXT
            )
        `);

        // Orçamentos
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS orcamentos (
                id TEXT PRIMARY KEY,
                numero TEXT UNIQUE NOT NULL,
                cliente_id TEXT REFERENCES clientes(id),
                vendedor TEXT,
                status TEXT DEFAULT 'Pendente',
                valor_total REAL DEFAULT 0,
                observacoes TEXT,
                prazo_pagamento TEXT,
                prazo_entrega TEXT,
                garantia TEXT,
                pdf_path TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sync_id TEXT
            )
        `);

        // Itens do Orçamento
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS itens_orcamento (
                id TEXT PRIMARY KEY,
                orcamento_id TEXT REFERENCES orcamentos(id),
                quantidade REAL DEFAULT 1,
                descricao TEXT NOT NULL,
                valor_unitario REAL DEFAULT 0,
                valor_total REAL DEFAULT 0,
                categoria TEXT
            )
        `);

        // Vendas (Workflow)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS vendas (
                id TEXT PRIMARY KEY,
                numero TEXT UNIQUE NOT NULL,
                cliente_id TEXT REFERENCES clientes(id),
                orcamento_id TEXT REFERENCES orcamentos(id),
                data_venda DATE DEFAULT CURRENT_DATE,
                valor REAL DEFAULT 0,
                custo REAL DEFAULT 0,
                costureira REAL DEFAULT 0,
                instalacao REAL DEFAULT 0,
                outros_custos REAL DEFAULT 0,
                lucro REAL DEFAULT 0,
                observacoes TEXT,
                tipo_fluxo TEXT,
                etapa_atual TEXT,
                nome_costureira TEXT,
                nome_instalador TEXT,
                data_entrega_prevista DATE,
                valor_entrada REAL DEFAULT 0,
                falta_pagar REAL DEFAULT 0,
                desconto REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Fornecedores
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS fornecedores (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                contato TEXT,
                telefone TEXT,
                email TEXT,
                endereco TEXT,
                categoria TEXT,
                observacoes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sync_id TEXT
            )
        `);

        // Custos
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS custos (
                id TEXT PRIMARY KEY,
                descricao TEXT NOT NULL,
                categoria TEXT,
                fornecedor TEXT,
                valor REAL DEFAULT 0,
                data_vencimento DATE,
                data_pagamento DATE,
                status TEXT DEFAULT 'Pendente',
                observacoes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sync_id TEXT
            )
        `);

        // Configurações
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS configuracoes (
                chave TEXT PRIMARY KEY,
                valor TEXT
            )
        `);
    }

    insertDefaultConfig() {
        // Se precisar de configurações padrão no futuro, adicione aqui.
        // Por exemplo:
        // this.setConfig('taxa_lucro_minima', '20');
    }

    // ========================================
    // CLIENTES
    // ========================================

    getClientes() {
        return this.db.prepare('SELECT * FROM clientes ORDER BY created_at DESC').all();
    }

    getClientesComOrcamento() {
        return this.db.prepare(`
            SELECT DISTINCT c.id, c.nome, c.email, c.telefone
            FROM clientes c
            INNER JOIN orcamentos o ON o.cliente_id = c.id
            ORDER BY c.nome ASC
        `).all();
    }

    getClienteById(id) {
        return this.db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
    }

    getClienteByCpfCnpj(cpfCnpj) {
        return this.db.prepare('SELECT * FROM clientes WHERE cpf_cnpj = ?').get(cpfCnpj);
    }

    searchClientes(termo) {
        const query = `%${termo}%`;
        return this.db.prepare(`
            SELECT * FROM clientes 
            WHERE nome LIKE ? OR cpf_cnpj LIKE ? OR email LIKE ? OR telefone LIKE ?
            ORDER BY nome
        `).all(query, query, query, query);
    }

    createCliente(cliente) {
        const id = cliente.id || uuidv4();
        const stmt = this.db.prepare(`
            INSERT INTO clientes (
                id, nome, email, telefone, cpf_cnpj, endereco, 
                bairro, cidade, cep, complemento, numero, condominio, sync_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            cliente.nome,
            cliente.email,
            cliente.telefone,
            cliente.cpf_cnpj,
            cliente.endereco,
            cliente.bairro,
            cliente.cidade,
            cliente.cep,
            cliente.complemento,
            cliente.numero,
            cliente.condominio,
            uuidv4()
        );

        const newCliente = { ...cliente, id };
        if (this.syncService) this.syncService.pushData('clientes', newCliente, 'INSERT');
        return newCliente;
    }

    updateCliente(id, cliente) {
        const stmt = this.db.prepare(`
            UPDATE clientes SET
                nome = ?,
                email = ?,
                telefone = ?,
                cpf_cnpj = ?,
                endereco = ?,
                bairro = ?,
                cidade = ?,
                cep = ?,
                complemento = ?,
                numero = ?,
                condominio = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(
            cliente.nome,
            cliente.email,
            cliente.telefone,
            cliente.cpf_cnpj,
            cliente.endereco,
            cliente.bairro,
            cliente.cidade,
            cliente.cep,
            cliente.complemento,
            cliente.numero,
            cliente.condominio,
            id
        );

        const updatedCliente = { ...cliente, id };
        if (this.syncService) this.syncService.pushData('clientes', updatedCliente, 'UPDATE');
        return updatedCliente;
    }

    deleteCliente(id) {
        // Verificar se tem vendas ou orçamentos
        const vendas = this.db.prepare('SELECT COUNT(*) as count FROM vendas WHERE cliente_id = ?').get(id).count;
        const orcamentos = this.db.prepare('SELECT COUNT(*) as count FROM orcamentos WHERE cliente_id = ?').get(id).count;

        if (vendas > 0 || orcamentos > 0) {
            throw new Error('Não é possível excluir cliente com vendas ou orçamentos vinculados.');
        }

        this.db.prepare('DELETE FROM clientes WHERE id = ?').run(id);

        if (this.syncService) this.syncService.pushData('clientes', { id }, 'DELETE');
        return { success: true };
    }

    // ========================================
    // ORÇAMENTOS (Listagem Geral)
    // ========================================

    getOrcamentos() {
        return this.db.prepare(`
            SELECT o.*, c.nome as cliente_nome 
            FROM orcamentos o
            LEFT JOIN clientes c ON o.cliente_id = c.id
            ORDER BY o.created_at DESC
        `).all();
    }

    // ... (skipping to VENDAS updateVenda) ...

    // Modificar updateVenda para notificar sync
    updateVenda(id, venda) {
        const stmt = this.db.prepare(`
            UPDATE vendas SET
                cliente_id = ?,
                orcamento_id = ?,
                data_venda = ?,
                valor = ?,
                custo = ?,
                costureira = ?,
                instalacao = ?,
                outros_custos = ?,
                lucro = ?,
                observacoes = ?,
                tipo_fluxo = ?,
                etapa_atual = ?,
                nome_costureira = ?,
                nome_instalador = ?,
                data_entrega_prevista = ?,
                valor_entrada = ?,
                falta_pagar = ?,
                desconto = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(
            venda.cliente_id,
            venda.orcamento_id || null,
            venda.data_venda,
            venda.valor || 0,
            venda.custo || 0,
            venda.costureira || 0,
            venda.instalacao || 0,
            venda.outros_custos || 0,
            venda.lucro || 0,
            venda.observacoes,
            venda.tipo_fluxo,
            venda.etapa_atual,
            venda.nome_costureira,
            venda.nome_instalador,
            venda.data_entrega_prevista,
            venda.valor_entrada || 0,
            venda.falta_pagar || 0,
            venda.desconto || 0,
            id
        );

        const updated = this.getVendaById(id);
        if (this.syncService) this.syncService.pushData('vendas', updated, 'UPDATE');
        return updated;
    }

    deleteVenda(id) {
        const stmt = this.db.prepare('DELETE FROM vendas WHERE id = ?');
        stmt.run(id);
        if (this.syncService) this.syncService.pushData('vendas', { id }, 'DELETE');
        return true;
    }

    getOrcamentoById(id) {
        return this.db.prepare(`
            SELECT o.*, c.nome as cliente_nome, c.email as cliente_email, 
                   c.telefone as cliente_telefone, c.cpf_cnpj as cliente_cpf_cnpj,
                   c.endereco as cliente_endereco, c.numero as cliente_numero,
                   c.complemento as cliente_complemento,
                   c.bairro as cliente_bairro, c.cidade as cliente_cidade, 
                   c.cep as cliente_cep, c.condominio as cliente_condominio
            FROM orcamentos o
            LEFT JOIN clientes c ON o.cliente_id = c.id
            WHERE o.id = ?
        `).get(id);
    }

    getOrcamentosByCliente(clienteId) {
        return this.db.prepare(`
            SELECT * FROM orcamentos WHERE cliente_id = ? ORDER BY created_at DESC
        `).all(clienteId);
    }

    // VENDAS
    // ========================================

    getNextNumeroVenda() {
        // Formato: V-YYYY-XXXX (Ex: V-2024-0001)
        const anoAtual = new Date().getFullYear();
        const prefix = `V-${anoAtual}-`;

        const last = this.db.prepare(`
            SELECT numero FROM vendas 
            WHERE numero LIKE ? 
            ORDER BY numero DESC LIMIT 1
        `).get(`${prefix}%`);

        let nextSeq = 1;
        if (last) {
            const parts = last.numero.split('-');
            if (parts.length === 3) {
                nextSeq = parseInt(parts[2]) + 1;
            }
        }

        return `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    createVenda(venda) {
        const id = venda.id || uuidv4();
        const stmt = this.db.prepare(`
            INSERT INTO vendas (
                id, numero, cliente_id, orcamento_id, data_venda, 
                valor, custo, costureira, instalacao, outros_custos, 
                lucro, observacoes, valor_entrada, falta_pagar, desconto
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            venda.numero,
            venda.cliente_id,
            venda.orcamento_id || null,
            venda.data_venda,
            venda.valor || 0,
            venda.custo || 0,
            venda.costureira || 0,
            venda.instalacao || 0,
            venda.outros_custos || 0,
            venda.lucro || 0,
            venda.observacoes,
            venda.valor_entrada || 0,
            venda.falta_pagar || 0,
            venda.desconto || 0
        );

        const newVenda = { ...venda, id };
        if (this.syncService) this.syncService.pushData('vendas', newVenda, 'INSERT');
        return newVenda;
    }

    getVendas() {
        return this.db.prepare(`
            SELECT v.*, c.nome as cliente_nome, o.numero as orcamento_numero
            FROM vendas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN orcamentos o ON v.orcamento_id = o.id
            ORDER BY v.data_venda DESC
        `).all();
    }

    getVendasByCliente(clienteId) {
        return this.db.prepare(`
            SELECT v.*, o.numero as orcamento_numero
            FROM vendas v
            LEFT JOIN orcamentos o ON v.orcamento_id = o.id
            WHERE v.cliente_id = ?
            ORDER BY v.data_venda DESC
        `).all(clienteId);
    }

    getVendaById(id) {
        return this.db.prepare(`
            SELECT v.*, c.nome as cliente_nome, o.numero as orcamento_numero
            FROM vendas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN orcamentos o ON v.orcamento_id = o.id
            WHERE v.id = ?
        `).get(id);
    }

    getVendaByOrcamentoId(orcamentoId) {
        return this.db.prepare(`
            SELECT v.*, c.nome as cliente_nome, o.numero as orcamento_numero
            FROM vendas v
            LEFT JOIN clientes c ON v.cliente_id = c.id
            LEFT JOIN orcamentos o ON v.orcamento_id = o.id
            WHERE v.orcamento_id = ?
        `).get(orcamentoId);
    }

    searchOrcamentos(termo) {
        const query = `%${termo}%`;
        return this.db.prepare(`
            SELECT o.*, c.nome as cliente_nome, c.cpf_cnpj as cliente_cpf_cnpj
            FROM orcamentos o
            LEFT JOIN clientes c ON o.cliente_id = c.id
            WHERE o.numero LIKE ? OR c.nome LIKE ? OR c.cpf_cnpj LIKE ?
            ORDER BY o.created_at DESC
        `).all(query, query, query);
    }

    getNextNumero() {
        const result = this.db.prepare(`
            SELECT MAX(CAST(SUBSTR(numero, 5) AS INTEGER)) as max_num 
            FROM orcamentos 
            WHERE numero LIKE 'ORC-%'
        `).get();

        const nextNum = (result.max_num || 0) + 1;
        return `ORC-${String(nextNum).padStart(4, '0')}`;
    }

    createOrcamento(orcamento) {
        const id = orcamento.id || uuidv4();
        const numero = orcamento.numero || this.getNextNumero();

        const stmt = this.db.prepare(`
            INSERT INTO orcamentos (id, numero, cliente_id, vendedor, status, valor_total, 
                                    observacoes, prazo_pagamento, prazo_entrega, garantia, pdf_path, sync_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            numero,
            orcamento.cliente_id || null,
            orcamento.vendedor || null,
            orcamento.status || 'Pendente',
            orcamento.valor_total || 0,
            orcamento.observacoes || null,
            orcamento.prazo_pagamento || null,
            orcamento.prazo_entrega || null,
            orcamento.garantia || null,
            orcamento.pdf_path || null,
            uuidv4()
        );

        const newOrcamento = { id, numero, ...orcamento };
        if (this.syncService) this.syncService.pushData('orcamentos', newOrcamento, 'INSERT');
        return newOrcamento;
    }

    updateOrcamento(id, orcamento) {
        // Buscar dados existentes primeiro para não sobrescrever com undefined
        const existing = this.db.prepare('SELECT * FROM orcamentos WHERE id = ?').get(id);
        if (!existing) {
            console.error('[DB] updateOrcamento: orçamento não encontrado:', id);
            return null;
        }

        // Mesclar: usar novo valor se fornecido, senão manter o existente
        const merged = {
            cliente_id: orcamento.cliente_id !== undefined ? orcamento.cliente_id : existing.cliente_id,
            vendedor: orcamento.vendedor !== undefined ? orcamento.vendedor : existing.vendedor,
            status: orcamento.status !== undefined ? orcamento.status : existing.status,
            valor_total: orcamento.valor_total !== undefined ? orcamento.valor_total : existing.valor_total,
            observacoes: orcamento.observacoes !== undefined ? orcamento.observacoes : existing.observacoes,
            prazo_pagamento: orcamento.prazo_pagamento !== undefined ? orcamento.prazo_pagamento : existing.prazo_pagamento,
            prazo_entrega: orcamento.prazo_entrega !== undefined ? orcamento.prazo_entrega : existing.prazo_entrega,
            garantia: orcamento.garantia !== undefined ? orcamento.garantia : existing.garantia,
            pdf_path: orcamento.pdf_path !== undefined ? orcamento.pdf_path : existing.pdf_path
        };

        console.log('[DB] updateOrcamento merged data:', JSON.stringify(merged));

        const stmt = this.db.prepare(`
            UPDATE orcamentos SET
                cliente_id = ?,
                vendedor = ?,
                status = ?,
                valor_total = ?,
                observacoes = ?,
                prazo_pagamento = ?,
                prazo_entrega = ?,
                garantia = ?,
                pdf_path = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(
            merged.cliente_id,
            merged.vendedor,
            merged.status,
            merged.valor_total,
            merged.observacoes,
            merged.prazo_pagamento,
            merged.prazo_entrega,
            merged.garantia,
            merged.pdf_path,
            id
        );

        const updatedOrcamento = { id, ...merged };
        if (this.syncService) this.syncService.pushData('orcamentos', updatedOrcamento, 'UPDATE');
        return updatedOrcamento;
    }

    deleteOrcamento(id) {
        // Primeiro deleta os itens
        this.db.prepare('DELETE FROM itens_orcamento WHERE orcamento_id = ?').run(id);
        // Depois deleta o orçamento
        this.db.prepare('DELETE FROM orcamentos WHERE id = ?').run(id);

        if (this.syncService) this.syncService.pushData('orcamentos', { id }, 'DELETE');
        return true;
    }

    updatePdfPath(id, pdfPath) {
        this.db.prepare(`
            UPDATE orcamentos SET
                pdf_path = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(pdfPath, id);
        return { id, pdf_path: pdfPath };
    }

    // ========================================
    // ITENS DO ORÇAMENTO
    // ========================================

    getItensOrcamento(orcamentoId) {
        return this.db.prepare('SELECT * FROM itens_orcamento WHERE orcamento_id = ?').all(orcamentoId);
    }

    saveItensOrcamento(orcamentoId, itens) {
        // 1. Obter itens antigos para saber o que deletar na nuvem
        const oldItems = this.getItensOrcamento(orcamentoId);

        // 2. Deletar itens existentes localmente
        this.db.prepare('DELETE FROM itens_orcamento WHERE orcamento_id = ?').run(orcamentoId);

        // 3. Sincronizar deleção com a nuvem
        if (this.syncService) {
            oldItems.forEach(item => {
                this.syncService.pushData('itens_orcamento', { id: item.id }, 'DELETE');
            });
        }

        // 4. Preparar inserção
        const stmt = this.db.prepare(`
            INSERT INTO itens_orcamento (id, orcamento_id, quantidade, descricao, valor_unitario, valor_total, categoria)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const savedItems = [];

        for (const item of itens) {
            const id = item.id || uuidv4(); // Garante ID
            const itemToSave = { ...item, id, orcamento_id: orcamentoId };

            stmt.run(
                id,
                orcamentoId,
                item.quantidade || 1,
                item.descricao,
                item.valor_unitario || 0,
                item.valor_total || 0,
                item.categoria || 'Outros'
            );

            savedItems.push(itemToSave);

            if (this.syncService) {
                this.syncService.pushData('itens_orcamento', itemToSave, 'INSERT');
            }
        }

        // Atualizar valor total do orçamento
        const total = itens.reduce((sum, item) => sum + (item.valor_total || 0), 0);
        this.db.prepare('UPDATE orcamentos SET valor_total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(total, orcamentoId);

        // Notificar sync do orçamento atualizado (valor total mudou)
        if (this.syncService) {
            const orcAtualizado = this.getOrcamentoById(orcamentoId);
            this.syncService.pushData('orcamentos', orcAtualizado, 'UPDATE');
        }

        return savedItems;
    }

    // Upsert de um único item de orçamento (usado pelo sync Realtime)
    upsertItemOrcamento(item) {
        // INSERT OR REPLACE garante que se o item já existe (mesmo ID), ele é sobrescrito
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO itens_orcamento (id, orcamento_id, quantidade, descricao, valor_unitario, valor_total, categoria)
            VALUES (@id, @orcamento_id, @quantidade, @descricao, @valor_unitario, @valor_total, @categoria)
        `);

        stmt.run({
            id: item.id,
            orcamento_id: item.orcamento_id,
            quantidade: item.quantidade || 1,
            descricao: item.descricao || '',
            valor_unitario: item.valor_unitario || 0,
            valor_total: item.valor_total || 0,
            categoria: item.categoria || null
        });

        console.log(`[DB] upsertItemOrcamento: item ${item.id} salvo para orçamento ${item.orcamento_id}`);
        return item;
    }

    // Deletar um único item de orçamento (usado pelo sync Realtime)
    deleteItemOrcamento(id) {
        this.db.prepare('DELETE FROM itens_orcamento WHERE id = ?').run(id);
        console.log(`[DB] deleteItemOrcamento: item ${id} removido`);
        return true;
    }

    // ========================================
    // FORNECEDORES
    // ========================================

    getFornecedores() {
        return this.db.prepare('SELECT * FROM fornecedores ORDER BY nome').all();
    }

    getFornecedorById(id) {
        return this.db.prepare('SELECT * FROM fornecedores WHERE id = ?').get(id);
    }

    createFornecedor(fornecedor) {
        const id = fornecedor.id || uuidv4();
        const stmt = this.db.prepare(`
            INSERT INTO fornecedores (
                id, nome, contato, telefone, email, endereco, categoria, observacoes, sync_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            fornecedor.nome,
            fornecedor.contato,
            fornecedor.telefone,
            fornecedor.email,
            fornecedor.endereco,
            fornecedor.categoria,
            fornecedor.observacoes,
            uuidv4()
        );

        const newFornecedor = { ...fornecedor, id };
        if (this.syncService) this.syncService.pushData('fornecedores', newFornecedor, 'INSERT');
        return newFornecedor;
    }

    updateFornecedor(id, fornecedor) {
        const stmt = this.db.prepare(`
            UPDATE fornecedores SET
                nome = ?, contato = ?, telefone = ?, email = ?, 
                endereco = ?, categoria = ?, observacoes = ?, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(
            fornecedor.nome,
            fornecedor.contato,
            fornecedor.telefone,
            fornecedor.email,
            fornecedor.endereco,
            fornecedor.categoria,
            fornecedor.observacoes,
            id
        );

        const updated = { ...fornecedor, id };
        if (this.syncService) this.syncService.pushData('fornecedores', updated, 'UPDATE');
        return updated;
    }

    deleteFornecedor(id) {
        this.db.prepare('DELETE FROM fornecedores WHERE id = ?').run(id);
        if (this.syncService) this.syncService.pushData('fornecedores', { id }, 'DELETE');
        return true;
    }

    // ========================================
    // CUSTOS
    // ========================================

    getCustos() {
        return this.db.prepare('SELECT * FROM custos ORDER BY data_vencimento DESC').all();
    }

    getCustoById(id) {
        return this.db.prepare('SELECT * FROM custos WHERE id = ?').get(id);
    }

    createCusto(custo) {
        const id = custo.id || uuidv4();
        const stmt = this.db.prepare(`
            INSERT INTO custos (
                id, descricao, categoria, fornecedor, valor, data_vencimento, 
                data_pagamento, status, observacoes, sync_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            custo.descricao,
            custo.categoria,
            custo.fornecedor,
            custo.valor || 0,
            custo.data_vencimento,
            custo.data_pagamento,
            custo.status || 'Pendente',
            custo.observacoes,
            uuidv4()
        );

        const newCusto = { ...custo, id };
        if (this.syncService) this.syncService.pushData('custos', newCusto, 'INSERT');
        return newCusto;
    }

    updateCusto(id, custo) {
        const stmt = this.db.prepare(`
            UPDATE custos SET
                descricao = ?, categoria = ?, fornecedor = ?, valor = ?, data_vencimento = ?, 
                data_pagamento = ?, status = ?, observacoes = ?, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        stmt.run(
            custo.descricao,
            custo.categoria,
            custo.fornecedor,
            custo.valor || 0,
            custo.data_vencimento,
            custo.data_pagamento,
            custo.status || 'Pendente',
            custo.observacoes,
            id
        );

        const updated = { ...custo, id };
        if (this.syncService) this.syncService.pushData('custos', updated, 'UPDATE');
        return updated;
    }

    deleteCusto(id) {
        this.db.prepare('DELETE FROM custos WHERE id = ?').run(id);
        if (this.syncService) this.syncService.pushData('custos', { id }, 'DELETE');
        return true;
    }

    // ========================================
    // ESTATÍSTICAS
    // ========================================

    getEstatisticas() {
        const total = this.db.prepare('SELECT COUNT(*) as count FROM orcamentos').get().count;
        const pendentes = this.db.prepare("SELECT COUNT(*) as count FROM orcamentos WHERE status = 'Pendente'").get().count;
        const aprovados = this.db.prepare("SELECT COUNT(*) as count FROM orcamentos WHERE status = 'Aprovado'").get().count;
        const reprovados = this.db.prepare("SELECT COUNT(*) as count FROM orcamentos WHERE status = 'Reprovado'").get().count;
        const valorTotal = this.db.prepare('SELECT SUM(valor_total) as total FROM orcamentos').get().total || 0;
        const valorAprovado = this.db.prepare("SELECT SUM(valor_total) as total FROM orcamentos WHERE status = 'Aprovado'").get().total || 0;

        const ultimosOrcamentos = this.db.prepare(`
            SELECT o.*, c.nome as cliente_nome
            FROM orcamentos o
            LEFT JOIN clientes c ON o.cliente_id = c.id
            ORDER BY o.created_at DESC
            LIMIT 5
        `).all();

        return {
            total,
            pendentes,
            aprovados,
            reprovados,
            valorTotal,
            valorAprovado,
            ultimosOrcamentos
        };
    }

    // ========================================
    // CONFIGURAÇÕES
    // ========================================

    getConfig(chave) {
        const result = this.db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave);
        return result ? result.valor : null;
    }

    setConfig(chave, valor) {
        this.db.prepare('INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)').run(chave, valor);
        return { chave, valor };
    }

    getAllConfig() {
        const rows = this.db.prepare('SELECT * FROM configuracoes').all();
        const config = {};
        for (const row of rows) {
            config[row.chave] = row.valor;
        }
        return config;
    }

    // ========================================
    // BACKUP
    // ========================================

    exportBackup(filePath) {
        try {
            this.db.backup(filePath);
            return { success: true, path: filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    importBackup(filePath) {
        try {
            // Fechar conexão atual
            this.db.close();

            // Copiar arquivo de backup para o local do banco
            const dbPath = this.getDbPath();
            fs.copyFileSync(filePath, dbPath);

            // Reabrir conexão
            this.db = new Database(dbPath);
            this.db.pragma('journal_mode = WAL');

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = AppDatabase;
