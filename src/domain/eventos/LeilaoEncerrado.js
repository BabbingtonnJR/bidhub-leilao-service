// Evento de domínio: registra que um leilão terminou e com qual valor.
// É publicado na fila "leilao-encerrado" e consumido pelo Comissão Service.
// O contrato está descrito em src/api/asyncapi.yaml.
class LeilaoEncerrado {
  static TIPO = "LeilaoEncerrado";

  constructor({ eventId, leilaoId, categoria, vendedor, valorFinal, encerradoEm }) {
    this.eventId = eventId;
    this.leilaoId = leilaoId;
    this.categoria = categoria;
    this.vendedor = vendedor;
    this.valorFinal = valorFinal;
    this.encerradoEm = encerradoEm;
  }

  toJSON() {
    return {
      tipo: LeilaoEncerrado.TIPO,
      eventId: this.eventId,
      leilaoId: this.leilaoId,
      categoria: this.categoria,
      vendedor: this.vendedor,
      valorFinal: this.valorFinal,
      encerradoEm: this.encerradoEm,
    };
  }
}

module.exports = { LeilaoEncerrado };
