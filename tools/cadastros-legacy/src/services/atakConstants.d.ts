export declare const TIPOS_DE_CADASTRO: {
    ID: string;
    Nome: string;
}[];
export interface AtakCustomerSearchResponse {
    ID: number;
    CpfCgc: string;
    RazaoSocial: string;
    NomeFantasia?: string;
    TipoDePessoa?: string;
    TipoDeCadastro?: string;
    [key: string]: any;
}
export interface AtakApiResponse<T> {
    Version: string;
    Content: any;
    StatusCode: number;
    ReasonPhrase: string;
    Headers: Record<string, any>;
    RequestMessage: any;
    IsSuccessStatusCode: boolean;
}
//# sourceMappingURL=atakConstants.d.ts.map