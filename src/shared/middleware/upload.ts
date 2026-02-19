import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Criar diretório de uploads se não existir
const uploadDir = path.join(process.cwd(), 'storage', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const fileName = `${name}-${uniqueSuffix}${ext}`;
    cb(null, fileName);
  }
});

// Filtro de tipos de arquivo
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Permitir todos os tipos de arquivo por enquanto
  // Pode ser configurado posteriormente baseado nas configurações do sistema
  cb(null, true);
};

// Configuração do multer
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por arquivo
    files: 5 // Máximo 5 arquivos por upload
  }
});

// Middleware para upload de múltiplos arquivos
export const uploadMultiple = upload.array('attachments', 5);

// Middleware para upload de um único arquivo
export const uploadSingle = upload.single('attachment');
