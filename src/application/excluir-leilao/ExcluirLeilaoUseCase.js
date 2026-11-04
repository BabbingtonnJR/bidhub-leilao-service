const { NaoEncontradoError } = require("../../domain/errors/DomainError");

class ExcluirLeilaoUseCase {
  constructor(leilaoRepository) {
    this.leilaoRepository = leilaoRepository;
  }

  async executar(id) {
    const removido = await this.leilaoRepository.remover(id);
    if (!removido) {
      throw new NaoEncontradoError("Leilão não encontrado");
    }
    return { removido: true, id };
  }
}

module.exports = { ExcluirLeilaoUseCase };
