/**
 * Gerador de PDF de Orçamentos usando PDFKit
 * Layout baseado no modelo de referência da empresa
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

class PDFGenerator {
    constructor(config = {}) {
        this.empresa = config.empresa || {
            nome: 'Entre Tramas',
            subtitulo: 'Interiores',
            cidade: 'Piracicaba - SP',
            cnpj: '62.856.649/0001-66',
            endereco: 'Rua Ipiranga, 575 - Centro',
            telefone: '(19) 99387-3947',
            instagram: 'Entretramas.interiores',
            email: 'entretramasinteriores@gmail.com'
        };

        // Cores da marca (dourado/bege)
        this.cores = {
            dourada: '#C4A65C',
            douradaEscura: '#A08040',
            texto: '#333333',
            textoMuted: '#666666',
            linha: '#000000',
            fundoCinza: '#F5F5F5',
            fundoAmarelo: '#FFF9E6'
        };

        // Caminho da logo - funciona em desenvolvimento e empacotado
        const isPackaged = require('electron').app?.isPackaged ?? false;
        const appPath = require('electron').app?.getAppPath?.() || __dirname;

        console.log('[PDF Generator] isPackaged:', isPackaged);
        console.log('[PDF Generator] appPath:', appPath);
        console.log('[PDF Generator] __dirname:', __dirname);

        // Tentar múltiplos caminhos para garantir que encontremos os arquivos
        const possibleLogoPaths = [
            path.join(__dirname, '..', 'logo.jpg'),
            path.join(appPath, 'logo.jpg'),
            path.join(process.resourcesPath || '', 'app', 'logo.jpg'),
            path.join(process.resourcesPath || '', 'logo.jpg'),
        ];

        const possibleAssetPaths = [
            path.join(__dirname, '..', 'assets'),
            path.join(appPath, 'assets'),
            path.join(process.resourcesPath || '', 'app', 'assets'),
            path.join(process.resourcesPath || '', 'assets'),
        ];

        // Encontrar o caminho correto para a logo
        this.logoPath = possibleLogoPaths.find(p => fs.existsSync(p)) || possibleLogoPaths[0];
        console.log('[PDF Generator] logoPath:', this.logoPath, 'exists:', fs.existsSync(this.logoPath));

        // Encontrar o caminho correto para os assets
        const assetsPath = possibleAssetPaths.find(p => fs.existsSync(p)) || possibleAssetPaths[0];
        console.log('[PDF Generator] assetsPath:', assetsPath, 'exists:', fs.existsSync(assetsPath));

        this.whatsappIconPath = path.join(assetsPath, 'whatsapp.png');
        this.instagramIconPath = path.join(assetsPath, 'instagram.png');
        this.emailIconPath = path.join(assetsPath, 'email.png');

        console.log('[PDF Generator] whatsappIconPath:', this.whatsappIconPath, 'exists:', fs.existsSync(this.whatsappIconPath));
        console.log('[PDF Generator] instagramIconPath:', this.instagramIconPath, 'exists:', fs.existsSync(this.instagramIconPath));
        console.log('[PDF Generator] emailIconPath:', this.emailIconPath, 'exists:', fs.existsSync(this.emailIconPath));
    }

    formatarMoeda(valor) {
        const numero = parseFloat(valor) || 0;
        return 'R$ ' + numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    formatarData(data) {
        const d = data ? new Date(data) : new Date();
        return d.toLocaleDateString('pt-BR');
    }

    gerarPDF(orcamento, cliente, itens, outputPath) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 30,
                    bufferPages: true
                });

                const writeStream = fs.createWriteStream(outputPath);
                doc.pipe(writeStream);

                const pageWidth = 595;
                const marginLeft = 30;
                const marginRight = 565;
                const contentWidth = marginRight - marginLeft;
                let y = 30;

                // ========== CABEÇALHO ==========
                // Logo à esquerda
                if (fs.existsSync(this.logoPath)) {
                    doc.image(this.logoPath, marginLeft, y, { width: 100 });
                }

                // Dados da empresa ao lado da logo
                const empresaX = 140;
                doc.fontSize(10)
                    .fillColor(this.cores.texto)
                    .font('Helvetica-Bold')
                    .text(this.empresa.cidade, empresaX, y + 5);

                doc.fontSize(9)
                    .font('Helvetica')
                    .fillColor(this.cores.texto)
                    .text(this.empresa.endereco, empresaX, y + 20)
                    .text(`CNPJ: ${this.empresa.cnpj}`, empresaX, y + 32);

                // Telefone com ícone WhatsApp
                const iconSize = 10;
                if (fs.existsSync(this.whatsappIconPath)) {
                    doc.image(this.whatsappIconPath, empresaX, y + 46, { width: iconSize, height: iconSize });
                }
                doc.fontSize(9)
                    .font('Helvetica')
                    .fillColor(this.cores.texto)
                    .text(` ${this.empresa.telefone}`, empresaX + iconSize + 3, y + 48);

                // Instagram com ícone
                if (fs.existsSync(this.instagramIconPath)) {
                    doc.image(this.instagramIconPath, empresaX, y + 60, { width: iconSize, height: iconSize });
                }
                doc.fillColor(this.cores.texto)
                    .text(` @${this.empresa.instagram}`, empresaX + iconSize + 3, y + 62);

                // Email com ícone
                if (fs.existsSync(this.emailIconPath)) {
                    doc.image(this.emailIconPath, empresaX, y + 74, { width: iconSize, height: iconSize });
                }
                doc.fillColor(this.cores.texto)
                    .text(` ${this.empresa.email}`, empresaX + iconSize + 3, y + 76);

                // Caixa Pedido/Data/Vendedor à direita
                const boxX = 420;
                const boxWidth = 145;

                // Borda da caixa
                doc.rect(boxX, y, boxWidth, 60).stroke(this.cores.linha);

                // Linha horizontal - Pedido
                doc.moveTo(boxX, y + 20).lineTo(boxX + boxWidth, y + 20).stroke(this.cores.linha);
                doc.moveTo(boxX, y + 40).lineTo(boxX + boxWidth, y + 40).stroke(this.cores.linha);

                // Linha vertical
                doc.moveTo(boxX + 55, y).lineTo(boxX + 55, y + 60).stroke(this.cores.linha);

                // Textos
                doc.fontSize(8)
                    .fillColor(this.cores.textoMuted)
                    .font('Helvetica-Bold')
                    .text('Pedido:', boxX + 5, y + 6)
                    .text('Data:', boxX + 5, y + 26)
                    .text('Vendedor:', boxX + 5, y + 46);

                doc.fillColor(this.cores.texto)
                    .font('Helvetica')
                    .text(orcamento.numero || 'S/N', boxX + 60, y + 6, { width: 80, align: 'right' })
                    .text(this.formatarData(orcamento.created_at), boxX + 60, y + 26, { width: 80, align: 'right' })
                    .text(orcamento.vendedor || '-', boxX + 60, y + 46, { width: 80, align: 'right' });

                y = 130;

                // ========== SEÇÃO CLIENTE ==========
                // Fundo amarelo para "Cliente"
                doc.rect(marginLeft, y, contentWidth, 18).fill(this.cores.dourada);
                doc.fontSize(10)
                    .fillColor('#FFFFFF')
                    .font('Helvetica-Bold')
                    .text('Cliente', marginLeft + 5, y + 4, { align: 'center', width: contentWidth });
                y += 20;

                // Borda da seção cliente
                const clienteBoxY = y;
                const clienteBoxHeight = 70;
                doc.rect(marginLeft, clienteBoxY, contentWidth, clienteBoxHeight).stroke(this.cores.linha);

                // Dados do cliente em duas colunas
                const col1 = marginLeft + 8;
                const col2 = 300;
                const labelWidth = 70;

                doc.fontSize(8).font('Helvetica');

                // Linha 1
                doc.fillColor(this.cores.textoMuted).text('Nome:', col1, y + 5)
                    .fillColor(this.cores.texto).text(cliente.nome || '-', col1 + 45, y + 5, { width: 200 });
                doc.fillColor(this.cores.textoMuted).text('CPF/CNPJ:', col2, y + 5)
                    .fillColor(this.cores.texto).text(cliente.cpf_cnpj || '-', col2 + 55, y + 5, { width: 150 });
                y += 14;

                // Linha 2
                doc.fillColor(this.cores.textoMuted).text('Endereço:', col1, y + 5)
                    .fillColor(this.cores.texto).text(cliente.endereco || '-', col1 + 55, y + 5, { width: 180 });
                doc.fillColor(this.cores.textoMuted).text('Condomínio:', col2, y + 5)
                    .fillColor(this.cores.texto).text(cliente.condominio || '-', col2 + 65, y + 5, { width: 140 });
                y += 14;

                // Linha 3
                doc.fillColor(this.cores.textoMuted).text('CEP:', col1, y + 5)
                    .fillColor(this.cores.texto).text(cliente.cep || '-', col1 + 30, y + 5);
                doc.fillColor(this.cores.textoMuted).text('Bairro:', col1 + 100, y + 5)
                    .fillColor(this.cores.texto).text(cliente.bairro || '-', col1 + 140, y + 5);
                doc.fillColor(this.cores.textoMuted).text('Cidade:', col2, y + 5)
                    .fillColor(this.cores.texto).text(cliente.cidade || 'Piracicaba', col2 + 45, y + 5);
                y += 14;

                // Linha 4
                doc.fillColor(this.cores.textoMuted).text('Telefone:', col1, y + 5)
                    .fillColor(this.cores.texto).text(cliente.telefone || '-', col1 + 50, y + 5);
                doc.fillColor(this.cores.textoMuted).text('E-mail:', col2, y + 5)
                    .fillColor(this.cores.texto).text(cliente.email || '-', col2 + 40, y + 5, { width: 170 });

                y = clienteBoxY + clienteBoxHeight + 15;

                // ========== TABELA DE PRODUTOS ==========
                // Cabeçalho da tabela
                const colunas = {
                    qtd: marginLeft,
                    qtdW: 50,
                    desc: marginLeft + 50,
                    descW: 300,
                    vlUnit: marginLeft + 350,
                    vlUnitW: 90,
                    vlTotal: marginLeft + 440,
                    vlTotalW: 95
                };

                // Fundo do cabeçalho
                doc.rect(marginLeft, y, contentWidth, 18).fill(this.cores.fundoCinza);
                doc.rect(marginLeft, y, contentWidth, 18).stroke(this.cores.linha);

                // Linhas verticais do cabeçalho
                doc.moveTo(colunas.desc, y).lineTo(colunas.desc, y + 18).stroke(this.cores.linha);
                doc.moveTo(colunas.vlUnit, y).lineTo(colunas.vlUnit, y + 18).stroke(this.cores.linha);
                doc.moveTo(colunas.vlTotal, y).lineTo(colunas.vlTotal, y + 18).stroke(this.cores.linha);

                doc.fontSize(9)
                    .fillColor(this.cores.texto)
                    .font('Helvetica-Bold')
                    .text('QTDE', colunas.qtd + 5, y + 5, { width: colunas.qtdW - 10, align: 'center' })
                    .text('Descrição Produto', colunas.desc + 5, y + 5, { width: colunas.descW - 10, align: 'center' })
                    .text('VL. Unitário', colunas.vlUnit + 5, y + 5, { width: colunas.vlUnitW - 10, align: 'center' })
                    .text('VL. Total', colunas.vlTotal + 5, y + 5, { width: colunas.vlTotalW - 10, align: 'center' });

                y += 18;

                // Linhas da tabela
                doc.font('Helvetica').fontSize(9);

                if (itens && itens.length > 0) {
                    itens.forEach((item, index) => {
                        // Calcula a altura da descrição com base em seu tamanho e largura
                        const descText = item.descricao || '';
                        const textOptions = { width: colunas.descW - 10 };
                        const textHeight = doc.heightOfString(descText, textOptions);

                        // Altura mínima de 20 ou a altura do texto + 12 para padding (superior e inferior)
                        const itemRowHeight = Math.max(20, textHeight + 12);

                        // Fundo alternado
                        if (index % 2 === 1) {
                            doc.rect(marginLeft, y, contentWidth, itemRowHeight).fill('#FAFAFA');
                        }

                        // Borda da linha
                        doc.rect(marginLeft, y, contentWidth, itemRowHeight).stroke(this.cores.linha);

                        // Linhas verticais
                        doc.moveTo(colunas.desc, y).lineTo(colunas.desc, y + itemRowHeight).stroke(this.cores.linha);
                        doc.moveTo(colunas.vlUnit, y).lineTo(colunas.vlUnit, y + itemRowHeight).stroke(this.cores.linha);
                        doc.moveTo(colunas.vlTotal, y).lineTo(colunas.vlTotal, y + itemRowHeight).stroke(this.cores.linha);

                        doc.fillColor(this.cores.texto)
                            .text(item.quantidade || 1, colunas.qtd + 5, y + 6, { width: colunas.qtdW - 10, align: 'center' })
                            .text(descText, colunas.desc + 5, y + 6, textOptions)
                            .text(this.formatarMoeda(item.valor_unitario || 0), colunas.vlUnit + 5, y + 6, { width: colunas.vlUnitW - 10, align: 'right' })
                            .text(this.formatarMoeda(item.valor_total || 0), colunas.vlTotal + 5, y + 6, { width: colunas.vlTotalW - 10, align: 'right' });

                        y += itemRowHeight;
                    });
                }

                // Linha do Total
                const totalRowHeight = 20;
                doc.rect(marginLeft, y, contentWidth, totalRowHeight).stroke(this.cores.linha);
                doc.moveTo(colunas.vlUnit, y).lineTo(colunas.vlUnit, y + totalRowHeight).stroke(this.cores.linha);
                doc.moveTo(colunas.vlTotal, y).lineTo(colunas.vlTotal, y + totalRowHeight).stroke(this.cores.linha);

                doc.font('Helvetica-Bold')
                    .fillColor(this.cores.texto)
                    .text('Valor Total', colunas.vlUnit + 5, y + 6, { width: colunas.vlUnitW - 10, align: 'right' });

                doc.fontSize(11)
                    .fillColor(this.cores.douradaEscura)
                    .text(this.formatarMoeda(orcamento.valor_total || 0), colunas.vlTotal + 5, y + 5, { width: colunas.vlTotalW - 10, align: 'right' });

                y += totalRowHeight + 20;

                // ========== SEÇÃO OBSERVAÇÕES ==========
                // Título com borda
                doc.rect(marginLeft, y, contentWidth, 18).fill(this.cores.fundoCinza);
                doc.rect(marginLeft, y, contentWidth, 18).stroke(this.cores.linha);

                doc.fontSize(9)
                    .fillColor(this.cores.texto)
                    .font('Helvetica-Bold')
                    .text('OBSERVAÇÕES', marginLeft + 5, y + 5);
                y += 18;

                // Conteúdo das observações
                const obsBoxStartY = y;
                let currentY = y + 8;

                doc.fontSize(8).font('Helvetica');

                // Prazo de Pagamento
                doc.fillColor(this.cores.textoMuted).text('Prazo de pagamento:', col1, currentY);
                const prazoPgtoText = orcamento.prazo_pagamento || 'A combinar';
                doc.fillColor(this.cores.texto).text(prazoPgtoText, col1 + 110, currentY, { width: 350 });
                currentY += Math.max(16, doc.heightOfString(prazoPgtoText, { width: 350 }) + 4);

                // Prazo de Entrega
                doc.fillColor(this.cores.textoMuted).text('Prazo de entrega/instalação:', col1, currentY);
                const prazoEntText = orcamento.prazo_entrega || 'A combinar';
                doc.fillColor(this.cores.texto).text(prazoEntText, col1 + 130, currentY, { width: 330 });
                currentY += Math.max(20, doc.heightOfString(prazoEntText, { width: 330 }) + 8);

                // Garantia
                const garantiaText = `*${orcamento.garantia || 'Garantia de um ano para defeitos de fabricação da persiana.'}`;
                doc.fillColor(this.cores.texto).text(garantiaText, col1, currentY, { width: contentWidth - 16 });
                currentY += doc.heightOfString(garantiaText, { width: contentWidth - 16 }) + 10;

                // Observações adicionais (se houver)
                if (orcamento.observacoes) {
                    doc.text(orcamento.observacoes, col1, currentY, { width: contentWidth - 16 });
                    currentY += doc.heightOfString(orcamento.observacoes, { width: contentWidth - 16 }) + 10;
                }

                const obsBoxHeight = Math.max(80, currentY - obsBoxStartY);
                doc.rect(marginLeft, obsBoxStartY, contentWidth, obsBoxHeight).stroke(this.cores.linha);

                y = obsBoxStartY + obsBoxHeight + 20;

                // Finalizar documento
                doc.end();

                writeStream.on('finish', () => {
                    resolve(outputPath);
                });

                writeStream.on('error', (err) => {
                    reject(err);
                });

            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = PDFGenerator;
