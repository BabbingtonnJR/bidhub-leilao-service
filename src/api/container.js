// Composition root: único arquivo da camada API que conhece a Infrastructure (regra 5 da Seção 8.7).
const { MongoConnection } = require("../infrastructure/persistence/MongoConnection");
const { MongoLeilaoRepository } = require("../infrastructure/persistence/MongoLeilaoRepository");
const { InMemoryLeilaoRepository } = require("../infrastructure/persistence/InMemoryLeilaoRepository");
const dadosExemplo = require("../infrastructure/persistence/dadosExemplo");
const { ServiceBusEventPublisher } = require("../infrastructure/messaging/ServiceBusEventPublisher");
const { InMemoryEventPublisher } = require("../infrastructure/messaging/InMemoryEventPublisher");

const { ListarLeiloesUseCase } = require("../application/listar-leiloes/ListarLeiloesUseCase");
const { BuscarLeilaoUseCase } = require("../application/buscar-leilao/BuscarLeilaoUseCase");
const { CriarLeilaoUseCase } = require("../application/criar-leilao/CriarLeilaoUseCase");
const { AtualizarLeilaoUseCase } = require("../application/atualizar-leilao/AtualizarLeilaoUseCase");
const { ExcluirLeilaoUseCase } = require("../application/excluir-leilao/ExcluirLeilaoUseCase");
const { DarLanceUseCase } = require("../application/dar-lance/DarLanceUseCase");
const { EncerrarLeilaoUseCase } = require("../application/encerrar-leilao/EncerrarLeilaoUseCase");

// sem MONGODB_URI / SERVICEBUS_CONNECTION_STRING o serviço sobe em memória (útil para rodar local)
function criarContainer({ leilaoRepository, eventPublisher, env = process.env, relogio, gerarId } = {}) {
  let conexaoMongo = null;
  let repositorio = leilaoRepository;
  if (!repositorio) {
    if (env.MONGODB_URI) {
      conexaoMongo = new MongoConnection({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB || "bidhub" });
      repositorio = new MongoLeilaoRepository(conexaoMongo);
    } else {
      repositorio = new InMemoryLeilaoRepository(dadosExemplo);
    }
  }

  let publicador = eventPublisher;
  if (!publicador) {
    publicador = env.SERVICEBUS_CONNECTION_STRING
      ? new ServiceBusEventPublisher({
          connectionString: env.SERVICEBUS_CONNECTION_STRING,
          fila: env.SERVICEBUS_QUEUE || "leilao-encerrado",
        })
      : new InMemoryEventPublisher({ log: console.log });
  }

  const infra = {
    banco: conexaoMongo ? "mongodb" : "memoria",
    eventos: publicador instanceof ServiceBusEventPublisher ? "service-bus" : "memoria",
    verificarBanco: () => (conexaoMongo ? conexaoMongo.ping() : Promise.resolve()),
    async fechar() {
      if (conexaoMongo) await conexaoMongo.fechar();
      if (publicador.fechar) await publicador.fechar();
    },
  };

  return {
    infra,
    eventPublisher: publicador,
    listarLeiloes: () => new ListarLeiloesUseCase(repositorio),
    buscarLeilao: () => new BuscarLeilaoUseCase(repositorio),
    criarLeilao: () => new CriarLeilaoUseCase(repositorio),
    atualizarLeilao: () => new AtualizarLeilaoUseCase(repositorio),
    excluirLeilao: () => new ExcluirLeilaoUseCase(repositorio),
    darLance: () => new DarLanceUseCase(repositorio),
    encerrarLeilao: () => new EncerrarLeilaoUseCase(repositorio, publicador, { relogio, gerarId }),
  };
}

module.exports = { criarContainer };
