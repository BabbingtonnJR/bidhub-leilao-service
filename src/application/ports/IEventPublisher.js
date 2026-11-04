// Porta de saída para eventos de domínio.
// ServiceBusEventPublisher (produção) e InMemoryEventPublisher (testes) implementam.
class IEventPublisher {
  async publicar(_evento) {
    throw new Error("IEventPublisher.publicar não implementado");
  }
}

module.exports = { IEventPublisher };
