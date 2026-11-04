const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { criarContainer } = require("../../src/api/container");
const { InMemoryLeilaoRepository } = require("../../src/infrastructure/persistence/InMemoryLeilaoRepository");
const { InMemoryEventPublisher } = require("../../src/infrastructure/messaging/InMemoryEventPublisher");
const { ConflitoError } = require("../../src/domain/errors/DomainError");
const { seed, novoLeilao } = require("./fixtures");

function montar({ repo, publicador } = {}) {
  const leilaoRepository = repo || new InMemoryLeilaoRepository(seed());
  const eventPublisher = publicador || new InMemoryEventPublisher();
  const container = criarContainer({
    leilaoRepository,
    eventPublisher,
    env: {},
    relogio: () => new Date("2026-11-04T12:00:00.000Z"),
    gerarId: () => "evt-fixo",
  });
  return { container, leilaoRepository, eventPublisher };
}

describe("Feature listar-leiloes", () => {
  test("retorna todos em ordem de id, com lanceMinimo e sem _id", async () => {
    const lista = await montar().container.listarLeiloes().executar();
    assert.deepEqual(lista.map((l) => l.id), [1, 2, 3]);
    assert.equal(lista[0].lanceMinimo, 160);
    assert.equal("_id" in lista[0], false);
  });

  test("filtra por status e valida o filtro", async () => {
    const { container } = montar();
    assert.deepEqual((await container.listarLeiloes().executar({ status: "ao-vivo" })).map((l) => l.id), [1]);
    await assert.rejects(container.listarLeiloes().executar({ status: "xpto" }), { tipo: "validacao" });
  });
});

describe("Feature buscar-leilao", () => {
  test("retorna o leilão ou NaoEncontradoError", async () => {
    const { container } = montar();
    assert.equal((await container.buscarLeilao().executar(2)).titulo, "Carro");
    await assert.rejects(container.buscarLeilao().executar(99), { tipo: "nao-encontrado" });
  });
});

describe("Feature criar-leilao", () => {
  test("gera o próximo id e persiste", async () => {
    const { container } = montar();
    const criado = await container.criarLeilao().executar(novoLeilao());
    assert.equal(criado.id, 4);
    assert.equal(criado.lanceAtual, 200);
    assert.equal((await container.buscarLeilao().executar(4)).titulo, "Vaso");
  });

  test("lista campos obrigatórios faltando", async () => {
    await assert.rejects(montar().container.criarLeilao().executar({ titulo: "X" }), {
      tipo: "validacao",
      message: "Campos obrigatórios faltando: lote, categoria, vendedor, lanceInicial, incrementoMinimo, horario",
    });
  });

  test("tenta de novo com outro id se o id colidir (cadastros simultâneos)", async () => {
    const repo = new InMemoryLeilaoRepository(seed());
    let chamadas = 0;
    const adicionarOriginal = repo.adicionar.bind(repo);
    repo.adicionar = async (leilao) => {
      chamadas++;
      if (chamadas === 1) throw new ConflitoError("colidiu");
      return adicionarOriginal(leilao);
    };
    const criado = await montar({ repo }).container.criarLeilao().executar(novoLeilao());
    assert.equal(chamadas, 2);
    assert.equal(criado.id, 4);
  });
});

describe("Feature atualizar-leilao", () => {
  test("altera dados e status juntos", async () => {
    const leilao = await montar().container.atualizarLeilao().executar(2, { titulo: "Carro 1988", status: "ao-vivo" });
    assert.equal(leilao.titulo, "Carro 1988");
    assert.equal(leilao.status, "ao-vivo");
  });

  test("exige algum campo e recusa mudar o lance por aqui", async () => {
    const { container } = montar();
    await assert.rejects(container.atualizarLeilao().executar(1, {}), { tipo: "validacao" });
    await assert.rejects(container.atualizarLeilao().executar(1, { lanceAtual: 999 }), { tipo: "validacao" });
  });

  test("NaoEncontradoError para id inexistente e regra para leilão encerrado", async () => {
    const { container } = montar();
    await assert.rejects(container.atualizarLeilao().executar(99, { titulo: "x" }), { tipo: "nao-encontrado" });
    await assert.rejects(container.atualizarLeilao().executar(3, { titulo: "x" }), { tipo: "regra-de-negocio" });
  });
});

describe("Feature excluir-leilao", () => {
  test("remove e depois responde não encontrado", async () => {
    const { container } = montar();
    assert.deepEqual(await container.excluirLeilao().executar(2), { removido: true, id: 2 });
    await assert.rejects(container.excluirLeilao().executar(2), { tipo: "nao-encontrado" });
  });
});

describe("Feature dar-lance", () => {
  test("grava lance válido", async () => {
    const { container } = montar();
    const leilao = await container.darLance().executar(1, 160);
    assert.equal(leilao.lanceAtual, 160);
    assert.equal((await container.buscarLeilao().executar(1)).lanceAtual, 160);
  });

  test("valida valor ausente, leilão inexistente, valor baixo e leilão fora do ar", async () => {
    const { container } = montar();
    await assert.rejects(container.darLance().executar(1, undefined), { tipo: "validacao" });
    await assert.rejects(container.darLance().executar(99, 1000), { tipo: "nao-encontrado" });
    await assert.rejects(container.darLance().executar(1, 155), { tipo: "regra-de-negocio" });
    await assert.rejects(container.darLance().executar(2, 10000), { tipo: "regra-de-negocio" });
  });

  test("lance inválido não altera o registro", async () => {
    const { container } = montar();
    await assert.rejects(container.darLance().executar(1, 1));
    assert.equal((await container.buscarLeilao().executar(1)).lanceAtual, 150);
  });

  test("QC10: dois lances sobre o mesmo lanceAtual -> um grava, o outro recebe ConflitoError", async () => {
    const { container } = montar();
    const resultados = await Promise.allSettled([container.darLance().executar(1, 170), container.darLance().executar(1, 180)]);
    const aceitos = resultados.filter((r) => r.status === "fulfilled");
    const recusados = resultados.filter((r) => r.status === "rejected");
    assert.equal(aceitos.length, 1);
    assert.equal(recusados.length, 1);
    assert.equal(recusados[0].reason.tipo, "conflito");
    const gravado = (await container.buscarLeilao().executar(1)).lanceAtual;
    assert.equal(gravado, aceitos[0].value.lanceAtual);
  });
});

describe("Feature encerrar-leilao", () => {
  test("encerra, grava e publica LeilaoEncerrado", async () => {
    const { container, eventPublisher } = montar();
    const { leilao, evento } = await container.encerrarLeilao().executar(1);
    assert.equal(leilao.status, "encerrado");
    assert.equal((await container.buscarLeilao().executar(1)).status, "encerrado");
    assert.deepEqual(eventPublisher.eventos, [evento]);
    assert.deepEqual(evento, {
      tipo: "LeilaoEncerrado", eventId: "evt-fixo", leilaoId: 1, categoria: "Arte", vendedor: "Casa A", valorFinal: 150, encerradoEm: "2026-11-04T12:00:00.000Z",
    });
  });

  test("não encerra leilão agendado nem publica evento", async () => {
    const { container, eventPublisher } = montar();
    await assert.rejects(container.encerrarLeilao().executar(2), { tipo: "regra-de-negocio" });
    assert.equal(eventPublisher.eventos.length, 0);
  });

  test("se a publicação falhar, desfaz o encerramento", async () => {
    const publicador = { publicar: async () => { throw new Error("Service Bus fora"); } };
    const { container } = montar({ publicador });
    await assert.rejects(container.encerrarLeilao().executar(1), { message: "Service Bus fora" });
    const leilao = await container.buscarLeilao().executar(1);
    assert.equal(leilao.status, "ao-vivo");
    assert.equal(leilao.encerradoEm, null);
  });
});
