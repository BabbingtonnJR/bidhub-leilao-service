const { ServiceBusClient } = require("@azure/service-bus");
const { IEventPublisher } = require("../../application/ports/IEventPublisher");

// publica eventos de domínio na fila do Azure Service Bus (padrão: leilao-encerrado)
class ServiceBusEventPublisher extends IEventPublisher {
  constructor({ connectionString, fila = "leilao-encerrado", client } = {}) {
    super();
    this.fila = fila;
    this.client = client || new ServiceBusClient(connectionString);
    this.sender = this.client.createSender(fila);
  }

  async publicar(evento) {
    const corpo = evento.toJSON();
    await this.sender.sendMessages({
      body: corpo,
      contentType: "application/json",
      subject: corpo.tipo,
      // messageId = eventId: com detecção de duplicidade ligada na fila, reenvios são descartados
      messageId: corpo.eventId,
      applicationProperties: { tipo: corpo.tipo, leilaoId: corpo.leilaoId },
    });
  }

  async fechar() {
    await this.sender.close();
    await this.client.close();
  }
}

module.exports = { ServiceBusEventPublisher };
