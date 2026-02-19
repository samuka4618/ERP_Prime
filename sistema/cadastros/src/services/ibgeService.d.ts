export declare class IBGEService {
    private static cache;
    private static readonly IBGE_DIR;
    static buscarCodigoIBGE(nomeMunicipio: string, uf?: string): string | null;
    private static buscarCodigoNoArquivo;
    static limparCache(): void;
    static getCacheStats(): {
        tamanho: number;
        chaves: string[];
    };
}
//# sourceMappingURL=ibgeService.d.ts.map