/**
 * Validação dos payloads vindos da balança (ESP32) e do frontend.
 */

import { AppError } from '../errors/app-error.js';

interface PesoPayload {
  peso: number;
}

/**
 * Valida POST /balanca/peso (ESP32 enviando peso medido).
 * O ESP32 manda { peso: number } a cada loop.
 */
export function validatePesoPayload(body: unknown): PesoPayload {
  if (!body || typeof body !== 'object') {
    throw new AppError('Payload inválido', 400);
  }

  const b = body as Record<string, unknown>;
  const peso = Number(b.peso);

  if (!Number.isFinite(peso)) {
    throw new AppError('Campo "peso" deve ser numérico', 400);
  }

  // ESP32 às vezes manda valores absurdos quando descalibrado. Limitar é defensivo.
  if (peso < -100 || peso > 1000) {
    throw new AppError('Peso fora do intervalo aceito (-100 a 1000 kg)', 400);
  }

  return { peso };
}

interface ConfirmarPayload {
  ingredienteId: number;
  quantidadeConsumida: number;  // já convertida para a unidade do ingrediente
}

/**
 * Valida POST /balanca/confirmar — vem do frontend ao bater "Confirmar pesagem".
 * Recebe qual ingrediente e quanto vai abater do estoque.
 */
export function validateConfirmarPayload(body: unknown): ConfirmarPayload {
  if (!body || typeof body !== 'object') {
    throw new AppError('Payload inválido', 400);
  }

  const b = body as Record<string, unknown>;

  const ingredienteId = Number(b.ingredienteId);
  if (!Number.isInteger(ingredienteId) || ingredienteId <= 0) {
    throw new AppError('Campo "ingredienteId" inválido', 400);
  }

  const quantidadeConsumida = Number(b.quantidadeConsumida);
  if (!Number.isFinite(quantidadeConsumida) || quantidadeConsumida <= 0) {
    throw new AppError('Campo "quantidadeConsumida" deve ser > 0', 400);
  }

  return { ingredienteId, quantidadeConsumida };
}