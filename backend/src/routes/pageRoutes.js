import { Router } from 'express';
import {
  getStatus,
  updateSettings,
  readSettings,
  updatePage,
  readPage,
} from '../controllers/pageController.js';

const router = Router();

// Rota base de status
router.get('/status', getStatus);

// Rotas de configuração da página solicitadas (/api/settings)
router.get('/settings', readSettings);
router.post('/settings', updateSettings);

// Rotas legadas/compatibilidade com o frontend (/api/page)
router.get('/page', readPage);
router.post('/page', updatePage);

export default router;
