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
    this.workbook.creator = 'Sistema de Chamados Financeiro';
    this.workbook.lastModifiedBy = 'Sistema de Chamados Financeiro';
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
    titleCell.value = 'SISTEMA DE CHAMADOS FINANCEIRO';
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
      ['Sistema:', 'Sistema de Chamados Financeiro v1.0']
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

  // Método principal para gerar relatórios
  async generateReport(type: ReportType, data: any, executionId: number): Promise<Buffer> {
    switch (type) {
      case 'sla_performance':
        return this.generateSlaPerformanceReport(data, executionId);
      case 'ticket_volume':
        return this.generateTicketVolumeReport(data, executionId);
      case 'general_tickets':
        return this.generateGeneralTicketsReport(data, executionId);
      case 'custom':
        return this.generateCustomReport(data, executionId);
      default:
        throw new Error('Tipo de relatório Excel não suportado');
    }
  }
}
