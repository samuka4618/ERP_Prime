import fs from 'fs';
import path from 'path';

export class FileUtils {
  /**
   * Cria o diretório de download se não existir
   */
  static ensureDownloadDirectory(downloadPath: string): void {
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }
  }

  /**
   * Gera um nome de arquivo único baseado no CNPJ e timestamp
   */
  static generateFileName(cnpj: string, extension: string = 'pdf'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cleanCnpj = cnpj.replace(/\D/g, '');
    return `consulta_cnpj_${cleanCnpj}_${timestamp}.${extension}`;
  }

  /**
   * Move um arquivo para o diretório de destino
   */
  static async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(sourcePath);
      const writeStream = fs.createWriteStream(destinationPath);
      
      readStream.pipe(writeStream);
      
      writeStream.on('finish', () => {
        fs.unlinkSync(sourcePath); // Remove o arquivo original
        resolve();
      });
      
      writeStream.on('error', reject);
      readStream.on('error', reject);
    });
  }

  /**
   * Lista arquivos em um diretório
   */
  static listFiles(directory: string): string[] {
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs.readdirSync(directory);
  }

  /**
   * Verifica se um arquivo existe
   */
  static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
}
