const { ILeilaoRepository } = require("../../domain/leilao/ILeilaoRepository");
const { Leilao } = require("../../domain/leilao/Leilao");
const { StatusLeilao } = require("../../domain/leilao/StatusLeilao");
const { ConflitoError } = require("../../domain/errors/DomainError");

function paraDocumento(leilao) {
  const { lanceMinimo, ...doc } = leilao.toJSON();
  return doc;
}

// usado nos testes e para rodar localmente sem MongoDB
class InMemoryLeilaoRepository extends ILeilaoRepository {
  constructor(seed = []) {
    super();
    this.itens = new Map(seed.map((dados) => [dados.id, { ...dados }]));
  }

  async listar() {
    return [...this.itens.values()].sort((a, b) => a.id - b.id).map((d) => new Leilao(d));
  }

  async buscarPorId(id) {
    const dados = this.itens.get(id);
    return dados ? new Leilao(dados) : null;
  }

  async proximoId() {
    const ids = [...this.itens.keys()];
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  async adicionar(leilao) {
    if (this.itens.has(leilao.id)) {
      throw new ConflitoError(`Já existe leilão com id ${leilao.id}`);
    }
    this.itens.set(leilao.id, paraDocumento(leilao));
  }

  async atualizar(leilao) {
    this.itens.set(leilao.id, paraDocumento(leilao));
  }

  // mesma semântica do MongoLeilaoRepository: grava só se nada mudou desde a leitura
  async registrarLance(leilao, lanceAnterior) {
    const atual = this.itens.get(leilao.id);
    if (!atual || atual.lanceAtual !== lanceAnterior || atual.status !== StatusLeilao.AO_VIVO) {
      return false;
    }
    atual.lanceAtual = leilao.lanceAtual;
    return true;
  }

  async remover(id) {
    return this.itens.delete(id);
  }
}

module.exports = { InMemoryLeilaoRepository };
