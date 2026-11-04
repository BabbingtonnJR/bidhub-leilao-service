const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { criarApp } = require("../../src/api/app");
const { criarContainer } = require("../../src/api/container");
const { InMemoryLeilaoRepository } = require("../../src/infrastructure/persistence/InMemoryLeilaoRepository");
const { InMemoryEventPublisher } = require("../../src/infrastructure/messaging/InMemoryEventPublisher");
const { seed, novoLeilao } = require("./fixtures");

describe("API HTTP do Leilão Service", () => {
  let servidor, base, publicador;

  before(async () => {
    publicador = new InMemoryEventPublisher();
    const container = criarContainer({ leilaoRepository: new InMemoryLeilaoRepository(seed()), eventPublisher: publicador, env: {} });
    servidor = criarApp(container).listen(0);
    await new Promise((r) => servidor.once("listening", r));
    base = `http://127.0.0.1:${servidor.address().port}`;
  });
  after(() => servidor.close());

  const chamar = async (metodo, caminho, corpo) => {
    const res = await fetch(base + caminho, {
      method: metodo,
      headers: corpo !== undefined ? { "content-type": "application/json" } : {},
      body: corpo === undefined ? undefined : typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    });
    const tipo = res.headers.get("content-type") || "";
    return { status: res.status, corpo: tipo.includes("json") ? await res.json() : await res.text() };
  };

  test("GET /health", async () => {
    const r = await chamar("GET", "/health");
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo, { status: "ok", servico: "leilao-service", banco: "memoria", eventos: "memoria" });
  });

  test("CRUD completo: POST, GET, PUT, DELETE", async () => {
    const criado = await chamar("POST", "/leiloes", novoLeilao());
    assert.equal(criado.status, 201);
    const id = criado.corpo.id;
    assert.equal((await chamar("GET", `/leiloes/${id}`)).corpo.titulo, "Vaso");
    assert.equal((await chamar("PUT", `/leiloes/${id}`, { status: "ao-vivo" })).corpo.status, "ao-vivo");
    assert.equal((await chamar("GET", "/leiloes?status=ao-vivo")).corpo.some((l) => l.id === id), true);
    assert.deepEqual((await chamar("DELETE", `/leiloes/${id}`)).corpo, { removido: true, id });
    assert.equal((await chamar("GET", `/leiloes/${id}`)).status, 404);
  });

  test("POST /leiloes/{id}/lances: 200, 422 e 400", async () => {
    assert.equal((await chamar("POST", "/leiloes/1/lances", { valor: 160 })).status, 200);
    const baixo = await chamar("POST", "/leiloes/1/lances", { valor: 100 });
    assert.equal(baixo.status, 422);
    assert.equal(baixo.corpo.erro, "Lance deve ser de pelo menos 170");
    assert.equal((await chamar("POST", "/leiloes/abc/lances", { valor: 1 })).status, 400);
  });

  test("JSON inválido devolve 400", async () => {
    assert.equal((await chamar("POST", "/leiloes", "{ruim")).status, 400);
  });

  test("POST /leiloes/{id}/encerramento publica o evento", async () => {
    const r = await chamar("POST", "/leiloes/1/encerramento");
    assert.equal(r.status, 200);
    assert.equal(r.corpo.leilao.status, "encerrado");
    assert.equal(publicador.eventos.at(-1).leilaoId, 1);
    assert.equal((await chamar("POST", "/leiloes/1/encerramento")).status, 422);
  });

  test("Swagger em /docs e AsyncAPI em /docs/eventos", async () => {
    const openapi = await chamar("GET", "/docs/openapi.json");
    assert.equal(openapi.corpo.info.title, "BidHub - Leilão Service");
    assert.ok(Object.keys(openapi.corpo.paths).includes("/leiloes/{id}/lances"));
    assert.equal((await chamar("GET", "/docs/")).status, 200);
    assert.match((await chamar("GET", "/docs/eventos")).corpo, /AsyncApiStandalone/);
    assert.match((await chamar("GET", "/docs/eventos/asyncapi.yaml")).corpo, /LeilaoEncerrado/);
  });

  test("rota desconhecida devolve 404 em JSON", async () => {
    assert.deepEqual(await chamar("GET", "/nada"), { status: 404, corpo: { erro: "Rota não encontrada" } });
  });
});
