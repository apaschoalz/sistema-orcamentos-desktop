/**
 * GERADOR DE PDF DE ORÇAMENTO
 * 
 * Este script gera automaticamente um PDF formatado
 * quando um formulário é enviado.
 * 
 * INSTALAÇÃO:
 * 1. Abra a planilha conectada ao Forms
 * 2. Vá em Extensões > Apps Script
 * 3. Cole este código (pode adicionar ao código existente)
 * 4. Crie um Google Docs como template (instruções abaixo)
 * 5. Configure o ID do template na variável TEMPLATE_ID
 * 6. Configure o gatilho para rodar no envio do formulário
 */

// ========================================
// CONFIGURAÇÃO - AJUSTE CONFORME NECESSÁRIO
// ========================================

const PDF_CONFIG = {
    // ID do documento Google Docs que será usado como template
    // Para obter: Abra o Doc > copie o ID da URL (entre /d/ e /edit)
    templateId: 'COLE_AQUI_O_ID_DO_TEMPLATE',

    // ID da pasta onde os PDFs serão salvos
    // Para obter: Abra a pasta no Drive > copie o ID da URL
    folderId: 'COLE_AQUI_O_ID_DA_PASTA',

    // Dados da empresa
    empresa: {
        nome: 'Entre Tramas',
        subtitulo: '— Interiores —',
        cnpj: '62.856.649/0001-66',
        endereco: 'Rua Ipiranga, 575 - Centro',
        telefone: '(19) 99387-3947',
        instagram: 'Entretramas.interiores',
        email: 'entretramasinteriores@gmail.com'
    },

    // Nome do vendedor padrão
    vendedor: 'Felipe Ribeiro',

    // Observações padrão
    observacoesPadrao: {
        prazoPagamento: 'Em até 6x sem juros no cartão.',
        prazoEntrega: '20 dias.',
        garantia: '*Garantia de cinco anos para o motor e de um ano para defeitos de fabricação da persiana.'
    }
};

// ========================================
// FUNÇÃO PRINCIPAL - GERAR PDF
// ========================================

/**
 * Função chamada quando o formulário é enviado
 * Gera o PDF do orçamento automaticamente
 */
function gerarPDFOrcamento(e) {
    try {
        // Obter dados do formulário
        const respostas = e.namedValues;

        // Dados do cliente
        const cliente = {
            nome: respostas['Nome do Cliente'] ? respostas['Nome do Cliente'][0] : '',
            email: respostas['Email do Cliente'] ? respostas['Email do Cliente'][0] : '',
            telefone: respostas['Telefone'] ? respostas['Telefone'][0] : '',
            cpfCnpj: respostas['CPF/CNPJ'] ? respostas['CPF/CNPJ'][0] : '',
            endereco: respostas['Endereço'] ? respostas['Endereço'][0] : '',
            bairro: respostas['Bairro'] ? respostas['Bairro'][0] : '',
            cidade: respostas['Cidade'] ? respostas['Cidade'][0] : '',
            cep: respostas['CEP'] ? respostas['CEP'][0] : ''
        };

        // Dados do orçamento
        const orcamento = {
            descricao: respostas['Descrição do Serviço'] ? respostas['Descrição do Serviço'][0] : '',
            valorTotal: respostas['Valor Total (R$)'] ? respostas['Valor Total (R$)'][0] : '0',
            observacoes: respostas['Observacoes'] ? respostas['Observacoes'][0] : ''
        };

        // Gerar número do orçamento
        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = spreadsheet.getSheetByName('Respostas ao formulário 1');
        const lastRow = sheet.getLastRow();
        const numeroOrcamento = 'ORC-' + String(lastRow - 1).padStart(4, '0');

        // Data atual formatada
        const hoje = new Date();
        const dataFormatada = Utilities.formatDate(hoje, 'America/Sao_Paulo', 'dd/MM/yyyy');
        const dataExtenso = formatarDataExtenso(hoje);

        // Copiar o template
        const templateDoc = DriveApp.getFileById(PDF_CONFIG.templateId);
        const pasta = DriveApp.getFolderById(PDF_CONFIG.folderId);
        const nomeArquivo = `Orçamento_${numeroOrcamento}_${cliente.nome.replace(/\s/g, '_')}`;
        const copiaDoc = templateDoc.makeCopy(nomeArquivo, pasta);

        // Abrir a cópia para edição
        const doc = DocumentApp.openById(copiaDoc.getId());
        const body = doc.getBody();

        // Substituir marcadores no template
        body.replaceText('{{DATA}}', dataFormatada);
        body.replaceText('{{DATA_EXTENSO}}', dataExtenso);
        body.replaceText('{{VENDEDOR}}', PDF_CONFIG.vendedor);
        body.replaceText('{{NUMERO_ORCAMENTO}}', numeroOrcamento);

        // Dados do cliente
        body.replaceText('{{CLIENTE_NOME}}', cliente.nome);
        body.replaceText('{{CLIENTE_EMAIL}}', cliente.email);
        body.replaceText('{{CLIENTE_TELEFONE}}', cliente.telefone);
        body.replaceText('{{CLIENTE_CPF_CNPJ}}', cliente.cpfCnpj);
        body.replaceText('{{CLIENTE_ENDERECO}}', cliente.endereco);
        body.replaceText('{{CLIENTE_BAIRRO}}', cliente.bairro);
        body.replaceText('{{CLIENTE_CIDADE}}', cliente.cidade);
        body.replaceText('{{CLIENTE_CEP}}', cliente.cep);

        // Dados do orçamento
        body.replaceText('{{DESCRICAO}}', orcamento.descricao);
        body.replaceText('{{VALOR_TOTAL}}', formatarMoeda(orcamento.valorTotal));
        body.replaceText('{{OBSERVACOES}}', orcamento.observacoes || PDF_CONFIG.observacoesPadrao.prazoPagamento);

        // Observações padrão
        body.replaceText('{{PRAZO_PAGAMENTO}}', PDF_CONFIG.observacoesPadrao.prazoPagamento);
        body.replaceText('{{PRAZO_ENTREGA}}', PDF_CONFIG.observacoesPadrao.prazoEntrega);
        body.replaceText('{{GARANTIA}}', PDF_CONFIG.observacoesPadrao.garantia);

        // Salvar e fechar
        doc.saveAndClose();

        // Converter para PDF
        const pdfBlob = copiaDoc.getAs('application/pdf');
        pdfBlob.setName(nomeArquivo + '.pdf');
        const pdfFile = pasta.createFile(pdfBlob);

        // Deletar o arquivo Doc (manter apenas o PDF)
        copiaDoc.setTrashed(true);

        // Gravar link do PDF na planilha (coluna L)
        const pdfUrl = pdfFile.getUrl();
        sheet.getRange(lastRow, 12).setValue(pdfUrl);

        // Log de sucesso
        console.log('PDF gerado com sucesso: ' + pdfUrl);

        // Opcional: Enviar por email
        // enviarEmailComPDF(cliente.email, pdfFile, cliente.nome, numeroOrcamento);

        return pdfUrl;

    } catch (error) {
        console.error('Erro ao gerar PDF: ' + error.message);
        throw error;
    }
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/**
 * Formata data por extenso
 */
function formatarDataExtenso(data) {
    const meses = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];

    const dia = data.getDate();
    const mes = meses[data.getMonth()];
    const ano = data.getFullYear();

    return `Piracicaba, ${dia.toString().padStart(2, '0')} de ${mes} de ${ano}`;
}

/**
 * Formata valor como moeda brasileira
 */
function formatarMoeda(valor) {
    const numero = parseFloat(valor.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
    return 'R$ ' + numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Envia email com PDF anexado (opcional)
 */
function enviarEmailComPDF(emailDestinatario, pdfFile, nomeCliente, numeroOrcamento) {
    if (!emailDestinatario) return;

    const assunto = `Orçamento ${numeroOrcamento} - ${PDF_CONFIG.empresa.nome}`;
    const corpo = `
Prezado(a) ${nomeCliente},

Segue em anexo o orçamento solicitado.

Qualquer dúvida estamos à disposição.

Atenciosamente,
${PDF_CONFIG.vendedor}
${PDF_CONFIG.empresa.nome}
${PDF_CONFIG.empresa.telefone}
    `;

    MailApp.sendEmail({
        to: emailDestinatario,
        subject: assunto,
        body: corpo,
        attachments: [pdfFile.getAs(MimeType.PDF)]
    });

    console.log('Email enviado para: ' + emailDestinatario);
}

// ========================================
// MENU PARA GERAR PDF MANUALMENTE
// ========================================

/**
 * Adiciona opção no menu para gerar PDF da linha selecionada
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();

    ui.createMenu('🔧 Sistema de Orçamentos')
        .addItem('📋 Processar Respostas Antigas', 'processarRespostasAntigas')
        .addItem('📊 Ver Estatísticas', 'mostrarEstatisticas')
        .addSeparator()
        .addItem('📄 Gerar PDF da Linha Selecionada', 'gerarPDFManual')
        .addToUi();
}

/**
 * Gera PDF manualmente da linha selecionada
 */
function gerarPDFManual() {
    const ui = SpreadsheetApp.getUi();
    const sheet = SpreadsheetApp.getActiveSheet();
    const row = sheet.getActiveRange().getRow();

    if (row < 2) {
        ui.alert('Selecione uma linha com dados (linha 2 ou abaixo)');
        return;
    }

    // Obter dados da linha
    const dados = sheet.getRange(row, 1, 1, 11).getValues()[0];

    const evento = {
        namedValues: {
            'Nome do Cliente': [dados[1]],
            'Email do Cliente': [dados[2]],
            'Telefone': [dados[3]],
            'CPF/CNPJ': [dados[4]],
            'Descrição do Serviço': [dados[5]],
            'Valor Total (R$)': [dados[6]],
            'Observacoes': [dados[8]]
        }
    };

    try {
        const pdfUrl = gerarPDFOrcamento(evento);
        ui.alert('PDF gerado com sucesso!\n\n' + pdfUrl);
    } catch (error) {
        ui.alert('Erro ao gerar PDF: ' + error.message);
    }
}
