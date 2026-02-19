import { DatabaseService } from './databaseService';
import { AtakCustomerSearchResponse } from './atakConstants';
export interface AtakCustomerPayload {
    UtilizaSequenciaDaAtak: boolean;
    tipoDeCadastro: string;
    CodigoDaFilial: string;
    RazaoSocial: string;
    nomeFantasia: string;
    tipoDePessoa: string;
    cpfCnpj: string;
    identificadorEstadual: number;
    observacao: string;
    codigoDaSituacao: string;
    codigoDoRamoDaAtividade: string;
    codigoDoPercursoDaRotaDeEntrega: string;
    uf: string;
    indicadorMicroEmpresa: string;
    suframa: string;
    Enderecos: {
        IdDoPaisF?: string;
        UFF?: string;
        ConteudoEnderecoF?: string;
        BairroF?: string;
        CodigoIBGECidadeF?: string;
        CidadeF?: string;
        TelefoneF?: string;
        EmailF?: string;
        CEPF?: string;
        NumeroF?: string;
        ObservacaoF?: string;
        LatitudeF?: string;
        LongitudeF?: string;
        IdDoPaisC?: string;
        UFC?: string;
        ConteudoEnderecoC?: string;
        BairroC?: string;
        CodigoIBGECidadeC?: string;
        CidadeC?: string;
        TelefoneC?: string;
        EmailC?: string;
        CEPC?: string;
        ObservacaoC?: string;
        NumeroC?: string;
        LatitudeC?: string;
        LongitudeC?: string;
        IdDoPaisE?: string;
        UFE?: string;
        ConteudoEnderecoE?: string;
        BairroE?: string;
        CodigoIBGECidadeE?: string;
        CidadeE?: string;
        TelefoneE?: string;
        EmailE?: string;
        CEPE?: string;
        ObservacaoE?: string;
        NumeroE?: string;
        LatitudeE?: string;
        LongitudeE?: string;
        IdDoPaisR?: string;
        UFR?: string;
        ConteudoEnderecoR?: string;
        BairroR?: string;
        CodigoIBGECidadeR?: string;
        CidadeR?: string;
        TelefoneR?: string;
        EmailR?: string;
        CEPR?: string;
        ObservacaoR?: string;
        NumeroR?: string;
        LatitudeR?: string;
        LongitudeR?: string;
        IdDoPaisT?: string;
        UFT?: string;
        ConteudoEnderecoT?: string;
        BairroT?: string;
        CodigoIBGECidadeT?: string;
        CidadeT?: string;
        TelefoneT?: string;
        EmailT?: string;
        CEPT?: string;
        ObservacaoT?: string;
        NumeroT?: string;
        LatitudeT?: string;
        LongitudeT?: string;
    };
    Financeiro: {
        CodigoDaListaDePreco: number;
        CodigoDaCarteira: number;
        CodigoFormaDeCobranca: number;
        CodigoDoVendedor: number;
        idDaCondicaoDePagamento?: string;
        ValorDoLimiteDeCredito?: number;
    };
}
export interface ConsolidatedCompanyData {
    empresa: {
        cnpj: string;
        razaoSocial: string;
        nomeFantasia?: string;
        situacaoCadastral?: string;
        porte?: string;
        naturezaJuridica?: string;
        dataAbertura?: string;
        inscricaoEstadual?: string;
        inscricaoSuframa?: string;
    };
    endereco: {
        logradouro?: string;
        numero?: string;
        complemento?: string;
        bairro?: string;
        cidade?: string;
        estado?: string;
        cep?: string;
        latitude?: number;
        longitude?: number;
    };
    contato: {
        telefones?: string[];
        emails?: string[];
    };
    formulario?: {
        ramo_atividade_id?: number;
        codigo_carteira_id?: number;
        lista_preco_id?: number;
        forma_pagamento_desejada_id?: number;
        codigoDoRamoDaAtividade?: string;
        carteira_codigo?: number;
        lista_preco_codigo?: number;
        forma_cobranca_codigo?: number;
        vendedor_codigo?: number;
    };
}
export declare class AtakService {
    private baseUrl;
    private dbService;
    constructor(dbService: DatabaseService);
    searchCustomer(cnpj: string): Promise<AtakCustomerSearchResponse | null>;
    getCustomerById(atakClienteId: number): Promise<{
        success: boolean;
        error?: string;
        data?: any;
    }>;
    private clearAtakToken;
    private extractErrorMessage;
    private isTokenError;
    private getValidToken;
    saveAtakResponse(cnpj: string, result: {
        success: boolean;
        error?: string;
        data?: any;
        customerId?: number;
    }, registrationId?: number): Promise<void>;
    registerCompany(cnpj: string): Promise<{
        success: boolean;
        error?: string;
        data?: any;
        customerId?: number;
    }>;
    private getConsolidatedCompanyData;
    private mapToAtakPayload;
    updateFinancialData(atakClienteId: number, condicaoPagamentoId?: string, limiteCredito?: number, codigoCarteira?: number, codigoFormaCobranca?: number, cnpj?: string): Promise<{
        success: boolean;
        error?: string;
        data?: any;
    }>;
    getCondicoesPagamento(): Promise<{
        success: boolean;
        data?: Array<{
            id: string;
            nome: string;
            descricao?: string;
        }>;
        error?: string;
    }>;
    private mapSituacao;
    private isMicroEmpresa;
}
//# sourceMappingURL=atakService.d.ts.map