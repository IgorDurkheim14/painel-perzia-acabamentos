import { Router } from 'express';
import {
  getStatus,
  updateSettings,
  readSettings,
  updatePage,
  readPage,
} from '../controllers/pageController.js';
import { getVendasExcel } from '../controllers/vendasExcelController.js';

const router = Router();

// Rota base de status
router.get('/status', getStatus);

// Rota de leitura da planilha Excel de controle comercial
router.get('/vendas-excel', getVendasExcel);

// Rotas de configuração da página (/api/settings)
router.get('/settings', readSettings);
router.post('/settings', updateSettings);

// Rotas legadas/compatibilidade com o frontend (/api/page)
router.get('/page', readPage);
router.post('/page', updatePage);

import blogController from '../controllers/blogController.js';

// Rotas de blog
router.post('/blog/gerar', blogController.gerarBlogPost);
router.put('/blog/aprovar/:id', blogController.aprovarPost);
router.get('/blog/publicos', blogController.listarPublicos);
router.get('/blog/rascunhos', blogController.listarRascunhos);
router.delete('/blog/:id', blogController.excluirPost);

