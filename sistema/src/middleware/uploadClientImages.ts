import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

// Estender a interface Request para incluir files e uploadedFiles
declare global {
  namespace Express {
    interface Request {
      files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
      uploadedFiles?: {
        imagem_externa?: Express.Multer.File;
        imagem_interna?: Express.Multer.File;
        anexos?: Express.Multer.File[];
      };
    }
  }
}

// Configuração de armazenamento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Criar pasta baseada na data: imgCadastros/YYYYMMDD/
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const uploadPath = path.join('imgCadastros', date);
    
    // Criar diretório se não existir
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Nome do arquivo: [tipo]_[timestamp]_[hash].ext
    const prefix = file.fieldname; // 'imagem_externa', 'imagem_interna' ou 'anexos'
    const timestamp = Date.now();
    const hash = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    const filename = `${prefix}_${timestamp}_${hash}${ext}`;
    cb(null, filename);
  }
});

// Filtro de arquivos
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Aceitar todos os tipos de arquivo para imagens e anexos
  cb(null, true);
};

// Configuração do multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB por arquivo
    files: 10 // Máximo 10 arquivos por requisição
  }
});

// Middleware para upload de imagens de cadastro de clientes
export const uploadClientImages = (req: Request, res: Response, next: NextFunction) => {
  // Configurar multer para os campos específicos
  const uploadFields = upload.fields([
    { name: 'imagem_externa', maxCount: 1 },
    { name: 'imagem_interna', maxCount: 1 },
    { name: 'anexos', maxCount: 5 }
  ]);

  uploadFields(req, res, (err) => {
    if (err) {
      console.error('Erro no upload:', err);
      res.status(400).json({
        success: false,
        message: 'Erro no upload de arquivos',
        error: err.message
      });
      return;
    }

    // Verificar se os arquivos obrigatórios foram enviados
    if (!req.files) {
      res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Verificar se as imagens obrigatórias foram enviadas
    if (!files.imagem_externa || files.imagem_externa.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Imagem externa é obrigatória'
      });
      return;
    }

    if (!files.imagem_interna || files.imagem_interna.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Imagem interna é obrigatória'
      });
      return;
    }

    // Organizar arquivos no req.uploadedFiles
    req.uploadedFiles = {
      imagem_externa: files.imagem_externa[0],
      imagem_interna: files.imagem_interna[0],
      anexos: files.anexos || []
    };

    // Interceptar res.send para limpar arquivos em caso de erro
    const originalSend = res.send;
    res.send = function(data: any) {
      // Se houve erro, limpar arquivos enviados
      if (res.statusCode >= 400) {
        try {
          const files = req.uploadedFiles;
          if (files) {
            // Limpar imagem externa
            if (files.imagem_externa) {
              const externalPath = path.join(files.imagem_externa.destination, files.imagem_externa.filename);
              if (fs.existsSync(externalPath)) {
                fs.unlinkSync(externalPath);
              }
            }
            
            // Limpar imagem interna
            if (files.imagem_interna) {
              const internalPath = path.join(files.imagem_interna.destination, files.imagem_interna.filename);
              if (fs.existsSync(internalPath)) {
                fs.unlinkSync(internalPath);
              }
            }
            
            // Limpar anexos
            if (files.anexos) {
              files.anexos.forEach(file => {
                const anexoPath = path.join(file.destination, file.filename);
                if (fs.existsSync(anexoPath)) {
                  fs.unlinkSync(anexoPath);
                }
              });
            }
          }
        } catch (cleanupError) {
          console.error('Erro ao limpar arquivos:', cleanupError);
        }
      }
      
      return originalSend.call(this, data);
    };

    next();
  });
};

// Versão opcional: não exige imagens; usa as enviadas se presentes
export const uploadClientImagesOptional = (req: Request, res: Response, next: NextFunction) => {
  const uploadFields = upload.fields([
    { name: 'imagem_externa', maxCount: 1 },
    { name: 'imagem_interna', maxCount: 1 },
    { name: 'anexos', maxCount: 5 }
  ]);

  uploadFields(req, res, (err) => {
    if (err) {
      console.error('Erro no upload:', err);
      res.status(400).json({ success: false, message: 'Erro no upload de arquivos', error: err.message });
      return;
    }

    const files = (req.files as { [fieldname: string]: Express.Multer.File[] }) || {};
    req.uploadedFiles = {
      imagem_externa: files.imagem_externa?.[0],
      imagem_interna: files.imagem_interna?.[0],
      anexos: files.anexos || []
    };

    next();
  });
};

// Função auxiliar para limpar arquivos antigos (pode ser chamada por um cron job)
export const cleanupOldFiles = (daysOld: number = 30) => {
  const imgCadastrosPath = path.join('imgCadastros');
  
  if (!fs.existsSync(imgCadastrosPath)) {
    return;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const folders = fs.readdirSync(imgCadastrosPath);
  
  folders.forEach(folder => {
    const folderPath = path.join(imgCadastrosPath, folder);
    const stat = fs.statSync(folderPath);
    
    if (stat.isDirectory()) {
      const folderDate = new Date(folder);
      if (folderDate < cutoffDate) {
        // Deletar pasta e todos os arquivos dentro
        fs.rmSync(folderPath, { recursive: true, force: true });
        console.log(`Pasta antiga removida: ${folderPath}`);
      }
    }
  });
};