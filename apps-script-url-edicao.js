/**
 * Sistema de Orçamentos - Apps Script
 * 
 * Este script captura a URL de edição do Google Forms
 * e grava automaticamente na planilha.
 * 
 * INSTALAÇÃO:
 * 1. Abra a planilha conectada ao Forms
 * 2. Vá em Extensões > Apps Script
 * 3. Cole este código
 * 4. Configure o gatilho (trigger) para rodar no envio do formulário
 */

// ========================================
// CONFIGURAÇÃO - AJUSTE CONFORME NECESSÁRIO
// ========================================

const CONFIG = {
    // Nome da aba onde as respostas são gravadas
    sheetName: 'Respostas ao formulário 1',

    // Número da coluna onde gravar a URL de edição (K = 11)
    editUrlColumn: 11,

    // Número da coluna do ID do orçamento (J = 10)
    idColumn: 10
};

// ========================================
// FUNÇÃO PRINCIPAL - EXECUTADA NO ENVIO DO FORMULÁRIO
// ========================================

/**
 * Gatilho que roda automaticamente quando o formulário é enviado.
 * Captura a URL de edição e grava na planilha.
 * 
 * @param {Object} e - Evento do formulário
 */
function onFormSubmit(e) {
    try {
        // Obter a planilha ativa
        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = spreadsheet.getSheetByName(CONFIG.sheetName);

        if (!sheet) {
            console.error('Aba não encontrada: ' + CONFIG.sheetName);
            return;
        }

        // Obter o formulário conectado à planilha
        const formUrl = spreadsheet.getFormUrl();

        if (!formUrl) {
            console.error('Nenhum formulário conectado a esta planilha');
            return;
        }

        const form = FormApp.openByUrl(formUrl);

        // Obter todas as respostas do formulário
        const responses = form.getResponses();

        if (responses.length === 0) {
            console.log('Nenhuma resposta encontrada');
            return;
        }

        // Obter a última resposta (a que acabou de ser enviada)
        const lastResponse = responses[responses.length - 1];

        // Obter a URL de edição
        const editUrl = lastResponse.getEditResponseUrl();

        // Encontrar a última linha preenchida na planilha
        const lastRow = sheet.getLastRow();

        // Gravar a URL de edição na coluna configurada
        sheet.getRange(lastRow, CONFIG.editUrlColumn).setValue(editUrl);

        console.log('URL de edição gravada com sucesso na linha ' + lastRow);

    } catch (error) {
        console.error('Erro ao processar formulário: ' + error.message);
    }
}

// ========================================
// FUNÇÃO AUXILIAR - PROCESSAR RESPOSTAS ANTERIORES
// ========================================

/**
 * Função para processar formulários já existentes que não têm URL de edição.
 * Execute manualmente para preencher URLs antigas.
 * 
 * ATENÇÃO: Execute apenas uma vez se tiver respostas antigas sem URL.
 */
function processarRespostasAntigas() {
    try {
        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = spreadsheet.getSheetByName(CONFIG.sheetName);

        if (!sheet) {
            SpreadsheetApp.getUi().alert('Aba não encontrada: ' + CONFIG.sheetName);
            return;
        }

        const formUrl = spreadsheet.getFormUrl();

        if (!formUrl) {
            SpreadsheetApp.getUi().alert('Nenhum formulário conectado');
            return;
        }

        const form = FormApp.openByUrl(formUrl);
        const responses = form.getResponses();

        // Para cada resposta, gravar a URL de edição
        for (let i = 0; i < responses.length; i++) {
            const response = responses[i];
            const editUrl = response.getEditResponseUrl();
            const rowNumber = i + 2; // +2 porque linha 1 é cabeçalho

            // Verificar se já tem URL nesta linha
            const currentUrl = sheet.getRange(rowNumber, CONFIG.editUrlColumn).getValue();

            if (!currentUrl || currentUrl === '') {
                sheet.getRange(rowNumber, CONFIG.editUrlColumn).setValue(editUrl);
                console.log('URL adicionada na linha ' + rowNumber);
            }
        }

        SpreadsheetApp.getUi().alert('Processamento concluído! ' + responses.length + ' respostas verificadas.');

    } catch (error) {
        SpreadsheetApp.getUi().alert('Erro: ' + error.message);
    }
}

// ========================================
// MENU PERSONALIZADO
// ========================================

/**
 * Adiciona menu personalizado na planilha
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();

    ui.createMenu('🔧 Sistema de Orçamentos')
        .addItem('📋 Processar Respostas Antigas', 'processarRespostasAntigas')
        .addItem('📊 Ver Estatísticas', 'mostrarEstatisticas')
        .addToUi();
}

/**
 * Mostra estatísticas básicas do sistema
 */
function mostrarEstatisticas() {
    try {
        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = spreadsheet.getSheetByName(CONFIG.sheetName);

        if (!sheet) {
            SpreadsheetApp.getUi().alert('Aba não encontrada');
            return;
        }

        const lastRow = sheet.getLastRow();
        const totalOrcamentos = lastRow - 1; // -1 pelo cabeçalho

        // Contar por status (assumindo coluna H = status)
        const statusRange = sheet.getRange('H2:H' + lastRow).getValues();

        let pendentes = 0;
        let aprovados = 0;
        let reprovados = 0;

        statusRange.forEach(row => {
            const status = row[0].toString().toLowerCase();
            if (status.includes('pendente')) pendentes++;
            if (status.includes('aprovado')) aprovados++;
            if (status.includes('reprovado')) reprovados++;
        });

        const mensagem = `📊 ESTATÍSTICAS DO SISTEMA

Total de Orçamentos: ${totalOrcamentos}

📌 Pendentes: ${pendentes}
✅ Aprovados: ${aprovados}
❌ Reprovados: ${reprovados}`;

        SpreadsheetApp.getUi().alert(mensagem);

    } catch (error) {
        SpreadsheetApp.getUi().alert('Erro: ' + error.message);
    }
}
