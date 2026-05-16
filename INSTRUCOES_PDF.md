# 📄 Como Configurar a Geração Automática de PDF

## Passo 1: Criar a Pasta para os PDFs

1. Abra o Google Drive
2. Crie uma nova pasta chamada **"Orçamentos PDF"**
3. Abra a pasta e copie o **ID da URL**:
   - URL: `https://drive.google.com/drive/folders/XXXXXXXXXXXXX`
   - O ID é a parte `XXXXXXXXXXXXX`

---

## Passo 2: Criar o Template do Google Docs

1. Abra o Google Docs e crie um novo documento
2. Nomeie como **"Template Orçamento"**
3. Copie e cole o conteúdo abaixo:

---

### CONTEÚDO DO TEMPLATE (copie tudo entre as linhas):

```
══════════════════════════════════════════════════════════════════════════

                           [SUA LOGO AQUI]
                           
                           Entre Tramas
                          — Interiores —

══════════════════════════════════════════════════════════════════════════

CNPJ: 62.856.649/0001-66 - Rua Tiradentes, 540 - Centro - CEP: 13400-760 - Piracicaba - SP
📱 (19) 99387-3947  |  📷 Entretramas.interiores  |  ✉️ entretramasinteriores@gmail.com

══════════════════════════════════════════════════════════════════════════

Data: {{DATA}}                                    Vendedor: {{VENDEDOR}}
Orçamento Nº: {{NUMERO_ORCAMENTO}}

══════════════════════════════════════════════════════════════════════════
                                 CLIENTE
══════════════════════════════════════════════════════════════════════════

Nome:      {{CLIENTE_NOME}}                    CPF/CNPJ: {{CLIENTE_CPF_CNPJ}}
Endereço:  {{CLIENTE_ENDERECO}}                Bairro:   {{CLIENTE_BAIRRO}}
CEP:       {{CLIENTE_CEP}}                     Cidade:   {{CLIENTE_CIDADE}}
Telefone:  {{CLIENTE_TELEFONE}}                E-mail:   {{CLIENTE_EMAIL}}

══════════════════════════════════════════════════════════════════════════
                           DESCRIÇÃO DO SERVIÇO
══════════════════════════════════════════════════════════════════════════

{{DESCRICAO}}

══════════════════════════════════════════════════════════════════════════

                                                    VALOR TOTAL: {{VALOR_TOTAL}}

══════════════════════════════════════════════════════════════════════════
                              OBSERVAÇÕES
══════════════════════════════════════════════════════════════════════════

Prazo de pagamento:      {{PRAZO_PAGAMENTO}}
Prazo de entrega:        {{PRAZO_ENTREGA}}

{{GARANTIA}}

══════════════════════════════════════════════════════════════════════════



{{DATA_EXTENSO}}

```

---

## Passo 3: Obter o ID do Template

1. Com o documento do template aberto, olhe a URL:
   - `https://docs.google.com/document/d/XXXXXXXXXXXXX/edit`
2. Copie o ID (parte `XXXXXXXXXXXXX`)

---

## Passo 4: Adicionar o Script no Apps Script

1. Abra sua planilha de orçamentos
2. Vá em **Extensões → Apps Script**
3. Cole o código do arquivo `gerar-pdf-orcamento.js`
4. Substitua os valores:
   - `COLE_AQUI_O_ID_DO_TEMPLATE` → pelo ID do template (Passo 3)
   - `COLE_AQUI_O_ID_DA_PASTA` → pelo ID da pasta (Passo 1)
5. Salve (Ctrl+S)

---

## Passo 5: Configurar o Gatilho

1. No Apps Script, clique em **⏰ Acionadores** (menu lateral)
2. Clique em **+ Adicionar acionador**
3. Configure:
   - Função: `gerarPDFOrcamento`
   - Implantação: `Teste`
   - Origem: `Da planilha`
   - Tipo: `Ao enviar o formulário`
4. Clique em **Salvar**

---

## Passo 6: Adicionar Coluna para Link do PDF

1. Na planilha, adicione uma nova coluna **L** chamada **"Link do PDF"**
2. Quando um formulário for enviado, o link do PDF será gravado automaticamente

---

## ✅ Pronto!

Agora, toda vez que um formulário for enviado:
1. Os dados serão salvos na planilha
2. Um PDF será gerado automaticamente
3. O link do PDF será gravado na coluna L

---

## 🔧 Ajustes Opcionais

### Mudar dados da empresa
No arquivo `gerar-pdf-orcamento.js`, edite o objeto `PDF_CONFIG.empresa`

### Enviar PDF por email automaticamente
Descomente a linha `// enviarEmailComPDF(...)` no código

### Gerar PDF manualmente
Use o menu **🔧 Sistema de Orçamentos → 📄 Gerar PDF da Linha Selecionada**
