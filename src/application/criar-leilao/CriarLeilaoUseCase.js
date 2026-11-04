const { Leilao } = require("../../domain/leilao/Leilao");
const { ValidacaoError, ConflitoError } = require("../../domain/errors/DomainError");

const CAMPOS_OBRIGATORIOS = Object.freeze([
  "lote",
  "titulo",
  "categoria",
  "vendedor",
  "lanceInicial",
  "incrementoMinimo",
  "horario",
]);

const TENTATIVAS = 3;

class CriarLeilaoUseCase {
  constructor(leilaoRepository) {
    this.leilaoRepository = leilaoRepository;
  }

  async executar(dados = {}) {
    const faltando = CAMPOS_OBRIGATORIOS.filter((c) => dados[c] === undefined || dados[c] === "");
    if (faltando.length) {
      throw new ValidacaoError(`Campos obrigatórios faltando: ${faltando.join(", ")}`);
    }

    // proximoId() é "maior id + 1": se dois cadastros chegarem juntos, o índice
    // único em id recusa o segundo (ConflitoError) e tentamos com o id seguinte
    for (let tentativa = 1; ; tentativa++) {
      const id = await this.leilaoRepository.proximoId();
      const leilao = Leilao.criar({ ...dados, id });
      try {
        await this.leilaoRepository.adicionar(leilao);
        return leilao.toJSON();
      } catch (err) {
        if (!(err instanceof ConflitoError) || tentativa >= TENTATIVAS) throw err;
      }
    }
  }
}

module.exports = { CriarLeilaoUseCase, CAMPOS_OBRIGATORIOS };
