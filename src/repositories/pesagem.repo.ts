/**
 * "Repository" de pesagem.
 *
 * O estado da balança (peso atual + flag de tara) é volátil por design:
 * - Atualizado várias vezes por segundo pelo ESP32 — persistir no DB
 *   seria desperdício e geraria carga inútil em Turso.
 * - Quando o servidor reinicia, a balança zera junto. Comportamento desejado.
 *
 * Mantemos um repository mesmo assim para preservar a separação de camadas:
 * o service e o controller não sabem onde o estado vive.
 */

import type { BalancaState } from '../models/pesagem.model.js';

const state: BalancaState = {
  pesoAtual: 0,
  precisaTarar: false,
  ultimaAtualizacao: 0,
};

export const pesagemRepository = {
  /** Lê o estado completo */
  getState(): Readonly<BalancaState> {
    return { ...state };
  },

  /** ESP32 atualiza o peso */
  setPeso(peso: number): void {
    state.pesoAtual = peso;
    state.ultimaAtualizacao = Date.now();
  },

  /** Frontend pede tara */
  solicitarTara(): void {
    state.precisaTarar = true;
  },

  /** ESP32 consome a flag de tara (read-and-clear) */
  consumirTara(): boolean {
    const precisava = state.precisaTarar;
    state.precisaTarar = false;
    return precisava;
  },

  /** Indica se a balança recebeu leitura recente (< 5s) */
  estaOnline(): boolean {
    if (state.ultimaAtualizacao === 0) return false;
    return Date.now() - state.ultimaAtualizacao < 5000;
  },
};