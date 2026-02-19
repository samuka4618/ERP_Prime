import { Logger } from '../utils/logger';

export interface DadosEmpresaExtraidos {
  empresa: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia?: string;
    situacaoCadastral?: string;
    porte?: string;
    naturezaJuridica?: string;
    dataAbertura?: Date;
    capitalSocial?: number;
    endereco?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
    telefone?: string;
    email?: string;
    atividadePrincipal?: string;
  };
  socios: Array<{
    cpfCnpj: string;
    nome: string;
    tipoPessoa: 'F' | 'J';
    statusSocio?: string;
  }>;
  participacoes: Array<{
    cpfCnpj: string;
    participacaoPercentual: number;
    cargo?: string;
    dataEntrada?: Date;
    dataSaida?: Date;
    statusParticipacao?: string;
  }>;
  quadroAdministrativo: Array<{
    cpfCnpj: string;
    cargo: string;
    dataEleicao?: Date;
    statusCargo?: string;
  }>;
}

export class TessDataParser {
  /**
   * Extrai dados estruturados da resposta da TESS
   */
  static extrairDadosEmpresa(respostaTESS: string, cnpj: string): DadosEmpresaExtraidos {
    try {
      console.log('🔍 Extraindo dados estruturados da resposta TESS...');
      
      const dados: DadosEmpresaExtraidos = {
        empresa: {
          cnpj: cnpj,
          razaoSocial: '',
          nomeFantasia: undefined,
          situacaoCadastral: undefined,
          porte: undefined,
          naturezaJuridica: undefined,
          dataAbertura: undefined,
          capitalSocial: undefined,
          endereco: undefined,
          municipio: undefined,
          uf: undefined,
          cep: undefined,
          telefone: undefined,
          email: undefined,
          atividadePrincipal: undefined
        },
        socios: [],
        participacoes: [],
        quadroAdministrativo: []
      };

      // Tenta extrair JSON da resposta
      let jsonMatch = respostaTESS.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      
      // Se não encontrou com marcadores, tenta sem eles
      if (!jsonMatch) {
        jsonMatch = respostaTESS.match(/(\{[\s\S]*\})/);
      }
      
      if (jsonMatch) {
        console.log('📄 JSON encontrado, fazendo parse...');
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          console.log('✅ JSON parseado com sucesso, extraindo dados...');
          this.extrairDadosDoJSON(jsonData, dados);
          console.log('✅ Dados extraídos do JSON com sucesso');
        } catch (jsonError) {
          console.log('⚠️ Erro ao fazer parse do JSON, usando fallback...', jsonError);
          this.extrairDadosEmpresaBasicos(respostaTESS, dados.empresa);
          this.extrairSociosEParticipacoes(respostaTESS, dados);
          this.extrairQuadroAdministrativo(respostaTESS, dados);
        }
      } else {
        console.log('📄 JSON não encontrado, usando extração por regex...');
        // Fallback para extração por regex
        this.extrairDadosEmpresaBasicos(respostaTESS, dados.empresa);
        this.extrairSociosEParticipacoes(respostaTESS, dados);
        this.extrairQuadroAdministrativo(respostaTESS, dados);
      }

      console.log(`✅ Dados extraídos com sucesso:`);
      console.log(`   - Empresa: ${dados.empresa.razaoSocial}`);
      console.log(`   - Sócios: ${dados.socios.length}`);
      console.log(`   - Participações: ${dados.participacoes.length}`);
      console.log(`   - Quadro Administrativo: ${dados.quadroAdministrativo.length}`);

      Logger.success('Dados extraídos da resposta TESS', {
        empresa: dados.empresa.razaoSocial,
        sociosCount: dados.socios.length,
        participacoesCount: dados.participacoes.length,
        quadroCount: dados.quadroAdministrativo.length
      });

      return dados;

    } catch (error) {
      console.error('❌ Erro ao extrair dados da resposta TESS:', error);
      Logger.error('Erro na extração de dados TESS', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
      
      // Retorna dados básicos em caso de erro
      return {
        empresa: {
          cnpj: cnpj,
          razaoSocial: 'Empresa não identificada',
          nomeFantasia: undefined,
          situacaoCadastral: undefined,
          porte: undefined,
          naturezaJuridica: undefined,
          dataAbertura: undefined,
          capitalSocial: undefined,
          endereco: undefined,
          municipio: undefined,
          uf: undefined,
          cep: undefined,
          telefone: undefined,
          email: undefined,
          atividadePrincipal: undefined
        },
        socios: [],
        participacoes: [],
        quadroAdministrativo: []
      };
    }
  }

  /**
   * Extrai dados do JSON da resposta TESS
   */
  private static extrairDadosDoJSON(jsonData: any, dados: DadosEmpresaExtraidos): void {
    try {
      // Extrair dados da empresa
      if (jsonData.empresa) {
        const empresa = jsonData.empresa;
        dados.empresa.razaoSocial = empresa.razao_social || '';
        dados.empresa.situacaoCadastral = empresa.situacao_cnpj || empresa.situacao_cadastral;
        dados.empresa.dataAbertura = empresa.fundacao ? this.parseDateFromISO(empresa.fundacao) : undefined;
        
        // Extrair dados de porte e natureza jurídica se disponíveis
        dados.empresa.porte = empresa.porte || undefined;
        dados.empresa.naturezaJuridica = empresa.natureza_juridica || empresa.naturezaJuridica || undefined;
        dados.empresa.capitalSocial = empresa.capital_social || empresa.capitalSocial || undefined;
        dados.empresa.atividadePrincipal = empresa.atividade_principal || empresa.atividadePrincipal || undefined;
        
        if (empresa.endereco) {
          dados.empresa.endereco = `${empresa.endereco.logradouro || ''} ${empresa.endereco.numero || ''} ${empresa.endereco.complemento || ''}`.trim();
          dados.empresa.municipio = empresa.endereco.cidade;
          dados.empresa.uf = empresa.endereco.estado;
          dados.empresa.cep = empresa.endereco.cep;
        }
        
        if (empresa.telefones) {
          const telefones = [...(empresa.telefones.fixos || []), ...(empresa.telefones.celulares || [])];
          // Formatar telefones removendo caracteres especiais e limitando tamanho
          const telefonesFormatados = telefones.map(tel => tel.replace(/[^\d]/g, '')).filter(tel => tel.length > 0);
          dados.empresa.telefone = telefonesFormatados.join(';');
        }
        
        if (empresa.emails && empresa.emails.length > 0) {
          dados.empresa.email = empresa.emails.join(';');
        }
      }

      // Extrair sócios e participações
      if (jsonData.controle_societario && Array.isArray(jsonData.controle_societario)) {
        for (const socio of jsonData.controle_societario) {
          const socioData = {
            cpfCnpj: socio.cpf || socio.cnpj || '',
            nome: socio.nome || '',
            tipoPessoa: (socio.cpf && socio.cpf !== 'Não informado' ? 'F' : 'J') as 'F' | 'J',
            statusSocio: 'ATIVO'
          };
          
          dados.socios.push(socioData);
          
          // Adicionar participação societária
          if (socio.participacao) {
            const participacao = {
              cpfCnpj: socioData.cpfCnpj,
              participacaoPercentual: socio.participacao.percentual || 0,
              cargo: socio.cargo || 'SOCIO',
              dataEntrada: socio.entrada ? this.parseDateFromISO(socio.entrada) : undefined,
              dataSaida: undefined,
              statusParticipacao: 'ATIVA'
            };
            
            dados.participacoes.push(participacao);
          }
        }
      }

      // Extrair quadro administrativo
      if (jsonData.quadro_administrativo && Array.isArray(jsonData.quadro_administrativo)) {
        for (const admin of jsonData.quadro_administrativo) {
          const quadroData = {
            cpfCnpj: admin.cpf || admin.cnpj || '',
            cargo: admin.cargo || 'ADMINISTRADOR',
            dataEleicao: admin.eleito_em ? this.parseDateFromISO(admin.eleito_em) : undefined,
            statusCargo: 'ATIVO'
          };
          
          dados.quadroAdministrativo.push(quadroData);
        }
      }

    } catch (error) {
      console.error('Erro ao extrair dados do JSON:', error);
    }
  }

  /**
   * Converte string ISO para Date
   */
  private static parseDateFromISO(dateStr: string): Date | undefined {
    try {
      return new Date(dateStr);
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Extrai dados básicos da empresa
   */
  private static extrairDadosEmpresaBasicos(texto: string, empresa: any): void {
    // Razão Social
    const razaoSocialMatch = texto.match(/(?:razão social|razao social|nome empresarial)[:\s]*([^\n\r]+)/i);
    if (razaoSocialMatch) {
      empresa.razaoSocial = razaoSocialMatch[1].trim();
    }

    // Nome Fantasia
    const nomeFantasiaMatch = texto.match(/(?:nome fantasia|fantasia)[:\s]*([^\n\r]+)/i);
    if (nomeFantasiaMatch) {
      empresa.nomeFantasia = nomeFantasiaMatch[1].trim();
    }

    // Situação Cadastral
    const situacaoMatch = texto.match(/(?:situação|situacao)[:\s]*([^\n\r]+)/i);
    if (situacaoMatch) {
      empresa.situacaoCadastral = situacaoMatch[1].trim();
    }

    // Porte
    const porteMatch = texto.match(/(?:porte)[:\s]*([^\n\r]+)/i);
    if (porteMatch) {
      empresa.porte = porteMatch[1].trim();
    }

    // Natureza Jurídica
    const naturezaMatch = texto.match(/(?:natureza jurídica|natureza juridica)[:\s]*([^\n\r]+)/i);
    if (naturezaMatch) {
      empresa.naturezaJuridica = naturezaMatch[1].trim();
    }

    // Data de Abertura
    const dataAberturaMatch = texto.match(/(?:data de abertura|data abertura)[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
    if (dataAberturaMatch) {
      empresa.dataAbertura = this.parseDate(dataAberturaMatch[1]);
    }

    // Capital Social
    const capitalMatch = texto.match(/(?:capital social)[:\s]*R?\$?\s*([\d.,]+)/i);
    if (capitalMatch) {
      empresa.capitalSocial = this.parseCurrency(capitalMatch[1]);
    }

    // Endereço
    const enderecoMatch = texto.match(/(?:endereço|endereco)[:\s]*([^\n\r]+)/i);
    if (enderecoMatch) {
      empresa.endereco = enderecoMatch[1].trim();
    }

    // Município
    const municipioMatch = texto.match(/(?:município|municipio|cidade)[:\s]*([^\n\r]+)/i);
    if (municipioMatch) {
      empresa.municipio = municipioMatch[1].trim();
    }

    // UF
    const ufMatch = texto.match(/(?:uf|estado)[:\s]*([A-Z]{2})/i);
    if (ufMatch) {
      empresa.uf = ufMatch[1].toUpperCase();
    }

    // CEP
    const cepMatch = texto.match(/(?:cep)[:\s]*(\d{5}-?\d{3})/i);
    if (cepMatch) {
      empresa.cep = cepMatch[1];
    }

    // Telefone
    const telefoneMatch = texto.match(/(?:telefone|fone)[:\s]*([\d\s\-\(\)]+)/i);
    if (telefoneMatch) {
      empresa.telefone = telefoneMatch[1].trim();
    }

    // Email
    const emailMatch = texto.match(/(?:email|e-mail)[:\s]*([^\s\n\r]+@[^\s\n\r]+)/i);
    if (emailMatch) {
      empresa.email = emailMatch[1].trim();
    }

    // Atividade Principal
    const atividadeMatch = texto.match(/(?:atividade principal|cnae)[:\s]*([^\n\r]+)/i);
    if (atividadeMatch) {
      empresa.atividadePrincipal = atividadeMatch[1].trim();
    }
  }

  /**
   * Extrai sócios e participações societárias
   */
  private static extrairSociosEParticipacoes(texto: string, dados: DadosEmpresaExtraidos): void {
    // Procura por seções de sócios
    const sociosSection = texto.match(/(?:sócios|socios|quadro societário|quadro societario)(.*?)(?=quadro administrativo|administradores|fim|$)/is);
    
    if (sociosSection) {
      const sociosText = sociosSection[1];
      
      // Extrai informações de cada sócio
      const sociosMatches = sociosText.match(/(?:nome|cpf|cnpj)[:\s]*([^\n\r]+)/gi);
      
      if (sociosMatches) {
        for (const match of sociosMatches) {
          const socio = this.extrairDadosSocio(match);
          if (socio) {
            dados.socios.push(socio);
            
            // Procura participação correspondente
            const participacao = this.extrairParticipacaoSocietaria(match, sociosText);
            if (participacao) {
              participacao.cpfCnpj = socio.cpfCnpj;
              dados.participacoes.push(participacao);
            }
          }
        }
      }
    }
  }

  /**
   * Extrai dados de um sócio
   */
  private static extrairDadosSocio(texto: string): any | null {
    try {
      const socio: any = {
        cpfCnpj: '',
        nome: '',
        tipoPessoa: 'F' as 'F' | 'J',
        dataNascimento: undefined,
        telefone: undefined,
        email: undefined,
        endereco: undefined,
        cidade: undefined,
        estado: undefined,
        cep: undefined,
        statusSocio: 'ATIVO'
      };

      // CPF/CNPJ
      const cpfCnpjMatch = texto.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
      if (cpfCnpjMatch) {
        socio.cpfCnpj = cpfCnpjMatch[1].replace(/[^\d]/g, '');
        socio.tipoPessoa = socio.cpfCnpj.length === 11 ? 'F' : 'J';
      }

      // Nome
      const nomeMatch = texto.match(/(?:nome)[:\s]*([^\n\r]+)/i);
      if (nomeMatch) {
        socio.nome = nomeMatch[1].trim();
      }

      // Data de Nascimento
      const nascimentoMatch = texto.match(/(?:data de nascimento|nascimento)[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
      if (nascimentoMatch) {
        socio.dataNascimento = this.parseDate(nascimentoMatch[1]);
      }

      // Telefone
      const telefoneMatch = texto.match(/(?:telefone|fone)[:\s]*([\d\s\-\(\)]+)/i);
      if (telefoneMatch) {
        socio.telefone = telefoneMatch[1].trim();
      }

      // Email
      const emailMatch = texto.match(/(?:email|e-mail)[:\s]*([^\s\n\r]+@[^\s\n\r]+)/i);
      if (emailMatch) {
        socio.email = emailMatch[1].trim();
      }

      // Endereço
      const enderecoMatch = texto.match(/(?:endereço|endereco)[:\s]*([^\n\r]+)/i);
      if (enderecoMatch) {
        socio.endereco = enderecoMatch[1].trim();
      }

      // Cidade
      const cidadeMatch = texto.match(/(?:cidade|município|municipio)[:\s]*([^\n\r]+)/i);
      if (cidadeMatch) {
        socio.cidade = cidadeMatch[1].trim();
      }

      // Estado
      const estadoMatch = texto.match(/(?:estado|uf)[:\s]*([A-Z]{2})/i);
      if (estadoMatch) {
        socio.estado = estadoMatch[1].toUpperCase();
      }

      // CEP
      const cepMatch = texto.match(/(?:cep)[:\s]*(\d{5}-?\d{3})/i);
      if (cepMatch) {
        socio.cep = cepMatch[1];
      }

      return socio.cpfCnpj && socio.nome ? socio : null;
    } catch (error) {
      console.log('Erro ao extrair dados do sócio:', error);
      return null;
    }
  }

  /**
   * Extrai participação societária
   */
  private static extrairParticipacaoSocietaria(textoSocio: string, textoCompleto: string): any | null {
    try {
      const participacao: any = {
        participacaoPercentual: 0,
        cargo: undefined,
        dataEntrada: undefined,
        dataSaida: undefined,
        statusParticipacao: 'ATIVA'
      };

      // Percentual de participação
      const percentualMatch = textoCompleto.match(/(?:participação|participacao|percentual)[:\s]*(\d+[,.]?\d*)\s*%/i);
      if (percentualMatch) {
        participacao.participacaoPercentual = parseFloat(percentualMatch[1].replace(',', '.'));
      }

      // Cargo
      const cargoMatch = textoCompleto.match(/(?:cargo|função|funcao)[:\s]*([^\n\r]+)/i);
      if (cargoMatch) {
        participacao.cargo = cargoMatch[1].trim();
      }

      // Data de Entrada
      const entradaMatch = textoCompleto.match(/(?:data de entrada|entrada)[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
      if (entradaMatch) {
        participacao.dataEntrada = this.parseDate(entradaMatch[1]);
      }

      // Data de Saída
      const saidaMatch = textoCompleto.match(/(?:data de saída|saida|saída)[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
      if (saidaMatch) {
        participacao.dataSaida = this.parseDate(saidaMatch[1]);
      }

      return participacao.participacaoPercentual > 0 ? participacao : null;
    } catch (error) {
      console.log('Erro ao extrair participação societária:', error);
      return null;
    }
  }

  /**
   * Extrai quadro administrativo
   */
  private static extrairQuadroAdministrativo(texto: string, dados: DadosEmpresaExtraidos): void {
    // Procura por seção de quadro administrativo
    const quadroSection = texto.match(/(?:quadro administrativo|administradores|diretores)(.*?)(?=fim|$)/is);
    
    if (quadroSection) {
      const quadroText = quadroSection[1];
      
      // Extrai informações de cada administrador
      const administradoresMatches = quadroText.match(/(?:nome|cpf|cnpj)[:\s]*([^\n\r]+)/gi);
      
      if (administradoresMatches) {
        for (const match of administradoresMatches) {
          const administrador = this.extrairDadosAdministrador(match, quadroText);
          if (administrador) {
            dados.quadroAdministrativo.push(administrador);
          }
        }
      }
    }
  }

  /**
   * Extrai dados de um administrador
   */
  private static extrairDadosAdministrador(texto: string, textoCompleto: string): any | null {
    try {
      const administrador: any = {
        cpfCnpj: '',
        cargo: '',
        dataEleicao: undefined,
        dataFimMandato: undefined,
        statusCargo: 'ATIVO'
      };

      // CPF/CNPJ
      const cpfCnpjMatch = texto.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
      if (cpfCnpjMatch) {
        administrador.cpfCnpj = cpfCnpjMatch[1].replace(/[^\d]/g, '');
      }

      // Cargo
      const cargoMatch = textoCompleto.match(/(?:cargo|função|funcao)[:\s]*([^\n\r]+)/i);
      if (cargoMatch) {
        administrador.cargo = cargoMatch[1].trim();
      }

      // Data de Eleição
      const eleicaoMatch = textoCompleto.match(/(?:data de eleição|eleição|eleicao)[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
      if (eleicaoMatch) {
        administrador.dataEleicao = this.parseDate(eleicaoMatch[1]);
      }

      // Data de Fim de Mandato
      const fimMandatoMatch = textoCompleto.match(/(?:data de fim|fim de mandato|mandato)[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
      if (fimMandatoMatch) {
        administrador.dataFimMandato = this.parseDate(fimMandatoMatch[1]);
      }

      return administrador.cpfCnpj && administrador.cargo ? administrador : null;
    } catch (error) {
      console.log('Erro ao extrair dados do administrador:', error);
      return null;
    }
  }

  /**
   * Converte string de data para Date
   */
  private static parseDate(dateStr: string): Date | undefined {
    try {
      const [day, month, year] = dateStr.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Converte string de moeda para número
   */
  private static parseCurrency(currencyStr: string): number | undefined {
    try {
      return parseFloat(currencyStr.replace(/[^\d.,]/g, '').replace(',', '.'));
    } catch (error) {
      return undefined;
    }
  }
}
