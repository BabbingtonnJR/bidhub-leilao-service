const { IEventPublisher } = require("../../application/ports/IEventPublisher");

// guarda os eventos em memória; usado nos testes e quando não há Service Bus configurado
class InMemoryEventPublisher extends IEventPublisher {
  constructor({ log = null } = {}) {
    super();
    this.eventos = [];
    this.log = log;
  }

  async publicar(evento) {
    const corpo = evento.toJSON();
    this.eventos.push(corpo);
    if (this.log) this.log(`[evento em memória] ${corpo.tipo} leilão ${corpo.leilaoId}`);
  }
}

module.exports = { InMemoryEventPublisher };
