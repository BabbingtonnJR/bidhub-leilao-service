const { NaoEncontradoError } = require("../../domain/errors/DomainError");

class BuscarLeilaoUseCase {
  constructor(leilaoRepository) {
    this.leilaoRepository = leilaoRepository;
  }

  async executar(id) {
    const leilao = await this.leilaoRepository.buscarPorId(id);
    if (!leilao) {
      throw new NaoEncontradoError("Leilão não encontrado");
    }
    return leilao.toJSON();
  }
}

module.exports = { BuscarLeilaoUseCase };
