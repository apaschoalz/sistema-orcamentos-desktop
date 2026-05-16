# Fórmulas QUERY para o Sistema de Orçamentos

## 🔍 Busca por Nome do Cliente (Principal)

Cole na célula **A6** da aba "Painel de Busca":

```
=IF(B3="",
  "Digite um nome para pesquisar...",
  IFERROR(
    QUERY('Respostas ao formulário 1'!A:K,
      "SELECT J, B, C, G, H, K 
       WHERE LOWER(B) CONTAINS '"&LOWER(B3)&"' 
       ORDER BY A DESC",
    1),
    "Nenhum cliente encontrado."
  )
)
```

**Retorna:** ID, Nome, Email, Valor, Status, Link de Edição

---

## 📊 Fórmulas Úteis para Dashboard

### Total de Orçamentos Aprovados
```
=SUMIF('Respostas ao formulário 1'!H:H,"Aprovado",'Respostas ao formulário 1'!G:G)
```

### Contar por Status
```
=COUNTIF('Respostas ao formulário 1'!H:H,"Aprovado")
=COUNTIF('Respostas ao formulário 1'!H:H,"Pendente")
=COUNTIF('Respostas ao formulário 1'!H:H,"Reprovado")
```

### Busca Avançada (por Status também)

Se quiser buscar por nome E filtrar por status:
```
=QUERY('Respostas ao formulário 1'!A:K,
  "SELECT J, B, C, G, H 
   WHERE LOWER(B) CONTAINS '"&LOWER(B3)&"' 
   AND H = '"&C3&"'
   ORDER BY A DESC",
1)
```
Onde B3 = nome do cliente e C3 = status selecionado

### Últimos 10 Orçamentos
```
=QUERY('Respostas ao formulário 1'!A:K,
  "SELECT J, B, G, H 
   ORDER BY A DESC 
   LIMIT 10",
1)
```

### Orçamentos do Mês Atual
```
=QUERY('Respostas ao formulário 1'!A:K,
  "SELECT J, B, G, H 
   WHERE MONTH(A)+1 = "&MONTH(TODAY())&" 
   AND YEAR(A) = "&YEAR(TODAY())&"
   ORDER BY A DESC",
1)
```

---

## 🚨 Dicas Importantes

1. **Nome da aba**: Se sua aba tiver outro nome, substitua `'Respostas ao formulário 1'` pelo nome correto entre aspas simples.

2. **Colunas**: Ajuste as letras das colunas (A, B, C...) conforme sua planilha.

3. **Erro #VALUE**: Geralmente ocorre quando há aspas erradas. Copie exatamente como está aqui.

4. **LOWER()**: Sempre use LOWER() em ambos os lados para busca case-insensitive.
