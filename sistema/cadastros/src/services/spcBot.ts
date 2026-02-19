import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { SPCConfig, QueryResult } from '../types';
import { FileUtils } from '../utils/fileUtils';
import { Logger } from '../utils/logger';

export class SPCBot {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: SPCConfig;

  constructor(config: SPCConfig) {
    this.config = config;
  }

  /**
   * Inicializa o navegador
   */
  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true
    });

    this.page = await this.context.newPage();
    
    // Configura timeout
    this.page.setDefaultTimeout(this.config.browserTimeout);
  }

  /**
   * Primeira etapa do login - Operador e Senha
   */
  async firstLoginStep(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Navegador não inicializado');
    }

    try {
      console.log('Navegando para o SPC...');
      await this.page.goto(this.config.url);
      await this.page.waitForLoadState('networkidle');

      // Debug: mostra a URL atual
      const currentUrl = this.page.url();
      console.log(`URL atual: ${currentUrl}`);

      console.log('Preenchendo operador e senha...');
      console.log(`Operador: ${this.config.operador}`);
      console.log(`Senha: ${'*'.repeat(this.config.senha.length)}`);
      
      // Campo Operador - baseado na imagem, parece ter um valor pré-preenchido
      const operadorSelectors = [
        'input[type="text"]',
        'input[name*="operador"]',
        'input[placeholder*="operador"]',
        'input[id*="operador"]',
        'input[value*="108754760"]' // Valor que aparece na imagem
      ];

      let operadorField = null;
      for (const selector of operadorSelectors) {
        try {
          operadorField = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (operadorField) {
            console.log(`Campo operador encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!operadorField) {
        throw new Error('Campo operador não encontrado');
      }

      await operadorField.click();
      await operadorField.selectText();
      // Usa pressKey para lidar melhor com caracteres especiais
      await this.page.keyboard.press('Delete');
      await this.page.keyboard.type(this.config.operador, { delay: 100 });

      // Campo Senha
      const senhaSelectors = [
        'input[type="password"]',
        'input[name*="senha"]',
        'input[placeholder*="senha"]',
        'input[placeholder*="Senha"]'
      ];

      let senhaField = null;
      for (const selector of senhaSelectors) {
        try {
          senhaField = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (senhaField) {
            console.log(`Campo senha encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!senhaField) {
        throw new Error('Campo senha não encontrado');
      }

      await senhaField.click();
      // Usa keyboard.type para lidar melhor com caracteres especiais
      await this.page.keyboard.type(this.config.senha, { delay: 100 });

      // Botão Avançar
      const avancarButton = await this.page.waitForSelector('button:has-text("Avançar"), input[value="Avançar"], button[type="submit"]', { timeout: 10000 });
      await avancarButton.click();

      // Aguarda o redirecionamento
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(3000);

      // Verifica se ainda está na página de login (falha) ou foi redirecionado (sucesso)
      const loginUrl = this.page.url();
      console.log(`URL após primeira etapa: ${loginUrl}`);
      
      // Se ainda está na mesma página de login, pode ter falhado
      if (loginUrl === currentUrl) {
        console.log('Ainda na mesma página de login - primeira etapa falhou');
        return false;
      }

      console.log('Primeira etapa do login concluída!');
      return true;

    } catch (error) {
      console.error('Erro na primeira etapa do login:', error);
      return false;
    }
  }

  /**
   * Segunda etapa do login - Palavra Secreta
   */
  async secondLoginStep(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Navegador não inicializado');
    }

    try {
      console.log('Preenchendo palavra secreta...');
      console.log(`Palavra secreta: ${'*'.repeat(this.config.palavraSecreta.length)}`);
      
      // Campo Palavra Secreta - baseado na imagem, parece ser um campo de senha
      const palavraSecretaField = await this.page.waitForSelector('input[type="password"], input[name*="senha"], input[placeholder*="senha"], input[placeholder*="palavra"], input[placeholder*="secreta"]', { timeout: 10000 });
      await palavraSecretaField.click();
      // Usa keyboard.type para lidar melhor com caracteres especiais
      await this.page.keyboard.type(this.config.palavraSecreta, { delay: 100 });

      // Botão Avançar
      const avancarButton = await this.page.waitForSelector('button:has-text("Avançar"), input[value="Avançar"], button[type="submit"]', { timeout: 10000 });
      await avancarButton.click();

      // Aguarda o redirecionamento
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(3000);

      // Verifica se ainda está na página de login (falha) ou foi redirecionado (sucesso)
      const loginUrl2 = this.page.url();
      console.log(`URL após segunda etapa: ${loginUrl2}`);
      
      // Se ainda está na página de login, pode ter falhado
      if (loginUrl2.includes('login') || loginUrl2.includes('auth')) {
        console.log('Ainda na página de login - segunda etapa falhou');
        return false;
      }

      console.log('Segunda etapa do login concluída!');
      return true;

    } catch (error) {
      console.error('Erro na segunda etapa do login:', error);
      return false;
    }
  }

  /**
   * Aguarda o carregamento completo do resultado da consulta
   */
  async waitForConsultationResult(): Promise<void> {
    if (!this.page) {
      return;
    }

    try {
      console.log('Aguardando carregamento do resultado da consulta...');
      
      // Aguarda um tempo inicial para a página começar a carregar
      await this.page.waitForTimeout(3000);

      // Aguarda elementos específicos que indicam que a consulta foi processada
      const resultSelectors = [
        // Tabelas de dados da consulta
        'table[class*="table"]',
        'table[class*="result"]',
        'table[class*="data"]',
        'div[class*="result"]',
        'div[class*="consulta"]',
        'div[class*="dados"]',
        // Elementos específicos do SPC
        'div[class*="spc"]',
        'div[class*="positivo"]',
        'div[class*="negativo"]',
        // Qualquer conteúdo que indique resultado
        'div:has-text("CNPJ")',
        'div:has-text("Razão Social")',
        'div:has-text("Nome Fantasia")',
        'div:has-text("Situação")',
        'div:has-text("Data")',
        // Elementos de loading que devem desaparecer
        '[class*="loading"]',
        '[class*="spinner"]',
        '[class*="carregando"]'
      ];

      // Aguarda pelo menos um elemento de resultado aparecer
      let resultFound = false;
      for (const selector of resultSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          console.log(`Elemento de resultado encontrado: ${selector}`);
          resultFound = true;
          break;
        } catch (e) {
          continue;
        }
      }

      if (resultFound) {
        console.log('Resultado da consulta detectado, aguardando carregamento completo...');
        
        // Aguarda elementos de loading desaparecerem
        const loadingSelectors = [
          '[class*="loading"]',
          '[class*="spinner"]',
          '[class*="carregando"]',
          '[class*="processando"]',
          'div:has-text("Carregando")',
          'div:has-text("Processando")'
        ];

        for (const loadingSelector of loadingSelectors) {
          try {
            await this.page.waitForSelector(loadingSelector, { state: 'hidden', timeout: 10000 });
            console.log(`Elemento de loading desapareceu: ${loadingSelector}`);
          } catch (e) {
            // Ignora se não encontrar elementos de loading
          }
        }

        // Aguarda um tempo adicional para garantir que tudo carregou
        await this.page.waitForTimeout(3000);
        
        // Aguarda que não haja mais requisições de rede
        await this.page.waitForLoadState('networkidle');
        
        console.log('Resultado da consulta carregado completamente!');
      } else {
        console.log('Nenhum elemento de resultado específico encontrado, aguardando tempo padrão...');
        // Se não encontrar elementos específicos, aguarda um tempo maior
        await this.page.waitForTimeout(10000);
        await this.page.waitForLoadState('networkidle');
      }

      // Verifica se a página tem conteúdo (não está em branco)
      const pageContent = await this.page.content();
      if (pageContent.length < 1000) {
        console.log('Página parece estar vazia, aguardando mais tempo...');
        await this.page.waitForTimeout(5000);
      }

      // Aguarda um último tempo para garantir que tudo está carregado
      await this.page.waitForTimeout(2000);

    } catch (error) {
      console.log('Erro ao aguardar resultado da consulta:', error);
      // Mesmo com erro, aguarda um tempo mínimo
      await this.page.waitForTimeout(5000);
    }
  }

  /**
   * Fecha propaganda se aparecer
   */
  async closeAdvertisement(): Promise<void> {
    if (!this.page) {
      return;
    }

    try {
      console.log('Verificando se há propaganda para fechar...');
      
      // Aguarda um pouco para a propaganda carregar
      await this.page.waitForTimeout(2000);
      
      // Procura pelo botão de fechar propaganda específico do SPC
      const closeSelectors = [
        'img[title="Fechar"][alt="Fechar"]',
        'img[src="/spc/images/hsm/close_btn_02.png"]',
        'img[onclick="fecharCampanhaTelaCheia();"]',
        // Seletores genéricos como fallback
        'button[aria-label="Fechar"]',
        'button[title="Fechar"]',
        '.close-button',
        '.modal-close',
        'button:has-text("×")',
        'button:has-text("Fechar")',
        '[class*="close"]',
        '[id*="close"]'
      ];

      for (const selector of closeSelectors) {
        try {
          const closeButton = await this.page.waitForSelector(selector, { timeout: 2000 });
          if (closeButton) {
            await closeButton.click();
            console.log(`Primeira propaganda fechada com seletor: ${selector}`);
            await this.page.waitForTimeout(1000);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Verifica se há segunda propaganda (botão "Não quero incluir")
      console.log('Verificando se há segunda propaganda...');
      const segundaPropagandaSelectors = [
        'a[class="buttonModalNaoIncluir"]',
        'a[onclick*="DecideAction"]',
        'a:has-text("Não quero incluir")',
        'button:has-text("Não quero incluir")',
        'a:has-text("Não incluir")',
        'button:has-text("Não incluir")'
      ];

      for (const selector of segundaPropagandaSelectors) {
        try {
          const segundaPropagandaButton = await this.page.waitForSelector(selector, { timeout: 2000 });
          if (segundaPropagandaButton) {
            await segundaPropagandaButton.click();
            console.log(`Segunda propaganda fechada com seletor: ${selector}`);
            await this.page.waitForTimeout(1000);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Tenta clicar na área do X (canto superior direito) como último recurso
      try {
        await this.page.click('body', { position: { x: 1200, y: 50 } });
        console.log('Clicou na área do X da propaganda');
        await this.page.waitForTimeout(1000);
        return;
      } catch (e) {
        // Ignora se não conseguir clicar
      }

      console.log('Nenhuma propaganda encontrada para fechar.');

    } catch (error) {
      console.log('Erro ao tentar fechar propaganda:', error);
    }
  }

  /**
   * Navega para a seção de Consultas
   */
  async navigateToConsultas(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Navegador não inicializado');
    }

    try {
      console.log('Navegando para Consultas...');
      
      // Aguarda a página carregar completamente
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(3000);
      
      // Procura pelo card de Consultas - baseado na imagem com ícone de lupa
      const consultasSelectors = [
        'text="Consultas"',
        '[class*="consultas"]',
        '[id*="consultas"]',
        // Procura por elementos com ícone de lupa (magnifying glass)
        '[class*="magnifying"]',
        '[class*="search"]',
        'i[class*="search"]',
        'i[class*="magnifying"]',
        // Procura por cards clicáveis
        'div[class*="card"]:has-text("Consultas")',
        'div[class*="service"]:has-text("Consultas")',
        'div[class*="menu"]:has-text("Consultas")',
        // Procura por elementos com texto "Consultas" e ícone
        'div:has-text("Consultas")',
        'span:has-text("Consultas")',
        'a:has-text("Consultas")'
      ];

      let consultasCard = null;
      for (const selector of consultasSelectors) {
        try {
          consultasCard = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (consultasCard) {
            console.log(`Card Consultas encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!consultasCard) {
        throw new Error('Card Consultas não encontrado');
      }

      await consultasCard.click();

      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(2000);

      console.log('Navegação para Consultas concluída!');
      return true;

    } catch (error) {
      console.error('Erro ao navegar para Consultas:', error);
      return false;
    }
  }

  /**
   * Navega para SPC + POSITIVO AVANÇADO PJ
   */
  async navigateToSPCPositivoAvancado(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Navegador não inicializado');
    }

    try {
      console.log('Navegando para SPC + POSITIVO AVANÇADO PJ...');
      
      // Primeiro, tenta clicar em "CONSULTA PESSOA JURÍDICA" para abrir o menu lateral
      console.log('Tentando abrir menu lateral...');
      const consultaPJSelectors = [
        'text="CONSULTA PESSOA JURÍDICA"',
        'a:has-text("CONSULTA PESSOA JURÍDICA")',
        'div:has-text("CONSULTA PESSOA JURÍDICA")',
        'span:has-text("CONSULTA PESSOA JURÍDICA")',
        // Procura por variações
        'text*="PESSOA JURÍDICA"',
        'text*="CONSULTA PESSOA"'
      ];

      let consultaPJItem = null;
      for (const selector of consultaPJSelectors) {
        try {
          consultaPJItem = await this.page.waitForSelector(selector, { timeout: 2000 });
          if (consultaPJItem) {
            console.log(`CONSULTA PESSOA JURÍDICA encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (consultaPJItem) {
        await consultaPJItem.click();
        console.log('Clicou em CONSULTA PESSOA JURÍDICA - menu lateral aberto');
        await this.page.waitForTimeout(2000);
      } else {
        console.log('CONSULTA PESSOA JURÍDICA não encontrado - menu pode já estar aberto');
      }

      // Aguarda o menu expandir
      await this.page.waitForTimeout(2000);

      // Procura pelo item SPC + POSITIVO AVANÇADO PJ no menu lateral
      const spcPositivoSelectors = [
        'text="SPC + POSITIVO AVANÇADO PJ"',
        'a:has-text("SPC + POSITIVO AVANÇADO PJ")',
        'div:has-text("SPC + POSITIVO AVANÇADO PJ")',
        'span:has-text("SPC + POSITIVO AVANÇADO PJ")',
        // Procura por variações do texto
        'text*="SPC + POSITIVO AVANÇADO"',
        'text*="POSITIVO AVANÇADO PJ"',
        'text*="AVANÇADO PJ"'
      ];

      let spcPositivoItem = null;
      for (const selector of spcPositivoSelectors) {
        try {
          spcPositivoItem = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (spcPositivoItem) {
            console.log(`SPC + POSITIVO AVANÇADO PJ encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!spcPositivoItem) {
        throw new Error('SPC + POSITIVO AVANÇADO PJ não encontrado no menu');
      }

      await spcPositivoItem.click();

      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(2000);

      console.log('Navegação para SPC + POSITIVO AVANÇADO PJ concluída!');
      return true;

    } catch (error) {
      console.error('Erro ao navegar para SPC + POSITIVO AVANÇADO PJ:', error);
      return false;
    }
  }

  /**
   * Preenche o CNPJ e clica em consultar
   */
  async queryCNPJ(cnpj: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Navegador não inicializado');
    }

    try {
      console.log(`Preenchendo CNPJ: ${cnpj}`);

      // Campo CNPJ - usando o seletor correto baseado no elemento fornecido
      const cnpjSelectors = [
        'input[name="filtros[0].numeroDocumento"]',
        'input[id="filtros0.numeroDocumento"]',
        'input[class="form-control"][onkeypress*="onKeyPressCPFeCNPJ"]',
        'input[onkeypress*="onKeyPressCPFeCNPJ"]',
        'input[onchange*="limparDadosHistoricoPagamentoCP"]',
        // Seletores genéricos como fallback
        'input[name*="cnpj"]',
        'input[placeholder*="CNPJ"]',
        'input[id*="cnpj"]'
      ];

      let cnpjField = null;
      for (const selector of cnpjSelectors) {
        try {
          cnpjField = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (cnpjField) {
            console.log(`Campo CNPJ encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!cnpjField) {
        throw new Error('Campo CNPJ não encontrado');
      }

      await cnpjField.click();
      await cnpjField.type(cnpj, { delay: 100 });

      // Scroll para baixo para encontrar o botão consultar
      console.log('Procurando botão consultar...');
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await this.page.waitForTimeout(1000);

      // Procura pelo botão consultar - usando o seletor correto baseado no elemento fornecido
      const consultarSelectors = [
        'input[id="btnFilterConsulta"]',
        'input[class*="btn"][value="Consultar"]',
        'input[onclick*="submeterConsulta"]',
        'input[class*="np-tour-step-filtro-6"]',
        // Seletores genéricos como fallback
        'button:has-text("Consultar")',
        'input[value="Consultar"]',
        'button[type="submit"]'
      ];

      let consultarButton = null;
      for (const selector of consultarSelectors) {
        try {
          consultarButton = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (consultarButton) {
            console.log(`Botão consultar encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!consultarButton) {
        throw new Error('Botão consultar não encontrado');
      }

      await consultarButton.click();

      // Aguarda o resultado da consulta
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(5000);

      // Verifica se há erro de servidor (505, 502, etc.)
      const currentUrl = this.page.url();
      if (currentUrl.includes('error') || currentUrl.includes('500') || currentUrl.includes('502') || currentUrl.includes('503')) {
        throw new Error('Erro de servidor do SPC (505 Gateway ou similar)');
      }

      // Verifica se há propaganda após a consulta
      await this.closeAdvertisement();

      // Verifica se apareceu a mensagem "CNPJ inválido"
      await this.checkForInvalidCNPJMessage(cnpj);

      // Aguarda o carregamento completo do resultado da consulta
      console.log('Aguardando carregamento completo do resultado...');
      await this.waitForConsultationResult();

      console.log('Consulta realizada com sucesso!');
      return true;

    } catch (error) {
      console.error('Erro durante a consulta:', error);
      return false;
    }
  }

  /**
   * Verifica se apareceu a mensagem "CNPJ inválido"
   */
  async checkForInvalidCNPJMessage(cnpj: string): Promise<void> {
    if (!this.page) {
      return;
    }

    try {
      // Aguarda um pouco para a mensagem aparecer
      await this.page.waitForTimeout(2000);

      // Procura pela mensagem "CNPJ inválido" em diferentes formatos
      const invalidCNPJSelectors = [
        'text="CNPJ inválido"',
        'text="CNPJ inválido."',
        'text*="CNPJ inválido"',
        'text*="inválido"',
        '[class*="error"]:has-text("CNPJ")',
        '[class*="alert"]:has-text("CNPJ")',
        '[class*="modal"]:has-text("CNPJ")',
        'div:has-text("CNPJ inválido")',
        'span:has-text("CNPJ inválido")',
        'p:has-text("CNPJ inválido")'
      ];

      for (const selector of invalidCNPJSelectors) {
        try {
          const element = await this.page.waitForSelector(selector, { timeout: 1000 });
          if (element) {
            const message = await element.textContent();
            console.log(`⚠️  Mensagem de CNPJ inválido detectada: ${message}`);
            
            // Loga a mensagem
            Logger.cnpjInvalid(cnpj, `Mensagem: ${message}`);
            
            // Tenta fechar o modal/popup se existir
            await this.closeInvalidCNPJModal();
            
            return;
          }
        } catch (e) {
          continue;
        }
      }

      // Verifica se há modais ou popups que possam conter a mensagem
      const modalSelectors = [
        '[role="dialog"]',
        '[class*="modal"]',
        '[class*="popup"]',
        '[class*="alert"]',
        '[class*="error"]'
      ];

      for (const modalSelector of modalSelectors) {
        try {
          const modal = await this.page.waitForSelector(modalSelector, { timeout: 1000 });
          if (modal) {
            const modalText = await modal.textContent();
            if (modalText && modalText.toLowerCase().includes('cnpj') && modalText.toLowerCase().includes('inválido')) {
              console.log(`⚠️  CNPJ inválido detectado em modal: ${modalText}`);
              Logger.cnpjInvalid(cnpj, `Modal: ${modalText}`);
              await this.closeInvalidCNPJModal();
              return;
            }
          }
        } catch (e) {
          continue;
        }
      }

    } catch (error) {
      // Ignora erros na verificação
      console.log('Erro ao verificar mensagem de CNPJ inválido:', error);
    }
  }

  /**
   * Tenta fechar o modal de CNPJ inválido
   */
  async closeInvalidCNPJModal(): Promise<void> {
    if (!this.page) {
      return;
    }

    try {
      // Procura por botões de fechar o modal
      const closeSelectors = [
        'button:has-text("OK")',
        'button:has-text("Fechar")',
        'button:has-text("×")',
        'button[aria-label="Fechar"]',
        'button[title="Fechar"]',
        '[class*="close"]',
        '[class*="modal-close"]',
        'button[type="button"]'
      ];

      for (const selector of closeSelectors) {
        try {
          const closeButton = await this.page.waitForSelector(selector, { timeout: 1000 });
          if (closeButton) {
            await closeButton.click();
            console.log('Modal de CNPJ inválido fechado');
            await this.page.waitForTimeout(1000);
            return;
          }
        } catch (e) {
          continue;
        }
      }

      // Se não encontrou botão específico, tenta pressionar Escape
      await this.page.keyboard.press('Escape');
      console.log('Tentou fechar modal com Escape');

    } catch (error) {
      console.log('Erro ao fechar modal de CNPJ inválido:', error);
    }
  }

  /**
   * Clica no botão imprimir e baixa o PDF automaticamente
   */
  async clickPrintButton(): Promise<string | null> {
    if (!this.page) {
      throw new Error('Navegador não inicializado');
    }

    try {
      console.log('Tentando imprimir página...');
      
      // Tenta primeiro gerar PDF diretamente via Playwright (mais confiável)
      console.log('Tentando gerar PDF diretamente via Playwright...');
      const directPdfPath = await this.generatePDFDirectly();
      if (directPdfPath) {
        return directPdfPath;
      }

      // Se falhar, tenta com atalho de teclado
      console.log('Tentando atalho de teclado Ctrl+P...');
      const pdfPath = await this.printWithKeyboardShortcut();
      if (pdfPath) {
        return pdfPath;
      }

      // Se falhar, tenta clicar no botão de impressão
      console.log('Tentando clicar no botão imprimir...');
      return await this.printWithButtonClick();

    } catch (error) {
      console.error('Erro ao imprimir:', error);
      return null;
    }
  }

  /**
   * Gera PDF diretamente usando a funcionalidade nativa do Playwright
   */
  async generatePDFDirectly(): Promise<string | null> {
    if (!this.page) {
      throw new Error('Navegador não inicializado');
    }

    try {
      console.log('Gerando PDF diretamente via Playwright...');
      
      // Aguarda um tempo adicional para garantir que a página está completamente carregada
      console.log('Aguardando carregamento final da página...');
      await this.page.waitForTimeout(5000);
      
      // Verifica se a página tem conteúdo suficiente
      const pageContent = await this.page.content();
      if (pageContent.length < 2000) {
        console.log('Página parece ter pouco conteúdo, aguardando mais tempo...');
        await this.page.waitForTimeout(10000);
      }

      // Verifica se há elementos visíveis na página
      const visibleElements = await this.page.$$eval('*', elements => 
        elements.filter(el => {
          const style = window.getComputedStyle(el);
          const htmlEl = el as HTMLElement;
          return style.display !== 'none' && 
                 style.visibility !== 'hidden' && 
                 htmlEl.offsetWidth > 0 && 
                 htmlEl.offsetHeight > 0;
        }).length
      );

      console.log(`Elementos visíveis na página: ${visibleElements}`);
      
      if (visibleElements < 10) {
        console.log('Poucos elementos visíveis detectados, aguardando mais tempo...');
        await this.page.waitForTimeout(10000);
      }

      // Aguarda que não haja mais requisições de rede
      await this.page.waitForLoadState('networkidle');
      
      // Aguarda um último tempo para garantir estabilidade
      await this.page.waitForTimeout(3000);
      
      // Gera nome do arquivo PDF
      const fileName = FileUtils.generateFileName(this.config.cnpjToQuery, 'pdf');
      const filePath = `${this.config.downloadPath}/${fileName}`;

      console.log('Iniciando geração do PDF...');
      
      // Gera o PDF diretamente da página atual
      await this.page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        },
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;">Consulta CNPJ - SPC</div>',
        footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;">Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>'
      });

      console.log(`PDF gerado diretamente: ${filePath}`);
      return filePath;

    } catch (error) {
      console.log('Erro ao gerar PDF diretamente:', error);
      return null;
    }
  }

  /**
   * Imprime usando atalho de teclado Ctrl+P
   */
  async printWithKeyboardShortcut(): Promise<string | null> {
    if (!this.page) {
      throw new Error('Navegador não inicializado');
    }

    try {
      // Configura o download ANTES de usar o atalho
      console.log('Configurando interceptação de download...');
      const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });

      // Usa o atalho Ctrl+P para abrir a janela de impressão
      console.log('Pressionando Ctrl+P...');
      await this.page.keyboard.press('Control+p');
      
      // Aguarda a janela de impressão aparecer
      await this.page.waitForTimeout(3000);

      // Aguarda a mudança para a página de impressão (chrome://print/)
      console.log('Aguardando mudança para página de impressão...');
      try {
        await this.page.waitForURL('**/chrome://print/**', { timeout: 10000 });
        console.log('Mudou para página de impressão!');
      } catch (e) {
        console.log('Não mudou para chrome://print/, continuando...');
      }

      // Configura para salvar como PDF
      await this.configurePrintToPDF();

      // Procura pelo botão "Imprimir" na página de impressão
      console.log('Procurando botão Imprimir na página de impressão...');
      const printDialogSelectors = [
        'cr-button.action-button',
        'cr-button[class="action-button"]',
        'cr-button[role="button"]',
        'cr-button:has-text("Imprimir")',
        'button:has-text("Imprimir")',
        'button[class*="action"]',
        'button[class*="print"]'
      ];

      let printDialogButton = null;
      for (const selector of printDialogSelectors) {
        try {
          printDialogButton = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (printDialogButton) {
            console.log(`Botão imprimir da página de impressão encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (printDialogButton) {
        console.log('Clicando no botão Imprimir da página de impressão...');
        await printDialogButton.click();
        console.log('Clicou no botão Imprimir da página de impressão');
      } else {
        console.log('Botão Imprimir da página de impressão não encontrado');
      }

      // Aguarda o download do PDF
      console.log('Aguardando download do PDF...');
      try {
        const download = await downloadPromise;
        
        // Gera nome do arquivo PDF
        const fileName = FileUtils.generateFileName(this.config.cnpjToQuery, 'pdf');
        const filePath = `${this.config.downloadPath}/${fileName}`;

        // Salva o arquivo PDF
        await download.saveAs(filePath);

        console.log(`PDF salvo: ${filePath}`);
        return filePath;
      } catch (downloadError) {
        console.log('Download não iniciado automaticamente, tentando salvar com Ctrl+S...');
        
        // Tenta salvar com Ctrl+S
        try {
          await this.page.keyboard.press('Control+s');
          await this.page.waitForTimeout(2000);
          
          // Aguarda o download após Ctrl+S
          const download = await this.page.waitForEvent('download', { timeout: 10000 });
          const fileName = FileUtils.generateFileName(this.config.cnpjToQuery, 'pdf');
          const filePath = `${this.config.downloadPath}/${fileName}`;
          await download.saveAs(filePath);
          console.log(`PDF salvo via Ctrl+S: ${filePath}`);
          return filePath;
        } catch (ctrlSError) {
          console.log('Ctrl+S também falhou, tentando aguardar mais tempo...');
          await this.page.waitForTimeout(5000);
          
          // Tenta novamente aguardar o download
          try {
            const download = await this.page.waitForEvent('download', { timeout: 10000 });
            const fileName = FileUtils.generateFileName(this.config.cnpjToQuery, 'pdf');
            const filePath = `${this.config.downloadPath}/${fileName}`;
            await download.saveAs(filePath);
            console.log(`PDF salvo: ${filePath}`);
            return filePath;
          } catch (retryError) {
            console.log('Download não foi iniciado via atalho de teclado.');
            return null;
          }
        }
      }

    } catch (error) {
      console.error('Erro ao imprimir com atalho de teclado:', error);
      return null;
    }
  }

  /**
   * Imprime clicando no botão de impressão
   */
  async printWithButtonClick(): Promise<string | null> {
    if (!this.page) {
      throw new Error('Navegador não inicializado');
    }

    try {
      // Configura o download ANTES de clicar no botão imprimir
      console.log('Configurando interceptação de download...');
      const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });
      
      // Procura pelo botão imprimir - usando o seletor específico do Chromium
      const printSelectors = [
        'cr-button:has-text("Imprimir")',
        'cr-button[class="action-button"]',
        'cr-button[role="button"]',
        'cr-button',
        // Seletores genéricos como fallback
        'button:has-text("Imprimir")',
        'a:has-text("Imprimir")',
        'input[value="Imprimir"]',
        // Procura por botões com borda azul (como na imagem)
        'button[class*="btn"][style*="border"]',
        'button[class*="btn-outline"]',
        'button[class*="btn-primary"]',
        // Procura por elementos no canto superior direito
        'button[style*="position"]',
        'button[style*="right"]',
        // Seletores específicos baseados na imagem
        'button[class*="btn"][class*="outline-primary"]',
        'button[class*="btn"][class*="border"]',
        '[class*="print"]',
        '[id*="print"]',
        // Procura por qualquer botão clicável
        'button[type="button"]',
        'input[type="button"]'
      ];

      let printButton = null;
      for (const selector of printSelectors) {
        try {
          printButton = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (printButton) {
            console.log(`Botão imprimir encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!printButton) {
        throw new Error('Botão imprimir não encontrado');
      }

      // Aguarda um pouco antes de clicar
      await this.page.waitForTimeout(1000);
      
      // Clica no botão imprimir usando JavaScript para evitar timeout
      try {
        await printButton.click({ timeout: 5000 });
        console.log('Clique normal funcionou');
      } catch (e) {
        console.log('Clique normal falhou, tentando forçar via JavaScript...');
        try {
          await this.page.evaluate((button) => {
            // Tenta diferentes métodos de clique
            const element = button as HTMLElement;
            if (element.click) {
              element.click();
            } else if (element.dispatchEvent) {
              element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            } else {
              // Para elementos customizados como cr-button
              const event = new MouseEvent('click', { bubbles: true, cancelable: true });
              element.dispatchEvent(event);
            }
          }, printButton);
          console.log('Clique via JavaScript funcionou');
        } catch (jsError) {
          console.log('Clique via JavaScript também falhou, mas pode ter funcionado');
        }
      }

      // Aguarda a janela de impressão aparecer
      console.log('Aguardando janela de impressão...');
      await this.page.waitForTimeout(3000);

      // Aguarda a mudança para a página de impressão (chrome://print/)
      console.log('Aguardando mudança para página de impressão...');
      try {
        await this.page.waitForURL('**/chrome://print/**', { timeout: 10000 });
        console.log('Mudou para página de impressão!');
      } catch (e) {
        console.log('Não mudou para chrome://print/, continuando...');
      }

      // Configura para salvar como PDF
      await this.configurePrintToPDF();

      // Procura pelo botão "Imprimir" na página de impressão
      console.log('Procurando botão Imprimir na página de impressão...');
      const printDialogSelectors = [
        'cr-button.action-button',
        'cr-button[class="action-button"]',
        'cr-button[role="button"]',
        'cr-button:has-text("Imprimir")',
        'button:has-text("Imprimir")',
        'button[class*="action"]',
        'button[class*="print"]'
      ];

      let printDialogButton = null;
      for (const selector of printDialogSelectors) {
        try {
          printDialogButton = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (printDialogButton) {
            console.log(`Botão imprimir da página de impressão encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (printDialogButton) {
        console.log('Clicando no botão Imprimir da página de impressão...');
        await printDialogButton.click();
        console.log('Clicou no botão Imprimir da página de impressão');
      } else {
        console.log('Botão Imprimir da página de impressão não encontrado');
      }

      // Aguarda o download do PDF
      console.log('Aguardando download do PDF...');
      try {
        const download = await downloadPromise;
        
        // Gera nome do arquivo PDF
        const fileName = FileUtils.generateFileName(this.config.cnpjToQuery, 'pdf');
        const filePath = `${this.config.downloadPath}/${fileName}`;

        // Salva o arquivo PDF
        await download.saveAs(filePath);

        console.log(`PDF salvo: ${filePath}`);
        return filePath;
      } catch (downloadError) {
        console.log('Download não iniciado automaticamente, tentando aguardar mais tempo...');
        await this.page.waitForTimeout(5000);
        
        // Tenta novamente aguardar o download
        try {
          const download = await this.page.waitForEvent('download', { timeout: 10000 });
          const fileName = FileUtils.generateFileName(this.config.cnpjToQuery, 'pdf');
          const filePath = `${this.config.downloadPath}/${fileName}`;
          await download.saveAs(filePath);
          console.log(`PDF salvo: ${filePath}`);
          return filePath;
        } catch (retryError) {
          console.log('Download não foi iniciado. O PDF pode ter sido salvo automaticamente ou requer interação manual.');
          return null;
        }
      }

    } catch (error) {
      console.error('Erro ao clicar em imprimir:', error);
      return null;
    }
  }

  /**
   * Configura a impressão para salvar como PDF
   */
  async configurePrintToPDF(): Promise<void> {
    if (!this.page) {
      throw new Error('Navegador não inicializado');
    }

    try {
      console.log('Configurando impressão para salvar como PDF...');

      // Aguarda um pouco para a página de impressão carregar completamente
      await this.page.waitForTimeout(2000);

      // Procura pelo dropdown de impressora e seleciona "Salvar como PDF"
      const printerSelectors = [
        'select[name="printer"]',
        'select[class*="printer"]',
        'select[id*="printer"]',
        'select[aria-label*="printer"]',
        'select[aria-label*="impressora"]',
        'select',
        // Seletores específicos do Chrome
        'cr-select',
        'select[role="combobox"]'
      ];

      let printerSelect = null;
      for (const selector of printerSelectors) {
        try {
          printerSelect = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (printerSelect) {
            console.log(`Dropdown de impressora encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (printerSelect) {
        // Tenta diferentes opções de PDF
        const pdfOptions = [
          'Salvar como PDF',
          'Save as PDF',
          'Microsoft Print to PDF',
          'PDF',
          'Microsoft Print to PDF',
          'Adobe PDF'
        ];

        let selected = false;
        for (const option of pdfOptions) {
          try {
            await printerSelect.selectOption(option);
            console.log(`Selecionado "${option}"`);
            selected = true;
            break;
          } catch (e) {
            continue;
          }
        }

        if (!selected) {
          console.log('Não foi possível selecionar PDF no dropdown, tentando clicar...');
          // Tenta clicar no dropdown e depois selecionar
          try {
            await printerSelect.click();
            await this.page.waitForTimeout(1000);
            
            // Procura por opções de PDF na lista
            const pdfOptionSelectors = [
              'option:has-text("PDF")',
              'option:has-text("Salvar")',
              'option:has-text("Save")',
              'option[value*="pdf"]',
              'option[value*="PDF"]'
            ];

            for (const optionSelector of pdfOptionSelectors) {
              try {
                const option = await this.page.waitForSelector(optionSelector, { timeout: 2000 });
                if (option) {
                  await option.click();
                  console.log('Selecionado PDF via clique na opção');
                  selected = true;
                  break;
                }
              } catch (e) {
                continue;
              }
            }
          } catch (e) {
            console.log('Erro ao tentar clicar no dropdown');
          }
        }
      } else {
        console.log('Dropdown de impressora não encontrado, tentando continuar...');
      }

      // Aguarda um pouco após configurar a impressora
      await this.page.waitForTimeout(1000);

    } catch (error) {
      console.log('Erro ao configurar impressão para PDF:', error);
    }
  }

  /**
   * Salva como PDF
   */
  async saveAsPDF(): Promise<string | null> {
    if (!this.page) {
      throw new Error('Navegador não inicializado');
    }

    try {
      console.log('Configurando salvamento como PDF...');

      // Aguarda a janela de impressão carregar
      await this.page.waitForTimeout(3000);

      // Configura o download
      const downloadPromise = this.page.waitForEvent('download');

      // Procura pelo dropdown de impressora e seleciona "Salvar como PDF"
      const printerSelectors = [
        'select[name="printer"]',
        'select[class*="printer"]',
        'select[id*="printer"]',
        'select'
      ];

      let printerSelect = null;
      for (const selector of printerSelectors) {
        try {
          printerSelect = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (printerSelect) {
            console.log(`Dropdown de impressora encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (printerSelect) {
        await printerSelect.selectOption('Salvar como PDF');
        console.log('Selecionado "Salvar como PDF"');
      } else {
        console.log('Dropdown de impressora não encontrado, tentando continuar...');
      }

      // Procura pelo botão salvar - usando o seletor específico do Chrome
      const saveSelectors = [
        'button[class*="c01123"][class*="c01153"][class*="c01124"]',
        'button span:has-text("Salvar")',
        'button[class*="c01123"] span:has-text("Salvar")',
        'button[class*="c01153"] span:has-text("Salvar")',
        'button[class*="c01124"] span:has-text("Salvar")',
        // Seletores genéricos como fallback
        'button:has-text("Salvar")',
        'input[value="Salvar"]',
        'button[type="submit"]',
        'button:has-text("Save")',
        'input[value="Save"]'
      ];

      let saveButton = null;
      for (const selector of saveSelectors) {
        try {
          saveButton = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (saveButton) {
            console.log(`Botão salvar encontrado com seletor: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (saveButton) {
        await saveButton.click();
        console.log('Clicou em salvar');
      } else {
        console.log('Botão salvar não encontrado, tentando aguardar download...');
      }

      // Aguarda o download
      try {
        const download = await downloadPromise;
        
        // Gera nome do arquivo
        const fileName = FileUtils.generateFileName(this.config.cnpjToQuery);
        const filePath = `${this.config.downloadPath}/${fileName}`;

        // Salva o arquivo
        await download.saveAs(filePath);

        console.log(`Documento salvo como PDF: ${filePath}`);
        return filePath;
      } catch (e) {
        console.log('Download não detectado, mas HTML já foi salvo');
        return null;
      }

    } catch (error) {
      console.error('Erro ao salvar como PDF:', error);
      return null;
    }
  }

  /**
   * Executa o processo completo de consulta
   */
  async executeQuery(cnpj: string): Promise<QueryResult> {
    const result: QueryResult = {
      success: false,
      cnpj,
      timestamp: new Date()
    };

    try {
      // Inicializa o sistema de log
      Logger.initialize();
      
      // Garante que o diretório de download existe
      FileUtils.ensureDownloadDirectory(this.config.downloadPath);

      // Inicializa o navegador
      await this.initialize();

      // Primeira etapa do login (Operador e Senha)
      const firstLoginSuccess = await this.firstLoginStep();
      if (!firstLoginSuccess) {
        result.error = 'Falha na primeira etapa do login (operador e senha)';
        return result;
      }

      // Segunda etapa do login (Palavra Secreta)
      const secondLoginSuccess = await this.secondLoginStep();
      if (!secondLoginSuccess) {
        result.error = 'Falha na segunda etapa do login (palavra secreta)';
        return result;
      }

      // Fecha propaganda se aparecer
      await this.closeAdvertisement();

      // Navega para Consultas
      const consultasSuccess = await this.navigateToConsultas();
      if (!consultasSuccess) {
        result.error = 'Falha ao navegar para Consultas';
        return result;
      }

      // Navega para SPC + POSITIVO AVANÇADO PJ
      const spcPositivoSuccess = await this.navigateToSPCPositivoAvancado();
      if (!spcPositivoSuccess) {
        result.error = 'Falha ao navegar para SPC + POSITIVO AVANÇADO PJ';
        return result;
      }

      // Realiza a consulta do CNPJ
      const querySuccess = await this.queryCNPJ(cnpj);
      if (!querySuccess) {
        result.error = 'Falha na consulta do CNPJ';
        return result;
      }

      // Aguarda um tempo adicional antes de gerar o PDF
      console.log('Aguardando estabilização da página antes de gerar PDF...');
      if (this.page) {
        await this.page.waitForTimeout(5000);
      }

      // Clica no botão imprimir e baixa o PDF
      const filePath = await this.clickPrintButton();
      if (!filePath) {
        result.error = 'Falha ao baixar PDF';
        return result;
      }

      result.success = true;
      result.fileName = filePath.split('/').pop() || '';
      result.filePath = filePath;

      console.log('Processo completo concluído com sucesso!');
      Logger.success(`Consulta CNPJ ${cnpj} concluída com sucesso`, { fileName: result.fileName });
      
      // Se estiver em modo debug, mantém o navegador aberto por mais tempo
      if (this.config.debug && this.page) {
        console.log('Modo debug ativado - mantendo navegador aberto por 30 segundos...');
        await this.page.waitForTimeout(30000);
      }
      
      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro durante execução:', error);
      Logger.error(`Erro na consulta CNPJ ${cnpj}`, { error: result.error });
      
      // Em caso de erro, também mantém o navegador aberto para debug
      if (this.config.debug && this.page) {
        console.log('Modo debug ativado - mantendo navegador aberto por 30 segundos para debug...');
        await this.page.waitForTimeout(30000);
      }
      
      return result;
    } finally {
      await this.close();
    }
  }

  /**
   * Fecha o navegador
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}