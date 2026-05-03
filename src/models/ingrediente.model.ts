/**
 * Modelo de Ingrediente — espelha a tabela `ingredientes`.
 *
 * O frontend usa camelCase (qtdMax, validade), o banco usa snake_case (qtd_max).
 * Os repositories convertem entre os dois.
 */

export type Unidade = 'kg' | 'g' | 'L' | 'ml' | 'un';

export interface Ingrediente {
  id: number;
  nome: string;
  unidade: Unidade;
  preco: number;
  qtd: number;
  qtdMax: number;
  validade: string | null;   // ISO date 'YYYY-MM-DD'
  criadoEm?: string;
  atualizadoEm?: string;
}

/** Payload de criação — sem id, datas geradas pelo banco */
export interface IngredienteInput {
  nome: string;
  unidade: Unidade;
  preco: number;
  qtd: number;
  qtdMax?: number;           // se não enviado, assume = qtd
  validade?: string | null;
}

/** Payload de uma nova compra (entrada) de um ingrediente já existente */
export interface CompraInput {
  quantidade: number;        // quanto está sendo adicionado
  precoUnitario: number;     // preço pago nesta compra
  validade?: string | null;  // nova validade (opcional)
  observacao?: string;
}

/** Payload de saída por consumo (vinda da balança) */
export interface ConsumoInput {
  ingredienteId: number;
  quantidade: number;        // já convertido para a unidade do ingrediente
  observacao?: string;
}