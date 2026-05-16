# Guia de Implementação - Sistema de Orçamentos

## 📌 Visão Geral

Este guia mostra como criar um sistema completo de orçamentos usando:
- **Google Forms** → Entrada de dados padronizada
- **Google Sheets** → Banco de dados centralizado
- **Função QUERY** → Motor de busca por cliente
- **Apps Script** → URL de edição para modificar orçamentos

---

## 🚀 PARTE 1: Criar o Google Forms (Interface de Entrada)

### Passo 1: Acessar Google Forms
1. Acesse [forms.google.com](https://forms.google.com)
2. Clique em **"+ Em branco"**
3. Nomeie: **"Sistema de Orçamentos"**

### Passo 2: Criar os Campos do Formulário

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome do Cliente | Resposta curta | ✅ Sim |
| Email do Cliente | Resposta curta | ✅ Sim |
| Telefone | Resposta curta | ✅ Sim |
| CPF/CNPJ | Resposta curta | ❌ Não |
| Descrição do Serviço | Parágrafo | ✅ Sim |
| Valor Total (R$) | Resposta curta | ✅ Sim |
| Status | Lista suspensa | ✅ Sim |
| Observações | Parágrafo | ❌ Não |

**Opções do campo Status:**
- Pendente
- Enviado
- Aprovado
- Reprovado
- Em Negociação

### Passo 3: Conectar ao Google Sheets
1. Clique na aba **"Respostas"** no topo
2. Clique no ícone do **Google Sheets** (quadrado verde)
3. Selecione **"Criar uma nova planilha"**
4. Nomeie: **"Banco de Dados Orçamentos"**

---

## 📊 PARTE 2: Configurar o Google Sheets (Banco de Dados)

### Estrutura Automática

Ao conectar o Forms, a planilha terá estas colunas:

| Coluna | Nome | Geração |
|--------|------|---------|
| A | Carimbo de data/hora | Automático |
| B | Nome do Cliente | Do Forms |
| C | Email do Cliente | Do Forms |
| D | Telefone | Do Forms |
| E | CPF/CNPJ | Do Forms |
| F | Descrição do Serviço | Do Forms |
| G | Valor Total (R$) | Do Forms |
| H | Status | Do Forms |
| I | Observações | Do Forms |
| J | **ID do Orçamento** | 👉 CRIAR |
| K | **Link de Edição** | 👉 CRIAR (Apps Script) |

### Passo 1: Adicionar Coluna ID

Na célula **J1**, digite: `ID do Orçamento`

Na célula **J2**, cole esta fórmula:
```
=ARRAYFORMULA(IF(A2:A<>"","ORC-"&TEXT(ROW(A2:A)-1,"0000"),""))
```

Isso gera IDs automáticos como: ORC-0001, ORC-0002, etc.

### Passo 2: Adicionar Coluna Link de Edição

Na célula **K1**, digite: `Link de Edição`

Esta coluna será preenchida automaticamente pelo Apps Script (Parte 3).

---

## ⚡ PARTE 3: Apps Script (URL de Edição Automática)

### Passo 1: Abrir o Editor de Scripts
1. Na planilha, vá em **Extensões > Apps Script**
2. Delete todo o código existente
3. Cole o código do arquivo `apps-script-url-edicao.js`

### Passo 2: Configurar o Gatilho (Trigger)
1. No menu lateral do Apps Script, clique em **⏰ Acionadores**
2. Clique em **+ Adicionar acionador**
3. Configure:
   - Função: `onFormSubmit`
   - Origem do evento: `Da planilha`
   - Tipo de evento: `Ao enviar o formulário`
4. Clique em **Salvar**
5. Autorize o acesso (aparecerá uma tela de permissões)

Agora, toda vez que um formulário for enviado, a URL de edição será gravada automaticamente na coluna K.

---

## 🔍 PARTE 4: Painel de Busca (Função QUERY)

### Passo 1: Criar Aba de Busca
1. Na planilha, clique em **+** para criar nova aba
2. Nomeie: **"Painel de Busca"**

### Passo 2: Configurar o Layout

| Célula | Conteúdo |
|--------|----------|
| A1 | **🔍 PESQUISAR CLIENTE** |
| A3 | Nome do Cliente: |
| B3 | _(deixe vazia - campo de busca)_ |
| A5 | **Resultados:** |

### Passo 3: Inserir a Fórmula QUERY

Na célula **A6**, cole:

```
=IF(B3="","Digite um nome para pesquisar...",IFERROR(QUERY('Respostas ao formulário 1'!A:K,"SELECT J, B, C, G, H, K WHERE LOWER(B) CONTAINS '"&LOWER(B3)&"' ORDER BY A DESC",1),"Nenhum cliente encontrado."))
```

**Explicação da fórmula:**
- `SELECT J, B, C, G, H, K` → Retorna: ID, Nome, Email, Valor, Status, Link
- `WHERE LOWER(B) CONTAINS...` → Busca insensível a maiúsculas/minúsculas
- `ORDER BY A DESC` → Mostra os mais recentes primeiro
- `IFERROR` → Mostra mensagem amigável se não encontrar

### Passo 4: Formatar os Resultados

1. Selecione a linha 6 (cabeçalhos do resultado)
2. Coloque em **negrito** e com cor de fundo
3. Ajuste a largura das colunas

---

## ✅ PARTE 5: Testando o Sistema

### Teste 1: Enviar Orçamento
1. Abra o link do Google Forms
2. Preencha um orçamento de teste
3. Envie

### Teste 2: Verificar na Planilha
1. Abra a planilha "Banco de Dados Orçamentos"
2. Verifique se apareceu na aba "Respostas ao formulário 1"
3. Confira se o ID foi gerado (coluna J)
4. Confira se o Link de Edição apareceu (coluna K)

### Teste 3: Pesquisar Cliente
1. Vá para a aba "Painel de Busca"
2. Digite o nome do cliente na célula B3
3. Os resultados devem aparecer abaixo

### Teste 4: Editar Orçamento
1. Clique no Link de Edição do resultado
2. Modifique algum valor
3. Envie novamente
4. Verifique se a linha foi ATUALIZADA (não duplicada)

---

## 🎨 Melhorias Opcionais

### 1. Formatação Condicional no Status
Na aba principal, selecione a coluna Status e adicione:
- **Verde** → Aprovado
- **Vermelho** → Reprovado
- **Amarelo** → Pendente

### 2. Dashboard com Totais
Criar aba com:
```
=SUMIF('Respostas ao formulário 1'!H:H,"Aprovado",'Respostas ao formulário 1'!G:G)
```

### 3. Validação de Dados
No Forms, adicione validação de email:
- Expressão regular: `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`

---

## 📱 Evolução para AppSheet (Opcional)

Para criar um app mobile:
1. Acesse [appsheet.com](https://www.appsheet.com)
2. Clique em "Start for free"
3. Conecte sua planilha como fonte de dados
4. O AppSheet criará automaticamente um app com busca

**Limitações do plano gratuito:**
- Máximo 10 usuários de teste
- Sem envio de emails externos
- Apps com marca d'água

---

## 🆘 Troubleshooting

| Problema | Solução |
|----------|---------|
| Link de edição não aparece | Verifique se o gatilho está configurado |
| QUERY retorna erro | Verifique o nome da aba entre aspas simples |
| Busca não encontra | Use LOWER() em ambos os lados |
| ID não gera | Verifique se a fórmula ARRAYFORMULA está na J2 |

---

**Pronto!** Seu sistema de orçamentos está funcionando.
