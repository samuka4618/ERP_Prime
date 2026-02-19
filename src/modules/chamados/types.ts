// Re-exportar tipos compartilhados e específicos do módulo chamados
export { UserRole, ReportType, ReportFrequency, ReportStatus } from '../../shared/types';
export type { 
  Report,
  ReportExecution,
  ReportSchedule,
  ReportParameters,
  CreateReportRequest,
  UpdateReportRequest,
  CreateReportScheduleRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  PaginationParams,
  PaginatedResponse,
  TicketHistory,
  SlaPerformanceData,
  TicketVolumeData,
  AttendantPerformanceData,
  CategoryAnalysisData,
  TicketsByAttendantData,
  GeneralTicketsData,
  ComprasSolicitacoesData,
  ComprasOrcamentosData,
  ComprasAprovacoesData,
  ComprasGeralData
} from '../../shared/types';

