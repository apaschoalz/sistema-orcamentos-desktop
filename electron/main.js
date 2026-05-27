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
            devTools: true  // Habilitar DevTools em produção
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        title: 'Entre Tramas - Sistema de Orçamentos',
        autoHideMenuBar: true
    });

    // Em desenvolvimento, carrega do servidor local
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        // Em produção, carrega o arquivo HTML buildado
        mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
        // DevTools fechado por padrão em produção (use F12 para abrir)
    }

    // Atalho F12 para alternar DevTools
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' && input.type === 'keyDown') {
            mainWindow.webContents.toggleDevTools();
            event.preventDefault();
        }
    });

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

        // Configurar e iniciar a verificação de atualizações (Auto-Update)
        autoUpdater.logger = {
            info(msg) { console.log('[AutoUpdater]', msg); },
            warn(msg) { console.warn('[AutoUpdater]', msg); },
            error(msg) { console.error('[AutoUpdater]', msg); }
        };
        autoUpdater.autoDownload = true; // Baixa automaticamente se encontrar update
        autoUpdater.autoInstallOnAppQuit = true; // Instala ao fechar o app

        // Ouve eventos do autoUpdater para avisar o usuário, se quiser
        autoUpdater.on('update-downloaded', (info) => {
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Atualização Pronta',
                message: 'Uma nova versão do sistema foi baixada em segundo plano.',
                detail: 'A atualização será instalada automaticamente quando você fechar o aplicativo. Ou você pode reiniciar agora mesmo para instalar.',
                buttons: ['Reiniciar e Instalar Agora', 'Instalar Depois (Ao Fechar)']
            }).then((result) => {
                if (result.response === 0) {
                    autoUpdater.quitAndInstall();
                }
            });
        });

        autoUpdater.on('error', (err) => {
            console.error('Erro no AutoUpdater:', err);
        });

        // Tentar buscar atualização apenas se não for ambiente de desenvolvimento
        if (process.env.NODE_ENV !== 'development') {
            autoUpdater.checkForUpdatesAndNotify();
        }

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
    return db.saveItensOrcamento(orcamentoId, itens);
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
    return db.setConfig(chave, valor);
});

ipcMain.handle('db:getAllConfig', async () => {
    return db.getAllConfig();
});

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
