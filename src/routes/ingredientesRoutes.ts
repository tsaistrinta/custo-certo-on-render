import { Router } from 'express';
import { ingredientesController } from '../../controllers/ingredientesController.js';

const router = Router();

// Ordem importa: rotas estáticas antes de :id
router.get('/historico', ingredientesController.historico);

router.get('/', ingredientesController.listar);
router.post('/', ingredientesController.cadastrar);

router.get('/:id', ingredientesController.buscar);
router.delete('/:id', ingredientesController.deletar);

router.post('/:id/compras', ingredientesController.registrarCompra);

export default router;