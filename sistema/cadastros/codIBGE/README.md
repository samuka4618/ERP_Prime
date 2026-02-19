# Pasta de Códigos IBGE

Esta pasta deve conter arquivos Excel (.xlsx ou .xls) com os códigos IBGE dos municípios brasileiros.

## Estrutura da Planilha

A planilha deve ter a seguinte estrutura:

- **Coluna H**: Código IBGE completo do município
- **Coluna I**: Nome do município

O sistema irá:
1. Procurar o nome do município na coluna I
2. Quando encontrar, pegar o código IBGE da coluna H correspondente
3. Adicionar o código ao payload do Atak no campo `CodigoIBGECidadeF` (e nos demais endereços)

## Exemplo de Estrutura

| ... | H | I | ... |
|-----|---|---|-----|
| ... | Código Município Completo | Município | ... |
| ... | 3552205 | SOROCABA | ... |
| ... | 3550308 | SAO PAULO | ... |

## Formato dos Arquivos

- **Formatos aceitos**: `.xlsx`, `.xls`
- **Localização**: Esta pasta (`cadastros/codIBGE/`)
- **Múltiplos arquivos**: O sistema busca em todos os arquivos Excel da pasta

## Como Usar

1. Coloque os arquivos Excel com os códigos IBGE nesta pasta
2. O sistema automaticamente buscará o código quando processar um cadastro
3. O código será incluído em todos os endereços (Fiscal, Cobrança, Entrega, Retirada, Triagem)

## Notas

- O sistema faz cache das buscas para melhorar a performance
- A busca é case-insensitive (não diferencia maiúsculas/minúsculas)
- Se o município não for encontrado, o campo ficará vazio (undefined) no payload

