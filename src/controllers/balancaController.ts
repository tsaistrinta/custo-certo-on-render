/**
 * Controller HTTP para a balança.
 *
 * Endpoints divididos em dois consumidores:
 *  - ESP32:    POST /balanca/peso, GET /balanca/tara
 *  - Frontend: GET /balanca/peso,  POST /balanca/tara, POST /balanca/confirmar
 */

import type { Request, Response } from 'express';
import { balancaService } from '../services/balanca.service.js';
import {
  validatePesoPayload,
  validateConfirmarPayload,
} from '../schemas/balanca.schema.js';

export const balancaController = {
  /** POST /balanca/peso — ESP32 envia leitura */
  receberPeso(req: Request, res: Response): void {
    const { peso } = validatePesoPayload(req.body);
    balancaService.registrarLeitura(peso);
    res.json({ ok: true });
  },

  /** GET /balanca/peso — Frontend faz polling */
  lerPeso(_req: Request, res: Response): void {
    const estado = balancaService.getEstadoAtual();
    res.json({
      peso: estado.pesoAtual,
      online: estado.online,
      ultimaAtualizacao: estado.ultimaAtualizacao,
    });
  },

  /** POST /balanca/tara — Frontend solicita */
  solicitarTara(_req: Request, res: Response): void {
    balancaService.solicitarTara();
    res.json({ ok: true });
  },

  /** GET /balanca/tara — ESP32 verifica e zera flag */
  verificarTara(_req: Request, res: Response): void {
    const tarar = balancaService.verificarTara();
    res.json({ tarar });
  },

  /** POST /balanca/confirmar — Frontend confirma pesagem e abate estoque */
  async confirmar(req: Request, res: Response): Promise<void> {
    const { ingredienteId, quantidadeConsumida } = validateConfirmarPayload(req.body);
    const resultado = await balancaService.confirmarPesagem(ingredienteId, quantidadeConsumida);
    res.json(resultado);
  },
};