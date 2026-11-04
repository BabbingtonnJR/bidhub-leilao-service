const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { MongoLeilaoRepository } = require("../../src/infrastructure/persistence/MongoLeilaoRepository");
const { ServiceBusEventPublisher } = require("../../src/infrastructure/messaging/ServiceBusEventPublisher");
const { Leilao } = require("../../src/domain/leilao/Leilao");
const { LeilaoEncerrado } = require("../../src/domain/eventos/LeilaoEncerrado");
const { seed } = require("./fixtures");

// coleção falsa que registra as chamadas feitas pelo repositório
function colecaoFalsa({ modifiedCount = 1, erroInsert = null } = {}) {
  const chamadas = [];
  const cursor = (docs) => ({ sort: () => cursor(docs), limit: () => cursor(docs), toArray: async () => docs });
  return {
    chamadas,
    createIndex: async (...a) => chamadas.push(["createIndex", ...a]),
    find: () => cursor([{ _id: "abc", ...seed()[0] }]),
    findOne: async (f) => (chamadas.push(["findOne", f]), { _id: "abc", ...seed()[0] }),
    insertOne: async (d) => { chamadas.push(["insertOne", d]); if (erroInsert) throw erroInsert; },
    updateOne: async (f, u) => (chamadas.push(["updateOne", f, u]), { modifiedCount }),
    deleteOne: async (f) => (chamadas.push(["deleteOne", f]), { deletedCount: 1 }),
  };
}

const conexaoCom = (colecao) => ({ getDb: async () => ({ collection: () => colecao }) });

describe("MongoLeilaoRepository", () => {
  test("cria o índice único em id e remove o _id do Mongo", async () => {
    const col = colecaoFalsa();
    const repo = new MongoLeilaoRepository(conexaoCom(col));
    const leilao = await repo.buscarPorId(1);
    assert.deepEqual(col.chamadas[0], ["createIndex", { id: 1 }, { unique: true }]);
    assert.ok(leilao instanceof Leilao);
    assert.equal("_id" in leilao.toJSON(), false);
  });

  test("registrarLance() usa filtro condicional com lanceAtual lido e status ao-vivo", async () => {
    const col = colecaoFalsa({ modifiedCount: 1 });
    const repo = new MongoLeilaoRepository(conexaoCom(col));
    const leilao = new Leilao(seed()[0]);
    leilao.darLance(170);
    assert.equal(await repo.registrarLance(leilao, 150), true);
    const [, filtro, update] = col.chamadas.find((c) => c[0] === "updateOne");
    assert.deepEqual(filtro, { id: 1, lanceAtual: 150, status: "ao-vivo" });
    assert.deepEqual(update, { $set: { lanceAtual: 170 } });
  });

  test("registrarLance() retorna false quando nenhum documento casou (lance concorrente)", async () => {
    const repo = new MongoLeilaoRepository(conexaoCom(colecaoFalsa({ modifiedCount: 0 })));
    assert.equal(await repo.registrarLance(new Leilao(seed()[0]), 150), false);
  });

  test("adicionar() não grava lanceMinimo e traduz chave duplicada em ConflitoError", async () => {
    const col = colecaoFalsa();
    await new MongoLeilaoRepository(conexaoCom(col)).adicionar(new Leilao(seed()[1]));
    const [, doc] = col.chamadas.find((c) => c[0] === "insertOne");
    assert.equal("lanceMinimo" in doc, false);

    const dup = new MongoLeilaoRepository(conexaoCom(colecaoFalsa({ erroInsert: Object.assign(new Error("dup"), { code: 11000 }) })));
    await assert.rejects(dup.adicionar(new Leilao(seed()[1])), { tipo: "conflito" });
  });
});

describe("ServiceBusEventPublisher", () => {
  test("envia o evento para a fila com messageId = eventId", async () => {
    const enviados = [];
    const client = { createSender: (fila) => ({ fila, sendMessages: async (m) => enviados.push({ fila, m }), close: async () => {} }), close: async () => {} };
    const pub = new ServiceBusEventPublisher({ client });
    const evento = new LeilaoEncerrado({ eventId: "e-9", leilaoId: 1, categoria: "Arte", vendedor: "Casa A", valorFinal: 150, encerradoEm: "2026-11-04T12:00:00.000Z" });
    await pub.publicar(evento);
    assert.equal(enviados[0].fila, "leilao-encerrado");
    assert.equal(enviados[0].m.messageId, "e-9");
    assert.equal(enviados[0].m.subject, "LeilaoEncerrado");
    assert.deepEqual(enviados[0].m.body, evento.toJSON());
  });
});
