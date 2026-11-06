import { Router } from 'express';
import { updatePage } from '../controllers/pageController.js';

const router = Router();

router.post('/page', updatePage);

export default router;
