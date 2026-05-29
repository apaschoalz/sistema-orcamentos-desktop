const { contextBridge, ipcRenderer } = require('electron');

// Expõe APIs seguras para o renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Clientes
    getClientes: () => ipcRenderer.invoke('db:getClientes'),
    getClienteById: (id) => ipcRenderer.invoke('db:getClienteById', id),
    getClienteByCpfCnpj: (cpfCnpj) => ipcRenderer.invoke('db:getClienteByCpfCnpj', cpfCnpj),
    searchClientes: (termo) => ipcRenderer.invoke('db:searchClientes', termo),
    createCliente: (cliente) => ipcRenderer.invoke('db:createCliente', cliente),
    updateCliente: (id, cliente) => ipcRenderer.invoke('db:updateCliente', id, cliente),
    deleteCliente: (id) => ipcRenderer.invoke('db:deleteCliente', id),

    // Vendas
    createVenda: (venda) => ipcRenderer.invoke('db:createVenda', venda),
    updateVenda: (id, venda) => ipcRenderer.invoke('db:updateVenda', id, venda),
    deleteVenda: (id) => ipcRenderer.invoke('db:deleteVenda', id),
    getVendas: () => ipcRenderer.invoke('db:getVendas'),
    getVendasByCliente: (clienteId) => ipcRenderer.invoke('db:getVendasByCliente', clienteId),
    getVendaById: (id) => ipcRenderer.invoke('db:getVendaById', id),
    getNextNumeroVenda: () => ipcRenderer.invoke('db:getNextNumeroVenda'),
    getVendaByOrcamentoId: (orcamentoId) => ipcRenderer.invoke('db:getVendaByOrcamentoId', orcamentoId),

    // Orçamentos
    getOrcamentos: () => ipcRenderer.invoke('db:getOrcamentos'),
    getOrcamentoById: (id) => ipcRenderer.invoke('db:getOrcamentoById', id),
    getOrcamentosByCliente: (clienteId) => ipcRenderer.invoke('db:getOrcamentosByCliente', clienteId),
    searchOrcamentos: (termo) => ipcRenderer.invoke('db:searchOrcamentos', termo),
    createOrcamento: (orcamento) => ipcRenderer.invoke('db:createOrcamento', orcamento),
    updateOrcamento: (id, orcamento) => ipcRenderer.invoke('db:updateOrcamento', id, orcamento),
    deleteOrcamento: (id) => ipcRenderer.invoke('db:deleteOrcamento', id),
    getNextNumero: () => ipcRenderer.invoke('db:getNextNumero'),
    getNextNumeroRemoto: () => ipcRenderer.invoke('db:getNextNumeroRemoto'),
    syncItensFromRemote: (orcamentoId) => ipcRenderer.invoke('db:syncItensFromRemote', orcamentoId),

    // Itens do orçamento
    getItensOrcamento: (orcamentoId) => ipcRenderer.invoke('db:getItensOrcamento', orcamentoId),
    saveItensOrcamento: (orcamentoId, itens) => ipcRenderer.invoke('db:saveItensOrcamento', orcamentoId, itens),

    // Estatísticas
    getEstatisticas: () => ipcRenderer.invoke('db:getEstatisticas'),

    // Backup
    exportBackup: () => ipcRenderer.invoke('db:exportBackup'),
    importBackup: () => ipcRenderer.invoke('db:importBackup'),
    exportClientesCSV: () => ipcRenderer.invoke('db:exportClientesCSV'),

    // Configurações
    getConfig: (chave) => ipcRenderer.invoke('db:getConfig', chave),
    setConfig: (chave, valor) => ipcRenderer.invoke('db:setConfig', chave, valor),
    getAllConfig: () => ipcRenderer.invoke('db:getAllConfig'),

    // Fornecedores
    getFornecedores: () => ipcRenderer.invoke('db:getFornecedores'),
    getFornecedorById: (id) => ipcRenderer.invoke('db:getFornecedorById', id),
    createFornecedor: (fornecedor) => ipcRenderer.invoke('db:createFornecedor', fornecedor),
    updateFornecedor: (id, fornecedor) => ipcRenderer.invoke('db:updateFornecedor', id, fornecedor),
    deleteFornecedor: (id) => ipcRenderer.invoke('db:deleteFornecedor', id),

    // Pagamentos a Receber
    getPagamentosReceber: () => ipcRenderer.invoke('db:getPagamentosReceber'),
    getPagamentoReceberById: (id) => ipcRenderer.invoke('db:getPagamentoReceberById', id),
    createPagamentoReceber: (pagamento) => ipcRenderer.invoke('db:createPagamentoReceber', pagamento),
    updatePagamentoReceber: (id, pagamento) => ipcRenderer.invoke('db:updatePagamentoReceber', id, pagamento),
    deletePagamentoReceber: (id) => ipcRenderer.invoke('db:deletePagamentoReceber', id),

    // Custos
    getCustos: () => ipcRenderer.invoke('db:getCustos'),
    getCustoById: (id) => ipcRenderer.invoke('db:getCustoById', id),
    createCusto: (custo) => ipcRenderer.invoke('db:createCusto', custo),
    updateCusto: (id, custo) => ipcRenderer.invoke('db:updateCusto', id, custo),
    deleteCusto: (id) => ipcRenderer.invoke('db:deleteCusto', id),

    // App info
    getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),

    // Paths
    getPDFPath: () => ipcRenderer.invoke('app:getPDFPath'),
    getAppPath: () => ipcRenderer.invoke('app:getAppPath'),
    openPDF: (pdfPath) => ipcRenderer.invoke('app:openPDF', pdfPath),
    generatePDF: (orcamentoId) => ipcRenderer.invoke('app:generatePDF', orcamentoId),

    // Sincronização Supabase
    syncInitialize: () => ipcRenderer.invoke('sync:initialize'),
    syncCheckConnection: () => ipcRenderer.invoke('sync:checkConnection'),
    syncBackup: () => ipcRenderer.invoke('sync:backup'),
    syncRestore: () => ipcRenderer.invoke('sync:restore'),

    // Eventos de sync em tempo real (nuvem -> UI)
    onSyncDataChanged: (callback) => ipcRenderer.on('sync:dataChanged', callback),
    removeSyncDataChanged: (callback) => ipcRenderer.removeListener('sync:dataChanged', callback)
});
