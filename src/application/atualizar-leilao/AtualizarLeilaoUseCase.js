const { CAMPOS_EDITAVEIS } = require("../../domain/leilao/Leilao");
const { ValidacaoError, NaoEncontradoError } = require("../../domain/errors/DomainError");

class AtualizarLeilaoUseCase {
  constructor(leilaoRepository) {
    this.leilaoRepository = leilaoRepository;
  }

  // altera dados cadastrais e/ou status (agendado <-> ao-vivo).
  // lance tem rota própria (dar-lance) e encerramento também (encerrar-leilao).
  async executar(id, dados = {}) {
    if (dados.lanceAtual !== undefined || dados.lanceInicial !== undefined) {
      throw new ValidacaoError("lanceAtual e lanceInicial não podem ser alterados; use POST /leiloes/{id}/lances");
    }
    const temDados = CAMPOS_EDITAVEIS.some((c) => dados[c] !== undefined);
    const temStatus = dados.status !== undefined;
    if (!temDados && !temStatus) {
      throw new ValidacaoError(`Envie ao menos um destes campos: ${[...CAMPOS_EDITAVEIS, "status"].join(", ")}`);
    }

    const leilao = await this.leilaoRepository.buscarPorId(id);
    if (!leilao) {
      throw new NaoEncontradoError("Leilão não encontrado");
    }

    if (temDados) leilao.atualizarDados(dados);
    if (temStatus) leilao.alterarStatus(dados.status);

    await this.leilaoRepository.atualizar(leilao);
    return leilao.toJSON();
  }
}

module.exports = { AtualizarLeilaoUseCase };
