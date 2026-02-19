# Schema do Banco de Dados - Consultas TESS/SPC

Este diretório contém o schema do banco de dados para armazenar os dados das consultas TESS/SPC.

## Arquivos

### MySQL
- `schema.sql` - Script principal para criar todas as tabelas (MySQL)
- `sample_data.sql` - Dados de exemplo baseados em uma consulta real (MySQL)

### SQL Server
- `schema_sqlserver.sql` - Script principal para criar todas as tabelas (SQL Server)
- `sample_data_sqlserver.sql` - Dados de exemplo baseados em uma consulta real (SQL Server)

### Gerais
- `exemplos_consultas.sql` - Exemplos de consultas SQL
- `README.md` - Este arquivo com instruções

## Estrutura do Banco

### Tabelas Principais

1. **consulta** - Informações básicas da consulta
2. **empresa** - Dados da empresa consultada
3. **endereco** - Endereço da empresa
4. **dados_contato** - Telefones e emails (armazenados como JSON)
5. **ocorrencias** - Scores e métricas da consulta
6. **socios** - Informações dos sócios
7. **quadro_administrativo** - Quadro administrativo
8. **historico_pagamento_positivo** - Histórico de pagamentos
9. **score_credito** - Análises de crédito
10. **scr** - Dados do Sistema de Informações de Crédito
11. **consultas_realizadas** - Histórico de consultas
12. **tipos_garantias** - Tipos de garantias (normalizado)

### Características do Schema

- **Chaves Estrangeiras**: Todas as tabelas estão relacionadas através de chaves estrangeiras
- **Índices**: Criados para melhorar performance nas consultas mais comuns
- **JSON**: Telefones e emails são armazenados como JSON para flexibilidade
- **Timestamps**: Todas as tabelas têm campos de auditoria (created_at, updated_at)
- **Cascata**: Exclusões em cascata para manter integridade referencial

## Como Usar

### MySQL

#### 1. Executar o Schema Completo
```bash
mysql -u seu_usuario -p < schema.sql
```

#### 2. Inserir Dados de Exemplo (Opcional)
```bash
mysql -u seu_usuario -p consultas_tess < sample_data.sql
```

### SQL Server

#### 1. Executar o Schema Completo
```bash
sqlcmd -S servidor -U usuario -P senha -i schema_sqlserver.sql
```

**OU** usando SQL Server Management Studio:
- Abra o arquivo `schema_sqlserver.sql`
- Execute o script completo

#### 2. Inserir Dados de Exemplo (Opcional)
```bash
sqlcmd -S servidor -U usuario -P senha -i sample_data_sqlserver.sql
```

**OU** usando SQL Server Management Studio:
- Abra o arquivo `sample_data_sqlserver.sql`
- Execute o script completo

## Tipos de Dados Utilizados

- **VARCHAR**: Para textos de tamanho variável
- **INT**: Para números inteiros
- **DECIMAL**: Para valores monetários e percentuais
- **DATE/DATETIME**: Para datas
- **JSON**: Para arrays de telefones e emails
- **TINYINT(1)**: Para campos booleanos
- **TEXT**: Para textos longos (quando necessário)

## Relacionamentos

O **`id_empresa`** é a chave principal para relacionar todos os dados de uma consulta específica:

```
consulta (1) -> (N) empresa
empresa (1) -> (1) endereco                    [via id_empresa]
empresa (1) -> (1) dados_contato              [via id_empresa]
empresa (1) -> (1) ocorrencias                [via id_empresa]
empresa (1) -> (N) socios                     [via id_empresa]
empresa (1) -> (N) quadro_administrativo      [via id_empresa]
empresa (1) -> (1) historico_pagamento_positivo [via id_empresa]
empresa (1) -> (1) score_credito              [via id_empresa]
empresa (1) -> (1) scr                        [via id_empresa]
empresa (1) -> (N) consultas_realizadas       [via id_empresa]
scr (1) -> (N) tipos_garantias                [via id_scr]
```

### Importância do id_empresa

- **Chave de Relacionamento**: O `id_empresa` é usado em todas as tabelas para identificar qual empresa os dados pertencem
- **Integridade Referencial**: Garante que todos os dados de uma consulta estejam corretamente associados
- **Performance**: Índices específicos foram criados para otimizar consultas por `id_empresa`
- **Isolamento**: Permite consultar dados de uma empresa específica sem interferir em outras

## Considerações de Performance

- Índices criados nas colunas mais consultadas
- CNPJ como chave única na tabela empresa
- Campos de data indexados para consultas temporais
- Uso de JSON para dados que podem variar em estrutura

## Manutenção

- O campo `updated_at` é atualizado automaticamente
- Exclusões em cascata mantêm a integridade dos dados
- Todos os campos obrigatórios têm NOT NULL
- Validações de formato podem ser adicionadas via triggers se necessário
