// Porta de persistência do leilão. MongoLeilaoRepository e InMemoryLeilaoRepository implementam.
class ILeilaoRepository {
  async listar() {
    throw new Error("ILeilaoRepository.listar não implementado");
  }

  async buscarPorId(_id) {
    throw new Error("ILeilaoRepository.buscarPorId não implementado");
  }

  async proximoId() {
    throw new Error("ILeilaoRepository.proximoId não implementado");
  }

  // deve lançar ConflitoError se o id já existir
  async adicionar(_leilao) {
    throw new Error("ILeilaoRepository.adicionar não implementado");
  }

  async atualizar(_leilao) {
    throw new Error("ILeilaoRepository.atualizar não implementado");
  }

  // escrita condicional: grava o novo lanceAtual só se o valor salvo ainda for
  // lanceAnterior e o leilão ainda estiver ao vivo. Retorna true se gravou.
  async registrarLance(_leilao, _lanceAnterior) {
    throw new Error("ILeilaoRepository.registrarLance não implementado");
  }

  async remover(_id) {
    throw new Error("ILeilaoRepository.remover não implementado");
  }
}

module.exports = { ILeilaoRepository };
