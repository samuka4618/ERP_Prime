export interface AtakAuthConfig {
    username: string;
    password: string;
    baseUrl: string;
}
export declare const authenticateAtak: () => Promise<string | null>;
export declare const getAtakToken: () => Promise<string | null>;
export declare const isTokenValid: () => Promise<boolean>;
export declare const isAtakConfigured: () => boolean;
//# sourceMappingURL=atakAuth.d.ts.map