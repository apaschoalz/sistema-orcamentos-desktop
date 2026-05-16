# Sistema de Gestão de Orçamentos

Sistema integrado de orçamentos usando Google Workspace (Forms + Sheets + Apps Script).

## Arquitetura

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Google Forms   │ ───▶ │  Google Sheets   │ ◀─── │  Painel Busca   │
│  (Entrada)      │      │  (Banco Dados)   │      │  (QUERY)        │
└─────────────────┘      └──────────────────┘      └─────────────────┘
         │                        │
         │                        ▼
         │               ┌──────────────────┐
         └──────────────▶│  Apps Script     │
                         │  (URL Edição)    │
                         └──────────────────┘
```

## Arquivos do Projeto

| Arquivo | Descrição |
|---------|-----------|
| `GUIA_IMPLEMENTACAO.md` | Passo a passo completo |
| `estrutura-planilha.md` | Schema do banco de dados |
| `apps-script-url-edicao.js` | Script para URL de edição |
| `formulas-query.md` | Fórmulas de busca |

## Links Rápidos

1. [Google Forms](https://forms.google.com)
2. [Google Sheets](https://sheets.google.com)
3. [Apps Script](https://script.google.com)

## Requisitos

- Conta Google (Gmail ou Google Workspace)
- Nenhum custo - 100% gratuito
