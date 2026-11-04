const { isStatusValido, STATUS_VALIDOS } = require("../../domain/leilao/StatusLeilao");
const { ValidacaoError } = require("../../domain/errors/DomainError");

class ListarLeiloesUseCase {
  constructor(leilaoRepository) {
    this.leilaoRepository = leilaoRepository;
  }

  // filtro opcional por status (?status=ao-vivo)
  async executar({ status } = {}) {
    if (status !== undefined && !isStatusValido(status)) {
      throw new ValidacaoError(`status deve ser um de: ${STATUS_VALIDOS.join(", ")}`);
    }
    const leiloes = await this.leilaoRepository.listar();
    return leiloes.filter((l) => !status || l.status === status).map((l) => l.toJSON());
  }
}

module.exports = { ListarLeiloesUseCase };
