export interface DatabaseConfig {
    server: string;
    database: string;
    user: string;
    password: string;
    port?: number;
    options?: {
        encrypt?: boolean;
        trustServerCertificate?: boolean;
    };
}
export interface ConsultaTESSData {
    cnpj: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    situacaoCadastral?: string;
    dataConsulta: Date;
    arquivoPDF: string;
    respostaTESS?: string;
    creditosUtilizados?: number;
}
export interface EmpresaData {
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
    inscricaoEstadual?: string;
    inscricaoSuframa?: string;
    latitude?: number;
    longitude?: number;
    website?: string;
    cnpjaResponse?: string;
}
export interface SocioData {
    cnpj: string;
    cpfCnpj: string;
    nome: string;
    tipoPessoa: 'F' | 'J';
    statusSocio?: string;
}
export interface ParticipacaoSocietariaData {
    cnpj: string;
    cpfCnpj: string;
    participacaoPercentual: number;
    cargo?: string;
    dataEntrada?: Date;
    dataSaida?: Date;
    statusParticipacao?: string;
}
export interface QuadroAdministrativoData {
    cnpj: string;
    cpfCnpj: string;
    cargo: string;
    dataEleicao?: Date;
    statusCargo?: string;
}
export declare class DatabaseService {
    private config;
    private pool;
    constructor(config: DatabaseConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    inserirDadosTESSCompletos(data: {
        consulta: ConsultaTESSData;
        empresa: EmpresaData;
        socios: SocioData[];
        participacoes: ParticipacaoSocietariaData[];
        quadroAdministrativo: QuadroAdministrativoData[];
    }): Promise<{
        consultaTESSId: number;
        empresaId: number;
        consultaEmpresaId: number;
        sociosIds: number[];
        participacoesIds: number[];
        quadroIds: number[];
    }>;
    private inserirConsultaTESS;
    private inserirEmpresa;
    private inserirConsultaEmpresa;
    insertCompanyData(data: {
        cnpj: string;
        data_consulta: Date;
        spc_sucesso: boolean;
        spc_arquivo?: string;
        spc_erro?: string;
        tess_sucesso: boolean;
        tess_resposta?: string;
        tess_erro?: string;
        cnpja_sucesso: boolean;
        cnpja_erro?: string;
        inscricao_estadual?: string;
        latitude?: number;
        longitude?: number;
        endereco_completo?: string;
        atividade_principal?: string;
        porte?: string;
        telefone?: string;
        email?: string;
        website?: string;
        razao_social?: string;
        nome_fantasia?: string;
        situacao?: string;
        data_abertura?: string;
        natureza_juridica?: string;
        capital_social?: number;
    }): Promise<{
        success: boolean;
        error?: string;
        empresaId?: number;
    }>;
    private inserirConsulta;
    private inserirEmpresaCompleta;
    private inserirEnderecoCompleto;
    private inserirDadosContatoCompleto;
    private inserirSocio;
    private inserirParticipacaoSocietaria;
    private inserirQuadroAdministrativo;
    buscarDadosConsolidados(cnpj: string): Promise<any>;
    listarEmpresasParaAnalise(): Promise<any[]>;
    testConnection(): Promise<boolean>;
    query(sqlQuery: string): Promise<any[]>;
    testStoredProcedures(): Promise<boolean>;
}
//# sourceMappingURL=databaseService.d.ts.map