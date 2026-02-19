-- Dados de exemplo baseados na consulta TESS fornecida
-- CNPJ: 02.800.448/0001-15 - DR. TCHE - LA PARRILLA DE LA VILLA, BAR E LANCHES LTDA

-- Inserir consulta
INSERT INTO consulta (operador, data_hora, produto, protocolo) VALUES
('ISABELA LISBOA SILVA', '2025-10-10 15:13:00', 'SPC + POSITIVO AVANÇADO PJ', '015.003.028.462-11');

-- Obter o ID da consulta inserida (assumindo que é 1)
SET @consulta_id = LAST_INSERT_ID();

-- Inserir empresa
INSERT INTO empresa (cnpj, razao_social, situacao_cnpj, atualizacao, fundacao, id_consulta) VALUES
('02.800.448/0001-15', 'DR. TCHE - LA PARRILLA DE LA VILLA, BAR E LANCHES LTDA', 'ATIVA', '2025-10-10 15:13:03', '1998-09-03', @consulta_id);

-- Obter o ID da empresa inserida
SET @empresa_id = LAST_INSERT_ID();

-- Inserir endereço
INSERT INTO endereco (id_empresa, logradouro, numero, complemento, bairro, cidade, estado, cep) VALUES
(@empresa_id, 'FRANCA PINTO', '489', 'Não informado', 'Vila Mariana', 'Sao Paulo', 'SP', '04016-032');

-- Inserir dados de contato
INSERT INTO dados_contato (id_empresa, telefones_fixos, telefones_celulares, emails) VALUES
(@empresa_id, 
 JSON_ARRAY('11 5573-0685', '11 5575-9625'),
 JSON_ARRAY('11 94218-4319', '11 99685-5900'),
 JSON_ARRAY('drtche.adm@gmail.com', 'drtche.compras@gmail.com', 'faleconosco@drtche.com.br')
);

-- Inserir ocorrências
INSERT INTO ocorrencias (id_empresa, score_pj, dados_contato, historico_scr, historico_pagamentos_positivo, 
                        limite_credito_pj, quadro_administrativo, consultas_realizadas, gasto_financeiro_estimado, controle_societario) VALUES
(@empresa_id, 346, 0, 10, 1, 288005.00, 1, 10, 1100741.00, 1);

-- Inserir sócio
INSERT INTO socios (id_empresa, cpf, nome, entrada, valor_participacao, percentual_participacao, cargo) VALUES
(@empresa_id, '146.962.740-04', 'ADELAR PESSOA VIEIRA', '1998-09-03', 100.00, 100.00, 'SOCIO');

-- Inserir quadro administrativo
INSERT INTO quadro_administrativo (id_empresa, cpf, nome, cargo, eleito_em) VALUES
(@empresa_id, '146.962.740-04', 'ADELAR PESSOA VIEIRA', 'ADMINISTR', '1998-09-03');

-- Inserir histórico de pagamento positivo
INSERT INTO historico_pagamento_positivo (id_empresa, compromissos_ativos, contratos_ativos, credores, 
                                         parcelas_a_vencer_percentual, parcelas_pagas_percentual, parcelas_abertas_percentual,
                                         contratos_pagos, contratos_abertos, uso_cheque_especial) VALUES
(@empresa_id, '65501 - 100500', 7, 4, 14.43, 83.51, 2.06, '786001 - 1206000', '0 - 6000', 1);

-- Inserir score de crédito
INSERT INTO score_credito (id_empresa, score, risco, probabilidade_inadimplencia, limite_credito_valor, gasto_financeiro_estimado_valor) VALUES
(@empresa_id, 346, 'F', 87.47, 288005.00, 1100741.00);

-- Inserir dados SCR
INSERT INTO scr (id_empresa, atualizacao, quantidade_operacoes, inicio_relacionamento, valor_contratado, 
                instituicoes, carteira_ativa_total, vencimento_ultima_parcela, garantias_quantidade_maxima) VALUES
(@empresa_id, '2025-07-26', 10, '2003-11-01', '2774812.20 - 6474561.80', 3, 'Não informado', '03/2028', 19);

-- Obter o ID do SCR inserido
SET @scr_id = LAST_INSERT_ID();

-- Inserir tipos de garantias
INSERT INTO tipos_garantias (id_scr, tipo_garantia) VALUES
(@scr_id, 'Caução'),
(@scr_id, 'Penhor'),
(@scr_id, 'Hipotéca'),
(@scr_id, 'Anticrese'),
(@scr_id, 'Outros');

-- Inserir consultas realizadas
INSERT INTO consultas_realizadas (id_empresa, data_hora, associado, cidade, origem) VALUES
(@empresa_id, '2025-10-04 12:04:56', 'PRIME CATER', 'LOUVEIRA / SP', 'CDL - SAO PAULO / SP'),
(@empresa_id, '2025-09-17 00:00:00', 'DAYHOME COMERCIAL', 'SAO PAULO / SP', 'SAO PAULO / SP');
