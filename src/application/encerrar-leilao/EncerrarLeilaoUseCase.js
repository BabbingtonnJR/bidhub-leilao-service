const { NaoEncontradoError } = require("../../domain/errors/DomainError");

class EncerrarLeilaoUseCase {
  // relogio e gerarId são injetados para os testes serem determinísticos
  constructor(leilaoRepository, eventPublisher, { relogio = () => new Date(), gerarId = () => globalThis.crypto.randomUUID() } = {}) {
    this.leilaoRepository = leilaoRepository;
    this.eventPublisher = eventPublisher;
    this.relogio = relogio;
    this.gerarId = gerarId;
  }

  async executar(id) {
    const leilao = await this.leilaoRepository.buscarPorId(id);
    if (!leilao) {
      throw new NaoEncontradoError("Leilão não encontrado");
    }

    const estadoAnterior = { status: leilao.status, encerradoEm: leilao.encerradoEm };
    const evento = leilao.encerrar({ eventId: this.gerarId(), agora: this.relogio().toISOString() });
    await this.leilaoRepository.atualizar(leilao);

    // se o evento não puder ser publicado, desfazemos o encerramento:
    // sem o evento, a comissão nunca seria gerada
    try {
      await this.eventPublisher.publicar(evento);
    } catch (err) {
      leilao.status = estadoAnterior.status;
      leilao.encerradoEm = estadoAnterior.encerradoEm;
      await this.leilaoRepository.atualizar(leilao);
      throw err;
    }

    return { leilao: leilao.toJSON(), evento: evento.toJSON() };
  }
}

module.exports = { EncerrarLeilaoUseCase };
