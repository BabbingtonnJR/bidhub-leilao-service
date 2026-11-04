const { ValidacaoError, NaoEncontradoError, ConflitoError } = require("../../domain/errors/DomainError");

class DarLanceUseCase {
  constructor(leilaoRepository) {
    this.leilaoRepository = leilaoRepository;
  }

  async executar(id, valor) {
    if (valor === undefined || valor === null || valor === "") {
      throw new ValidacaoError("Informe o valor do lance");
    }

    const leilao = await this.leilaoRepository.buscarPorId(id);
    if (!leilao) {
      throw new NaoEncontradoError("Leilão não encontrado");
    }

    const lanceAnterior = leilao.lanceAtual;
    leilao.darLance(valor); // regra: ao vivo e >= lanceAtual + incrementoMinimo

    // escrita condicional: só grava se ninguém deu lance entre a leitura e agora
    const gravou = await this.leilaoRepository.registrarLance(leilao, lanceAnterior);
    if (!gravou) {
      throw new ConflitoError("Outro lance foi registrado antes do seu. Atualize o leilão e tente de novo.");
    }
    return leilao.toJSON();
  }
}

module.exports = { DarLanceUseCase };
