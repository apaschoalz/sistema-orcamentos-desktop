const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const Database = require('./database');
const SupabaseSync = require('./supabase-sync');
const PDFGenerator = require('./pdf-generator');

// ============================================================
// MODO DE TESTE E2E: Usa pasta temporária isolada
// Garante que os testes automatizados não toquem no banco real
// ============================================================
if (process.env.ELECTRON_USER_DATA) {
    app.setPath('userData', process.env.ELECTRON_USER_DATA);
}

let mainWindow;
let db;
let supabaseSync;
let pdfGenerator;

// Configurar log em arquivo para debug
const logPath = path.join(app.getPath('userData'), 'app-debug.log');
const logStream = fs.createWriteStream(logPath, { flags: 'a' });
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = (...args) => {
    const msg = `[LOG] ${new Date().toISOString()} - ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
    logStream.write(msg);
    originalConsoleLog(...args);
};
console.error = (...args) => {
    const msg = `[ERROR] ${new Date().toISOString()} - ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
    logStream.write(msg);
    originalConsoleError(...args);
};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            devTools: !app.isPackaged
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        title: 'Entre Tramas - Sistema de Orçamentos',
        autoHideMenuBar: true
    });

    // app.isPackaged = false quando rodando via "electron ." (dev)
    //                = true  quando é o app instalado (produção)
    if (!app.isPackaged) {
        mainWindow.loadURL('http://localhost:3000');
        // DevTools opcional em dev — F12 para abrir/fechar
    } else {
        // Em produção, carrega o arquivo HTML buildado
        mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
        // DevTools fechado por padrão em produção (use F12 para abrir)
    }

    // F12 abre DevTools apenas em desenvolvimento
    if (!app.isPackaged) {
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12' && input.type === 'keyDown') {
                mainWindow.webContents.toggleDevTools();
                event.preventDefault();
            }
        });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    try {
        // Inicializar banco de dados
        db = new Database();
        db.initialize();

        // Inicializar sincronização Supabase
        supabaseSync = new SupabaseSync(db);
        db.setSyncService(supabaseSync); // Injeção de dependência cruzada
        supabaseSync.initialize();
        pdfGenerator = new PDFGenerator();

        createWindow();
        supabaseSync.setMainWindow(mainWindow);

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });

        // ============================================================
        // AUTO-UPDATE — electron-updater
        // ============================================================
        autoUpdater.logger = {
            info(msg)  { console.log('[AutoUpdater]', msg); },
            warn(msg)  { console.warn('[AutoUpdater]', msg); },
            error(msg) { console.error('[AutoUpdater]', msg); }
        };
        autoUpdater.autoDownload = true;        // baixa em segundo plano automaticamente
        autoUpdater.autoInstallOnAppQuit = true; // instala na próxima vez que fechar

        // 1) Update encontrado → avisa imediatamente para o usuário não fechar
        autoUpdater.on('update-available', (info) => {
            console.log('[AutoUpdater] Nova versão disponível:', info.version);
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: `Atualização Disponível — v${info.version}`,
                message: `Nova versão ${info.version} encontrada!`,
                detail: 'O download está sendo feito em segundo plano (~90 MB).\nQuando terminar, você receberá outra mensagem para reiniciar.\n\nDeixe o app aberto por alguns minutos.',
                buttons: ['OK, aguardar'],
                defaultId: 0
            }).catch(() => {});
        });

        // 2) Progresso do download → envia para UI (barra de progresso se quiser)
        autoUpdater.on('download-progress', (progress) => {
            const pct = Math.round(progress.percent);
            console.log(`[AutoUpdater] Download: ${pct}%`);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update:progress', { percent: pct });
            }
        });

        // 3) Download concluído → mostra diálogo para reiniciar
        autoUpdater.on('update-downloaded', (info) => {
            console.log('[AutoUpdater] Download concluído:', info.version);
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: `Atualização Pronta — v${info.version}`,
                message: `v${info.version} baixada e pronta para instalar!`,
                detail: 'Clique em "Reiniciar Agora" para aplicar a atualização imediatamente,\nou clique em "Depois" — ela será instalada automaticamente quando você fechar o app.',
                buttons: ['Reiniciar Agora', 'Instalar ao Fechar'],
                defaultId: 0
            }).then((result) => {
                if (result.response === 0) {
                    autoUpdater.quitAndInstall(false, true);
                }
            }).catch(() => {});
        });

        // 4) Erro — loga e avisa se for erro crítico (não de rede)
        autoUpdater.on('error', (err) => {
            console.error('[AutoUpdater] Erro:', err?.message || err);
            const msg = (err?.message || '').toLowerCase();
            const isNetworkErr = msg.includes('net::') || msg.includes('enotfound') ||
                                 msg.includes('econnrefused') || msg.includes('etimedout') ||
                                 msg.includes('fetch') || msg.includes('network');
            if (!isNetworkErr) {
                console.error('[AutoUpdater] Erro não-rede — verificar log.');
            }
        });

        autoUpdater.on('checking-for-update', () => {
            console.log('[AutoUpdater] Verificando atualizações...');
        });

        autoUpdater.on('update-not-available', (info) => {
            console.log('[AutoUpdater] Versão atual é a mais recente:', info?.version);
        });

        // Verificar APENAS em app empacotado (não em npm start / desenvolvimento)
        if (app.isPackaged) {
            // Primeira verificação: aguardar 8s para o app estabilizar
            setTimeout(() => {
                autoUpdater.checkForUpdates().catch(e =>
                    console.error('[AutoUpdater] Falha na verificação inicial:', e?.message)
                );
            }, 8000);

            // Verificação periódica a cada 2 horas
            setInterval(() => {
                autoUpdater.checkForUpdates().catch(e =>
                    console.error('[AutoUpdater] Falha na verificação periódica:', e?.message)
                );
            }, 2 * 60 * 60 * 1000);
        }

        // IPC para verificação manual via botão na tela de Configurações
        ipcMain.handle('app:checkForUpdates', async () => {
            if (!app.isPackaged) {
                return { status: 'dev', message: 'Auto-update desabilitado em desenvolvimento.' };
            }
            try {
                const result = await autoUpdater.checkForUpdates();
                if (result && result.updateInfo) {
                    const current = app.getVersion();
                    const latest = result.updateInfo.version;
                    if (latest !== current) {
                        return { status: 'available', version: latest };
                    }
                }
                return { status: 'latest', version: app.getVersion() };
            } catch (e) {
                console.error('[AutoUpdater] Erro manual:', e?.message);
                return { status: 'error', message: e.message };
            }
        });

    } catch (error) {
        console.error('Erro fatal na inicialização:', error);
        dialog.showErrorBox('Erro Fatal', `Ocorreu um erro ao iniciar o sistema:\n${error.message}\n\nDetalhes: ${error.stack}`);
        app.quit();
    }
}).catch(error => {
    console.error('Erro desconhecido na inicialização:', error);
    dialog.showErrorBox('Erro Fatal', `Erro desconhecido na inicialização:\n${error.message}`);
    app.quit();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ========================================
// IPC Handlers - Comunicação com Renderer
// ========================================

// Clientes
ipcMain.handle('db:getClientes', async () => {
    return db.getClientes();
});

ipcMain.handle('db:getClienteById', async (event, id) => {
    return db.getClienteById(id);
});

ipcMain.handle('db:searchClientes', async (event, termo) => {
    return db.searchClientes(termo);
});

ipcMain.handle('db:createCliente', async (event, cliente) => {
    console.log('[Main] createCliente input:', JSON.stringify(cliente));
    const result = db.createCliente(cliente);
    console.log('[Main] createCliente result:', JSON.stringify(result));
    return result;
});

ipcMain.handle('db:updateCliente', async (event, id, cliente) => {
    return db.updateCliente(id, cliente);
});

ipcMain.handle('db:deleteCliente', async (event, id) => {
    console.log('[Main] deleteCliente input:', id);
    try {
        const result = db.deleteCliente(id);
        return result;
    } catch (error) {
        console.error('[Main] Erro ao excluir cliente:', error.message);
        throw error;
    }
});

ipcMain.handle('db:getClienteByCpfCnpj', async (event, cpfCnpj) => {
    return db.getClienteByCpfCnpj(cpfCnpj);
});

// Vendas
ipcMain.handle('db:createVenda', async (event, venda) => {
    console.log('[Main] createVenda input:', JSON.stringify(venda));
    const result = db.createVenda(venda);
    return result;
});

ipcMain.handle('db:updateVenda', async (event, id, venda) => {
    console.log('[Main] updateVenda input:', id, JSON.stringify(venda));
    const result = db.updateVenda(id, venda);
    return result;
});

ipcMain.handle('db:deleteVenda', async (event, id) => {
    console.log('[Main] deleteVenda input:', id);
    return db.deleteVenda(id);
});

ipcMain.handle('db:getVendaByOrcamentoId', async (event, orcamentoId) => {
    return db.getVendaByOrcamentoId(orcamentoId);
});

ipcMain.handle('db:getVendas', async () => {
    return db.getVendas();
});

ipcMain.handle('db:getVendasByCliente', async (event, clienteId) => {
    return db.getVendasByCliente(clienteId);
});

ipcMain.handle('db:getNextNumeroVenda', async () => {
    return db.getNextNumeroVenda();
});

ipcMain.handle('db:getVendaById', async (event, id) => {
    return db.getVendaById(id);
});

// Orçamentos
ipcMain.handle('db:getOrcamentos', async () => {
    return db.getOrcamentos();
});

ipcMain.handle('db:getOrcamentoById', async (event, id) => {
    return db.getOrcamentoById(id);
});

ipcMain.handle('db:getOrcamentosByCliente', async (event, clienteId) => {
    return db.getOrcamentosByCliente(clienteId);
});

ipcMain.handle('db:searchOrcamentos', async (event, termo) => {
    return db.searchOrcamentos(termo);
});

ipcMain.handle('db:createOrcamento', async (event, orcamento) => {
    console.log('[Main] createOrcamento:', JSON.stringify(orcamento));

    // Reservar número centralmente no Supabase se disponível (solução definitiva para evitar gaps)
    if (!orcamento.numero && supabaseSync && supabaseSync.checkConnection()) {
        const numeroReservado = await supabaseSync.reservarNumeroOrcamento();
        if (numeroReservado) {
            orcamento = { ...orcamento, numero: numeroReservado };
            console.log('[Main] Número reservado no Supabase:', numeroReservado);
        }
    }

    const result = db.createOrcamento(orcamento);
    console.log('[Main] createOrcamento result:', JSON.stringify(result));
    return result;
});

ipcMain.handle('db:updateOrcamento', async (event, id, orcamento) => {
    console.log('[Main] updateOrcamento id:', id, 'data:', JSON.stringify(orcamento));
    const result = db.updateOrcamento(id, orcamento);
    console.log('[Main] updateOrcamento result:', JSON.stringify(result));
    return result;
});

ipcMain.handle('db:deleteOrcamento', async (event, id) => {
    return db.deleteOrcamento(id);
});

ipcMain.handle('db:getNextNumero', async () => {
    return db.getNextNumero();
});

// Puxa itens de um orçamento direto do Supabase e faz upsert local
// Chamado quando o terminal abre um orçamento para edição (garante itens atualizados)
ipcMain.handle('db:syncItensFromRemote', async (event, orcamentoId) => {
    if (supabaseSync && supabaseSync.checkConnection()) {
        await supabaseSync.syncItensFromRemote(orcamentoId);
    }
    return db.getItensOrcamento(orcamentoId);
});

ipcMain.handle('db:getNextNumeroRemoto', async () => {
    if (supabaseSync && supabaseSync.checkConnection()) {
        return await supabaseSync.getNextNumeroRemoto();
    }
    return db.getNextNumero();
});

// Itens do orçamento
ipcMain.handle('db:getItensOrcamento', async (event, orcamentoId) => {
    return db.getItensOrcamento(orcamentoId);
});

ipcMain.handle('db:saveItensOrcamento', async (event, orcamentoId, itens) => {
    // 1. Salvar localmente (síncrono)
    const result = db.saveItensOrcamento(orcamentoId, itens);

    // 2. Push batch confiável para o Supabase (aguarda resposta, com retry em caso de offline)
    if (supabaseSync && supabaseSync.checkConnection()) {
        await supabaseSync.pushBatchItens(orcamentoId, result);
    }

    return result;
});

// Estatísticas
ipcMain.handle('db:getEstatisticas', async () => {
    return db.getEstatisticas();
});

// Exportar clientes CSV
ipcMain.handle('db:exportClientesCSV', async () => {
    try {
        // Buscar apenas clientes que têm pelo menos um orçamento
        const clientes = db.getClientesComOrcamento();

        // Montar linhas CSV
        const rows = clientes.map(c => {
            const nomes = (c.nome || '').trim().split(/\s+/);
            const firstName = nomes[0] || '';
            const lastName = nomes.length > 1 ? nomes.slice(1).join(' ') : '';

            // Formatar telefone: remover tudo que não seja dígito e adicionar +55 se necessário
            let phone = (c.telefone || '').replace(/\D/g, '');
            if (phone && !phone.startsWith('55')) {
                phone = '55' + phone;
            }
            if (phone) phone = '+' + phone;

            return {
                Phone: phone,
                'First Name': firstName,
                'Last Name': lastName,
                Email: c.email || ''
            };
        });

        const csvEscape = (val) => {
            const s = String(val ?? '');
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        };

        const header = 'Phone,First Name,Last Name,Email';
        const lines = rows.map(r =>
            [r.Phone, r['First Name'], r['Last Name'], r.Email].map(csvEscape).join(',')
        );
        const csvContent = [header, ...lines].join('\r\n') + '\r\n';

        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Exportar Clientes CSV',
            defaultPath: `clientes_${new Date().toISOString().split('T')[0]}.csv`,
            filters: [{ name: 'CSV', extensions: ['csv'] }]
        });

        if (filePath) {
            fs.writeFileSync(filePath, csvContent, 'utf8');
            return { success: true, path: filePath, total: rows.length };
        }
        return { success: false, cancelled: true };
    } catch (error) {
        console.error('Erro ao exportar CSV:', error);
        return { success: false, error: error.message };
    }
});

// Backup
ipcMain.handle('db:exportBackup', async () => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Exportar Backup',
        defaultPath: `backup_orcamentos_${new Date().toISOString().split('T')[0]}.db`,
        filters: [{ name: 'Database', extensions: ['db'] }]
    });

    if (filePath) {
        return db.exportBackup(filePath);
    }
    return null;
});

ipcMain.handle('db:importBackup', async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Importar Backup',
        filters: [{ name: 'Database', extensions: ['db'] }],
        properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
        return db.importBackup(filePaths[0]);
    }
    return null;
});

// Configurações
ipcMain.handle('db:getConfig', async (event, chave) => {
    return db.getConfig(chave);
});

ipcMain.handle('db:setConfig', async (event, chave, valor) => {
    const result = db.setConfig(chave, valor);
    // Sincronizar configurações compartilhadas com o Supabase (exceto credenciais)
    const CHAVES_LOCAIS = new Set(['supabase.url', 'supabase.anon_key', 'admin.password']);
    if (supabaseSync && supabaseSync.checkConnection() && !CHAVES_LOCAIS.has(chave)) {
        try {
            await supabaseSync.supabase
                .from('configuracoes')
                .upsert({ chave, valor }, { onConflict: 'chave' });
        } catch (e) {
            console.warn('[setConfig] Erro ao sincronizar config com Supabase:', e.message);
        }
    }
    return result;
});

ipcMain.handle('db:getAllConfig', async () => {
    const cfg = db.getAllConfig();
    delete cfg['admin.password']; // nunca expor a senha ao renderer
    return cfg;
});

// Verifica senha de admin — comparação ocorre no processo principal,
// nunca exposta no bundle React.
// Se nenhuma senha estiver configurada no banco, libera o acesso
// para o usuário entrar em Configurações e definir uma nova.
ipcMain.handle('db:checkAdminPassword', async (event, tentativa) => {
    const stored = db.getConfig('admin.password');
    if (!stored) return true;
    return tentativa === stored;
});

ipcMain.handle('db:isAdminPasswordSet', async () => {
    return !!db.getConfig('admin.password');
});

// Versão do app
ipcMain.handle('app:getVersion', () => app.getVersion());

// PDF Path
ipcMain.handle('app:getPDFPath', async () => {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'pdfs');
});

ipcMain.handle('app:getAppPath', async () => {
    return app.getPath('userData');
});

// Abrir PDF
ipcMain.handle('app:openPDF', async (event, pdfPath) => {
    try {
        const fs = require('fs');
        if (fs.existsSync(pdfPath)) {
            await shell.openPath(pdfPath);
            return { success: true };
        } else {
            return { success: false, error: 'Arquivo não encontrado' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Gerar PDF
ipcMain.handle('app:generatePDF', async (event, orcamentoId) => {
    try {
        // Buscar dados completos do orçamento
        const orcamento = db.getOrcamentoById(orcamentoId);
        if (!orcamento) {
            return { success: false, error: 'Orçamento não encontrado' };
        }

        // Buscar cliente
        const cliente = orcamento.cliente_id ? db.getClienteById(orcamento.cliente_id) : {
            nome: orcamento.cliente_nome,
            email: orcamento.cliente_email,
            telefone: orcamento.cliente_telefone,
            cpf_cnpj: orcamento.cliente_cpf_cnpj,
            endereco: orcamento.cliente_endereco,
            bairro: orcamento.cliente_bairro,
            cidade: orcamento.cliente_cidade,
            cep: orcamento.cliente_cep,
            condominio: orcamento.cliente_condominio
        };

        // Buscar itens
        const itens = db.getItensOrcamento(orcamentoId);

        // Definir caminho de saída
        const pdfDir = path.join(app.getPath('userData'), 'pdfs');
        if (!fs.existsSync(pdfDir)) {
            fs.mkdirSync(pdfDir, { recursive: true });
        }

        const nomeArquivo = `Orcamento_${orcamento.numero}_${(cliente.nome || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const outputPath = path.join(pdfDir, nomeArquivo);

        // Gerar PDF
        await pdfGenerator.gerarPDF(orcamento, cliente, itens, outputPath);

        // Atualizar APENAS o pdf_path do orçamento (não zerar os outros campos!)
        db.updatePdfPath(orcamentoId, outputPath);

        return { success: true, path: outputPath };

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        return { success: false, error: error.message };
    }
});



// ========================================
// Fornecedores
// ========================================

ipcMain.handle('db:getFornecedores', async () => {
    return db.getFornecedores();
});

ipcMain.handle('db:getFornecedorById', async (event, id) => {
    return db.getFornecedorById(id);
});

ipcMain.handle('db:createFornecedor', async (event, fornecedor) => {
    return db.createFornecedor(fornecedor);
});

ipcMain.handle('db:updateFornecedor', async (event, id, fornecedor) => {
    return db.updateFornecedor(id, fornecedor);
});

ipcMain.handle('db:deleteFornecedor', async (event, id) => {
    return db.deleteFornecedor(id);
});

// ========================================
// Custos
// ========================================

ipcMain.handle('db:getCustos', async () => {
    return db.getCustos();
});

ipcMain.handle('db:getCustoById', async (event, id) => {
    return db.getCustoById(id);
});

ipcMain.handle('db:createCusto', async (event, custo) => {
    return db.createCusto(custo);
});

ipcMain.handle('db:updateCusto', async (event, id, custo) => {
    return db.updateCusto(id, custo);
});

ipcMain.handle('db:deleteCusto', async (event, id) => {
    return db.deleteCusto(id);
});

// ========================================
// Pagamentos a Receber
// ========================================

ipcMain.handle('db:getPagamentosReceber', async () => {
    return db.getPagamentosReceber();
});

ipcMain.handle('db:getPagamentoReceberById', async (event, id) => {
    return db.getPagamentoReceberById(id);
});

ipcMain.handle('db:createPagamentoReceber', async (event, pagamento) => {
    return db.createPagamentoReceber(pagamento);
});

ipcMain.handle('db:updatePagamentoReceber', async (event, id, pagamento) => {
    return db.updatePagamentoReceber(id, pagamento);
});

ipcMain.handle('db:deletePagamentoReceber', async (event, id) => {
    return db.deletePagamentoReceber(id);
});

// ========================================
// Sincronização Supabase
// ========================================

ipcMain.handle('sync:initialize', async () => {
    return supabaseSync.initialize();
});

ipcMain.handle('sync:checkConnection', async () => {
    return supabaseSync.checkConnection();
});

ipcMain.handle('sync:backup', async () => {
    return await supabaseSync.backup();
});

ipcMain.handle('sync:restore', async () => {
    return await supabaseSync.restore();
});
