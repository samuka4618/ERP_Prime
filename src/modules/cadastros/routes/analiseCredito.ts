import { Router } from 'express';
import { authenticate } from '../../../core/auth/middleware';
import { AnaliseCreditoModel } from '../models/AnaliseCredito';
import { requirePermission } from '../../../core/permissions/middleware';

const router = Router();

// Middleware de autenticação
router.use(authenticate);
router.use(requirePermission('registrations.analise_credito.view'));

// GET /api/analise-credito/:cnpj(*) - Buscar análise de crédito pelo CNPJ (usa regex para capturar CNPJ com barras)
router.get('/:cnpj(*)', async (req, res) => {
  try {
    // Capturar e decodificar o CNPJ da URL
    const cnpj = decodeURIComponent(req.params.cnpj);
    
    console.log('🔍 [ANALISE-CREDITO] Buscando análise para CNPJ:', cnpj);
    
    const analise = await AnaliseCreditoModel.findByCNPJ(cnpj);
    
    if (!analise) {
      res.status(404).json({
        success: false,
        message: 'Dados de análise de crédito não encontrados para este CNPJ'
      });
      return;
    }
    
    console.log('✅ [ANALISE-CREDITO] Dados encontrados');
    
    res.json({
      success: true,
      data: analise
    });
    
  } catch (error) {
    console.error('❌ [ANALISE-CREDITO] Erro ao buscar análise:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default router;

