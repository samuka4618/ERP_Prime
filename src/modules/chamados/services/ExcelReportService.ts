import ExcelJS from 'exceljs';
import { 
  SlaPerformanceData, 
  TicketVolumeData, 
  AttendantPerformanceData, 
  CategoryAnalysisData,
  TicketsByAttendantData,
  GeneralTicketsData,
  ReportType 
} from '../types';

export class ExcelReportService {
  private workbook: ExcelJS.Workbook;
  private worksheet!: ExcelJS.Worksheet;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.workbook.creator = 'ERP PRIME';
    this.workbook.lastModifiedBy = 'ERP PRIME';
    this.workbook.created = new Date();
    this.workbook.modified = new Date();
  }

  // Estilos predefinidos
  private getStyles() {
    return {
      header: {
        font: { bold: true, size: 16, color: { argb: 'FFFFFF' } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '366092' } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
      },
      subHeader: {
        font: { bold: true, size: 14, color: { argb: 'FFFFFF' } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '4F81BD' } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
      },
      sectionHeader: {
        font: { bold: true, size: 12, color: { argb: 'FFFFFF' } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '70AD47' } },
        alignment: { horizontal: 'left' as const, vertical: 'middle' as const }
      },
      tableHeader: {
        font: { bold: true, size: 11, color: { argb: 'FFFFFF' } },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '4472C4' } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
      },
      dataCell: {
        font: { size: 10 },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
      },
      dataCellAlt: {
        font: { size: 10 },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F2F2F2' } },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
      },
      metricCell: {
        font: { bold: true, size: 11 },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'E7F3FF' } },
        alignment: { horizontal: 'left' as const, vertical: 'middle' as const }
      },
      valueCell: {
        font: { size: 11 },
        fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'F8F9FA' } },
        alignment: { horizontal: 'right' as const, vertical: 'middle' as const }
      }
    };
  }

  // Criar cabeçalho do relatório
  private createHeader(reportType: string, executionId: number) {
    const styles = this.getStyles();
    const now = new Date().toLocaleString('pt-BR');

    // Título principal
    this.worksheet.mergeCells('A1:H1');
    const titleCell = this.worksheet.getCell('A1');
    titleCell.value = 'ERP PRIME';
    titleCell.style = styles.header;

    this.worksheet.mergeCells('A2:H2');
    const subtitleCell = this.worksheet.getCell('A2');
    subtitleCell.value = 'RELATÓRIO GERENCIAL';
    subtitleCell.style = styles.header;

    // Informações do relatório
    this.worksheet.mergeCells('A4:H4');
    const infoHeaderCell = this.worksheet.getCell('A4');
    infoHeaderCell.value = 'INFORMAÇÕES DO RELATÓRIO';
    infoHeaderCell.style = styles.subHeader;

    // Dados do relatório
    const reportInfo = [
      ['Tipo de Relatório:', reportType],
      ['Data de Geração:', now],
      ['ID da Execução:', executionId.toString()],
      ['Sistema:', 'ERP PRIME v2.0']
    ];

    reportInfo.forEach(([label, value], index) => {
      const row = 5 + index;
      const labelCell = this.worksheet.getCell(`A${row}`);
      const valueCell = this.worksheet.getCell(`B${row}`);
      
      labelCell.value = label;
      labelCell.style = styles.metricCell;
      
      valueCell.value = value;
      valueCell.style = styles.valueCell;
    });

    // Ajustar larguras das colunas
    this.worksheet.getColumn('A').width = 25;
    this.worksheet.getColumn('B').width = 30;
    this.worksheet.getColumn('C').width = 15;
    this.worksheet.getColumn('D').width = 15;
    this.worksheet.getColumn('E').width = 15;
    this.worksheet.getColumn('F').width = 15;
    this.worksheet.getColumn('G').width = 15;
    this.worksheet.getColumn('H').width = 15;

    return 9; // Retorna a próxima linha disponível
  }

  // Criar seção de métricas principais
  private createMetricsSection(startRow: number, title: string, metrics: Array<[string, string | number]>) {
    const styles = this.getStyles();
    let currentRow = startRow;

    // Título da seção
    this.worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    const sectionCell = this.worksheet.getCell(`A${currentRow}`);
    sectionCell.value = title;
    sectionCell.style = styles.sectionHeader;
    currentRow++;

    // Cabeçalho da tabela
    this.worksheet.getCell(`A${currentRow}`).value = 'Métrica';
    this.worksheet.getCell(`A${currentRow}`).style = styles.tableHeader;
    this.worksheet.getCell(`B${currentRow}`).value = 'Valor';
    this.worksheet.getCell(`B${currentRow}`).style = styles.tableHeader;
    currentRow++;

    // Dados das métricas
    metrics.forEach(([label, value], index) => {
      const labelCell = this.worksheet.getCell(`A${currentRow}`);
      const valueCell = this.worksheet.getCell(`B${currentRow}`);
      
      labelCell.value = label;
      labelCell.style = index % 2 === 0 ? styles.dataCell : styles.dataCellAlt;
      
      valueCell.value = typeof value === 'number' ? value.toFixed(2) : value;
      valueCell.style = index % 2 === 0 ? styles.dataCell : styles.dataCellAlt;
      currentRow++;
    });

    return currentRow + 1; // Retorna a próxima linha disponível
  }

  // Criar tabela de dados
  private createDataTable(startRow: number, title: string, headers: string[], data: any[][]) {
    const styles = this.getStyles();
    let currentRow = startRow;

    // Título da seção
    this.worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    const sectionCell = this.worksheet.getCell(`A${currentRow}`);
    sectionCell.value = title;
    sectionCell.style = styles.sectionHeader;
    currentRow++;

    // Cabeçalhos da tabela
    headers.forEach((header, index) => {
      const cell = this.worksheet.getCell(currentRow, index + 1);
      cell.value = header;
      cell.style = styles.tableHeader;
    });
    currentRow++;

    // Dados da tabela
    data.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        const cell = this.worksheet.getCell(currentRow, colIndex + 1);
        cell.value = typeof value === 'number' ? value.toFixed(2) : value;
        cell.style = rowIndex % 2 === 0 ? styles.dataCell : styles.dataCellAlt;
      });
      currentRow++;
    });

    return currentRow + 1; // Retorna a próxima linha disponível
  }

  // Gerar relatório de SLA Performance
  async generateSlaPerformanceReport(data: SlaPerformanceData, executionId: number): Promise<Buffer> {
    this.worksheet = this.workbook.addWorksheet('SLA Performance');
    
    // Cabeçalho simples
    this.worksheet.getCell('A1').value = 'RELATÓRIO DE DESEMPENHO DE SLA';
    this.worksheet.getCell('A1').font = { bold: true, size: 16 };
    
    this.worksheet.getCell('A2').value = `ID da Execução: ${executionId}`;
    this.worksheet.getCell('A3').value = `Data: ${new Date().toLocaleString('pt-BR')}`;
    
    // Dados principais
    let row = 5;
    this.worksheet.getCell(`A${row}`).value = 'Total de Chamados:';
    this.worksheet.getCell(`B${row}`).value = data.total_tickets;
    row++;
    
    this.worksheet.getCell(`A${row}`).value = 'Violações de SLA:';
    this.worksheet.getCell(`B${row}`).value = data.sla_resolution_violations;
    row++;
    
    this.worksheet.getCell(`A${row}`).value = 'Taxa de SLA:';
    this.worksheet.getCell(`B${row}`).value = `${data.sla_resolution_rate?.toFixed(2)}%`;
    row++;

    const buffer = await this.workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Gerar relatório de Volume de Tickets
  async generateTicketVolumeReport(data: TicketVolumeData, executionId: number): Promise<Buffer> {
    this.worksheet = this.workbook.addWorksheet('Volume de Chamados');
    
    let currentRow = this.createHeader('VOLUME DE CHAMADOS', executionId);

    // Métricas principais
    const metrics: Array<[string, string | number]> = [
      ['Total de Chamados', data.total_tickets]
    ];
    currentRow = this.createMetricsSection(currentRow, 'MÉTRICAS PRINCIPAIS', metrics);

    // Chamados por Status
    const statusData = Object.entries(data.tickets_by_status).map(([status, count]) => [
      status,
      count,
      data.total_tickets > 0 ? ((count as number) / data.total_tickets * 100).toFixed(2) + '%' : '0.00%'
    ]);
    currentRow = this.createDataTable(currentRow, 'DISTRIBUIÇÃO POR STATUS', 
      ['Status', 'Quantidade', 'Percentual (%)'], statusData);

    // Chamados por Prioridade
    const priorityData = Object.entries(data.tickets_by_priority).map(([priority, count]) => [
      priority,
      count,
      data.total_tickets > 0 ? ((count as number) / data.total_tickets * 100).toFixed(2) + '%' : '0.00%'
    ]);
    currentRow = this.createDataTable(currentRow, 'DISTRIBUIÇÃO POR PRIORIDADE', 
      ['Prioridade', 'Quantidade', 'Percentual (%)'], priorityData);

    // Chamados por Categoria
    if (data.tickets_by_category && data.tickets_by_category.length > 0) {
      const categoryData = data.tickets_by_category.map(item => [
        item.category_name,
        item.total_tickets,
        item.percentage?.toFixed(2) + '%'
      ]);
      currentRow = this.createDataTable(currentRow, 'ANÁLISE POR CATEGORIA', 
        ['Categoria', 'Total', 'Percentual (%)'], categoryData);
    }

    // Chamados por Atendente
    if (data.tickets_by_attendant && data.tickets_by_attendant.length > 0) {
      const attendantData = data.tickets_by_attendant.map(item => [
        item.attendant_name || 'Não atribuído',
        item.total_tickets,
        item.resolved_tickets,
        item.pending_tickets,
        item.total_tickets > 0 ? ((item.resolved_tickets / item.total_tickets) * 100).toFixed(2) + '%' : '0.00%'
      ]);
      currentRow = this.createDataTable(currentRow, 'ANÁLISE POR ATENDENTE', 
        ['Atendente', 'Total', 'Resolvidos', 'Pendentes', 'Taxa de Resolução (%)'], attendantData);
    }

    // Tendência de Volume
    if (data.volume_trend && data.volume_trend.length > 0) {
      const trendData = data.volume_trend.map(item => [
        item.date,
        item.total_tickets,
        item.created_tickets,
        item.resolved_tickets,
        item.closed_tickets
      ]);
      currentRow = this.createDataTable(currentRow, 'TENDÊNCIA TEMPORAL DE VOLUME', 
        ['Data', 'Total', 'Criados', 'Resolvidos', 'Fechados'], trendData);
    }

    // Horários de Pico
    if (data.peak_hours && data.peak_hours.length > 0) {
      const peakData = data.peak_hours.map(item => [
        item.hour + ':00',
        item.ticket_count,
        data.total_tickets > 0 ? ((item.ticket_count / data.total_tickets) * 100).toFixed(2) + '%' : '0.00%'
      ]);
      currentRow = this.createDataTable(currentRow, 'ANÁLISE DE HORÁRIOS DE PICO', 
        ['Horário', 'Quantidade de Chamados', 'Percentual (%)'], peakData);
    }

    const buffer = await this.workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Gerar relatório geral de chamados
  async generateGeneralTicketsReport(data: GeneralTicketsData, executionId: number): Promise<Buffer> {
    this.worksheet = this.workbook.addWorksheet('Relatório Geral');
    
    // Cabeçalho
    this.worksheet.getCell('A1').value = 'RELATÓRIO GERAL DE CHAMADOS';
    this.worksheet.getCell('A1').font = { bold: true, size: 16 };
    
    this.worksheet.getCell('A2').value = `ID da Execução: ${executionId}`;
    this.worksheet.getCell('A3').value = `Data: ${new Date().toLocaleString('pt-BR')}`;
    this.worksheet.getCell('A4').value = `Período: ${data.period_summary.start_date} a ${data.period_summary.end_date}`;
    
    // Dados principais
    let row = 6;
    this.worksheet.getCell(`A${row}`).value = 'Total de Chamados:';
    this.worksheet.getCell(`B${row}`).value = data.total_tickets;
    row++;
    
    this.worksheet.getCell(`A${row}`).value = 'Dias Analisados:';
    this.worksheet.getCell(`B${row}`).value = data.period_summary.days_analyzed;
    row++;

    // Chamados por Status
    row += 2;
    this.worksheet.getCell(`A${row}`).value = 'CHAMADOS POR STATUS';
    this.worksheet.getCell(`A${row}`).font = { bold: true };
    row++;
    
    this.worksheet.getCell(`A${row}`).value = 'Status';
    this.worksheet.getCell(`B${row}`).value = 'Quantidade';
    this.worksheet.getCell(`C${row}`).value = 'Percentual';
    row++;
    
    Object.entries(data.tickets_by_status).forEach(([status, count]) => {
      const percentage = data.total_tickets > 0 ? ((count as number) / data.total_tickets * 100).toFixed(2) : '0.00';
      this.worksheet.getCell(`A${row}`).value = status;
      this.worksheet.getCell(`B${row}`).value = count;
      this.worksheet.getCell(`C${row}`).value = percentage + '%';
      row++;
    });

    // Chamados por Categoria
    if (data.tickets_by_category && data.tickets_by_category.length > 0) {
      row += 2;
      this.worksheet.getCell(`A${row}`).value = 'CHAMADOS POR CATEGORIA';
      this.worksheet.getCell(`A${row}`).font = { bold: true };
      row++;
      
      this.worksheet.getCell(`A${row}`).value = 'Categoria';
      this.worksheet.getCell(`B${row}`).value = 'Total';
      this.worksheet.getCell(`C${row}`).value = 'Percentual';
      row++;
      
      data.tickets_by_category.forEach(item => {
        this.worksheet.getCell(`A${row}`).value = item.category_name;
        this.worksheet.getCell(`B${row}`).value = item.total_tickets;
        this.worksheet.getCell(`C${row}`).value = item.percentage?.toFixed(2) + '%';
        row++;
      });
    }

    const buffer = await this.workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Gerar relatório personalizado
  async generateCustomReport(data: any[], executionId: number): Promise<Buffer> {
    this.worksheet = this.workbook.addWorksheet('Relatório Personalizado');
    
    this.worksheet.getCell('A1').value = 'RELATÓRIO PERSONALIZADO';
    this.worksheet.getCell('A1').font = { bold: true, size: 16 };
    
    this.worksheet.getCell('A2').value = `ID da Execução: ${executionId}`;
    this.worksheet.getCell('A3').value = `Data: ${new Date().toLocaleString('pt-BR')}`;
    this.worksheet.getCell('A4').value = `Total de Registros: ${data.length}`;
    
    if (data.length === 0) {
      this.worksheet.getCell('A6').value = 'Nenhum dado encontrado';
      const buffer = await this.workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    }
    
    // Cabeçalhos da tabela
    let row = 6;
    const headers = Object.keys(data[0]);
    headers.forEach((header, index) => {
      const cell = this.worksheet.getCell(row, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });
    row++;
    
    // Dados da tabela
    data.forEach((record, recordIndex) => {
      headers.forEach((header, headerIndex) => {
        const cell = this.worksheet.getCell(row, headerIndex + 1);
        cell.value = record[header];
        
        // Alternar cores das linhas
        if (recordIndex % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F8F8' }
          };
        }
      });
      row++;
    });
    
    // Ajustar largura das colunas
    headers.forEach((header, index) => {
      this.worksheet.getColumn(index + 1).width = Math.max(header.length, 15);
    });
    
    const buffer = await this.workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Gerar relatório de Solicitações de Compra
  async generateComprasSolicitacoesReport(data: any, executionId: number): Promise<Buffer> {
    this.worksheet = this.workbook.addWorksheet('Solicitações de Compra');
    
    let currentRow = this.createHeader('SOLICITAÇÕES DE COMPRA', executionId);

    // Métricas principais
    const metrics: Array<[string, string | number]> = [
      ['Total de Solicitações', data.total_solicitacoes || 0],
      ['Valor Total', `R$ ${(data.valor_analysis?.valor_total || 0).toFixed(2)}`],
      ['Valor Médio', `R$ ${(data.valor_analysis?.valor_medio || 0).toFixed(2)}`],
      ['Valor Aprovado', `R$ ${(data.valor_analysis?.valor_aprovado || 0).toFixed(2)}`],
      ['Valor Mínimo', `R$ ${(data.valor_analysis?.valor_minimo || 0).toFixed(2)}`],
      ['Valor Máximo', `R$ ${(data.valor_analysis?.valor_maximo || 0).toFixed(2)}`]
    ];
    currentRow = this.createMetricsSection(currentRow, 'MÉTRICAS PRINCIPAIS', metrics);

    // Por Status
    if (data.solicitacoes_by_status) {
      const statusData = Object.entries(data.solicitacoes_by_status).map(([status, count]) => [
        status,
        count,
        data.total_solicitacoes > 0 ? ((count as number) / data.total_solicitacoes * 100).toFixed(2) + '%' : '0.00%'
      ]);
      currentRow = this.createDataTable(currentRow, 'DISTRIBUIÇÃO POR STATUS', 
        ['Status', 'Quantidade', 'Percentual (%)'], statusData);
    }

    // Por Prioridade
    if (data.solicitacoes_by_priority) {
      const priorityData = Object.entries(data.solicitacoes_by_priority).map(([priority, count]) => [
        priority,
        count,
        data.total_solicitacoes > 0 ? ((count as number) / data.total_solicitacoes * 100).toFixed(2) + '%' : '0.00%'
      ]);
      currentRow = this.createDataTable(currentRow, 'DISTRIBUIÇÃO POR PRIORIDADE', 
        ['Prioridade', 'Quantidade', 'Percentual (%)'], priorityData);
    }

    // Por Solicitante
    if (data.solicitacoes_by_solicitante && data.solicitacoes_by_solicitante.length > 0) {
      const solicitanteData = data.solicitacoes_by_solicitante.map((item: any) => [
        item.solicitante_name || 'Não informado',
        item.total_solicitacoes,
        `R$ ${(item.valor_total || 0).toFixed(2)}`,
        item.aprovadas || 0,
        item.rejeitadas || 0,
        item.pendentes || 0
      ]);
      currentRow = this.createDataTable(currentRow, 'ANÁLISE POR SOLICITANTE', 
        ['Solicitante', 'Total', 'Valor Total', 'Aprovadas', 'Rejeitadas', 'Pendentes'], solicitanteData);
    }

    // Por Comprador
    if (data.solicitacoes_by_comprador && data.solicitacoes_by_comprador.length > 0) {
      const compradorData = data.solicitacoes_by_comprador.map((item: any) => [
        item.comprador_name || 'Não atribuído',
        item.total_solicitacoes,
        `R$ ${(item.valor_total || 0).toFixed(2)}`,
        item.em_cotacao || 0,
        item.compradas || 0
      ]);
      currentRow = this.createDataTable(currentRow, 'ANÁLISE POR COMPRADOR', 
        ['Comprador', 'Total', 'Valor Total', 'Em Cotação', 'Compradas'], compradorData);
    }

    // Tendência Diária
    if (data.daily_trend && data.daily_trend.length > 0) {
      const trendData = data.daily_trend.map((item: any) => [
        item.date,
        item.solicitacoes_criadas || 0,
        item.solicitacoes_aprovadas || 0,
        item.solicitacoes_rejeitadas || 0,
        `R$ ${(item.valor_total || 0).toFixed(2)}`
      ]);
      currentRow = this.createDataTable(currentRow, 'TENDÊNCIA DIÁRIA', 
        ['Data', 'Criadas', 'Aprovadas', 'Rejeitadas', 'Valor Total'], trendData);
    }

    // Resumo Mensal
    if (data.monthly_summary && data.monthly_summary.length > 0) {
      const monthlyData = data.monthly_summary.map((item: any) => [
        item.month,
        item.total_solicitacoes || 0,
        `R$ ${(item.valor_total || 0).toFixed(2)}`,
        item.aprovadas || 0,
        item.rejeitadas || 0
      ]);
      currentRow = this.createDataTable(currentRow, 'RESUMO MENSAL', 
        ['Mês', 'Total', 'Valor Total', 'Aprovadas', 'Rejeitadas'], monthlyData);
    }

    const buffer = await this.workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Gerar relatório de Orçamentos
  async generateComprasOrcamentosReport(data: any, executionId: number): Promise<Buffer> {
    this.worksheet = this.workbook.addWorksheet('Orçamentos');
    
    let currentRow = this.createHeader('ORÇAMENTOS DE COMPRA', executionId);

    // Métricas principais
    const metrics: Array<[string, string | number]> = [
      ['Total de Orçamentos', data.total_orcamentos || 0],
      ['Valor Total', `R$ ${(data.valor_analysis?.valor_total || 0).toFixed(2)}`],
      ['Valor Médio', `R$ ${(data.valor_analysis?.valor_medio || 0).toFixed(2)}`],
      ['Valor Aprovado', `R$ ${(data.valor_analysis?.valor_aprovado || 0).toFixed(2)}`]
    ];
    currentRow = this.createMetricsSection(currentRow, 'MÉTRICAS PRINCIPAIS', metrics);

    // Por Status
    if (data.orcamentos_by_status) {
      const statusData = Object.entries(data.orcamentos_by_status).map(([status, count]) => [
        status,
        count,
        data.total_orcamentos > 0 ? ((count as number) / data.total_orcamentos * 100).toFixed(2) + '%' : '0.00%'
      ]);
      currentRow = this.createDataTable(currentRow, 'DISTRIBUIÇÃO POR STATUS', 
        ['Status', 'Quantidade', 'Percentual (%)'], statusData);
    }

    // Por Fornecedor
    if (data.orcamentos_by_fornecedor && data.orcamentos_by_fornecedor.length > 0) {
      const fornecedorData = data.orcamentos_by_fornecedor.map((item: any) => [
        item.fornecedor_nome || 'Não informado',
        item.total_orcamentos || 0,
        `R$ ${(item.valor_total || 0).toFixed(2)}`,
        item.aprovados || 0,
        item.rejeitados || 0
      ]);
      currentRow = this.createDataTable(currentRow, 'ANÁLISE POR FORNECEDOR', 
        ['Fornecedor', 'Total', 'Valor Total', 'Aprovados', 'Rejeitados'], fornecedorData);
    }

    const buffer = await this.workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Gerar relatório de Aprovações
  async generateComprasAprovacoesReport(data: any, executionId: number): Promise<Buffer> {
    this.worksheet = this.workbook.addWorksheet('Aprovações');
    
    let currentRow = this.createHeader('APROVAÇÕES DE COMPRA', executionId);

    // Métricas principais
    const metrics: Array<[string, string | number]> = [
      ['Total de Aprovações', data.total_aprovacoes || 0],
      ['Aprovadas', data.aprovacoes_aprovadas || 0],
      ['Rejeitadas', data.aprovacoes_rejeitadas || 0],
      ['Pendentes', data.aprovacoes_pendentes || 0],
      ['Taxa de Aprovação', data.total_aprovacoes > 0 
        ? `${((data.aprovacoes_aprovadas || 0) / data.total_aprovacoes * 100).toFixed(2)}%` 
        : '0.00%']
    ];
    currentRow = this.createMetricsSection(currentRow, 'MÉTRICAS PRINCIPAIS', metrics);

    // Por Aprovador
    if (data.aprovacoes_by_aprovador && data.aprovacoes_by_aprovador.length > 0) {
      const aprovadorData = data.aprovacoes_by_aprovador.map((item: any) => [
        item.aprovador_name || 'Não informado',
        item.total_aprovacoes || 0,
        item.aprovadas || 0,
        item.rejeitadas || 0,
        item.pendentes || 0,
        item.total_aprovacoes > 0 
          ? `${((item.aprovadas || 0) / item.total_aprovacoes * 100).toFixed(2)}%` 
          : '0.00%'
      ]);
      currentRow = this.createDataTable(currentRow, 'ANÁLISE POR APROVADOR', 
        ['Aprovador', 'Total', 'Aprovadas', 'Rejeitadas', 'Pendentes', 'Taxa (%)'], aprovadorData);
    }

    const buffer = await this.workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Gerar relatório Geral de Compras
  async generateComprasGeralReport(data: any, executionId: number): Promise<Buffer> {
    this.worksheet = this.workbook.addWorksheet('Relatório Geral de Compras');
    
    let currentRow = this.createHeader('RELATÓRIO GERAL DE COMPRAS', executionId);

    // Métricas principais
    const metrics: Array<[string, string | number]> = [
      ['Total de Solicitações', data.total_solicitacoes || 0],
      ['Total de Orçamentos', data.total_orcamentos || 0],
      ['Valor Total das Solicitações', `R$ ${(data.valor_total_solicitacoes || 0).toFixed(2)}`],
      ['Valor Total dos Orçamentos', `R$ ${(data.valor_total_orcamentos || 0).toFixed(2)}`],
      ['Taxa de Conversão', data.total_solicitacoes > 0 
        ? `${((data.total_orcamentos || 0) / data.total_solicitacoes * 100).toFixed(2)}%` 
        : '0.00%']
    ];
    currentRow = this.createMetricsSection(currentRow, 'MÉTRICAS PRINCIPAIS', metrics);

    // Resumo por Status de Solicitações
    if (data.solicitacoes_by_status) {
      const statusData = Object.entries(data.solicitacoes_by_status).map(([status, count]) => [
        status,
        count
      ]);
      currentRow = this.createDataTable(currentRow, 'SOLICITAÇÕES POR STATUS', 
        ['Status', 'Quantidade'], statusData);
    }

    // Resumo por Status de Orçamentos
    if (data.orcamentos_by_status) {
      const statusData = Object.entries(data.orcamentos_by_status).map(([status, count]) => [
        status,
        count
      ]);
      currentRow = this.createDataTable(currentRow, 'ORÇAMENTOS POR STATUS', 
        ['Status', 'Quantidade'], statusData);
    }

    const buffer = await this.workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Método principal para gerar relatórios
  async generateReport(type: ReportType, data: any, executionId: number): Promise<Buffer> {
    switch (type) {
      case 'sla_performance':
        return this.generateSlaPerformanceReport(data, executionId);
      case 'ticket_volume':
        return this.generateTicketVolumeReport(data, executionId);
      case 'general_tickets':
        return this.generateGeneralTicketsReport(data, executionId);
      case 'compras_solicitacoes':
        return this.generateComprasSolicitacoesReport(data, executionId);
      case 'compras_orcamentos':
        return this.generateComprasOrcamentosReport(data, executionId);
      case 'compras_aprovacoes':
        return this.generateComprasAprovacoesReport(data, executionId);
      case 'compras_geral':
        return this.generateComprasGeralReport(data, executionId);
      case 'custom':
        return this.generateCustomReport(data, executionId);
      default:
        throw new Error('Tipo de relatório Excel não suportado');
    }
  }
}
