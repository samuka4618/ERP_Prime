declare module 'archiver' {
  import { Readable } from 'stream';
  interface Archiver {
    file(path: string, options: { name: string }): Archiver;
    directory(path: string, dest: string): Archiver;
    append(content: string | Buffer, options: { name: string }): Archiver;
    finalize(): void;
    pipe<T extends NodeJS.WritableStream>(dest: T): T;
  }
  function archiver(format: string, options?: { zlib?: { level?: number } }): Archiver;
  export = archiver;
}

declare module 'adm-zip' {
  class AdmZip {
    constructor(buffer?: Buffer);
    extractAllTo(targetPath: string, overwrite?: boolean): void;
  }
  export = AdmZip;
}
