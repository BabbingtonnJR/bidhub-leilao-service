const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { Leilao } = require("../../src/domain/leilao/Leilao");
const { LeilaoEncerrado } = require("../../src/domain/eventos/LeilaoEncerrado");
const { seed } = require("./fixtures");

describe("Entidade Leilao", () => {
  test("criar() define lance atual = inicial, status agendado, imagem padrão e sem encerramento", () => {
    const l = Leilao.criar({ id: 9, lote: "9", titulo: "T", categoria: "C", vendedor: "V", lanceInicial: "200", incrementoMinimo: "20", horario: "H" });
    assert.equal(l.lanceAtual, 200);
    assert.equal(l.lanceMinimo, 220);
    assert.equal(l.status, "agendado");
    assert.equal(l.espectadores, 0);
    assert.equal(l.imagem, "🏷️");
    assert.equal(l.encerradoEm, null);
  });

  test("criar() recusa status encerrado, status inválido e valores não positivos", () => {
    const base = { id: 1, lote: "1", titulo: "T", categoria: "C", vendedor: "V", lanceInicial: 10, incrementoMinimo: 1, horario: "H" };
    assert.throws(() => Leilao.criar({ ...base, status: "encerrado" }), { tipo: "regra-de-negocio" });
    assert.throws(() => Leilao.criar({ ...base, status: "pausado" }), { tipo: "regra-de-negocio" });
    assert.throws(() => Leilao.criar({ ...base, lanceInicial: 0 }), { tipo: "validacao" });
    assert.throws(() => Leilao.criar({ ...base, incrementoMinimo: "abc" }), { tipo: "validacao" });
  });

  test("darLance() rejeita valor abaixo de lanceAtual + incremento", () => {
    const l = new Leilao(seed()[0]);
    assert.throws(() => l.darLance(155), { tipo: "regra-de-negocio", message: "Lance deve ser de pelo menos 160" });
    l.darLance(160);
    assert.equal(l.lanceAtual, 160);
  });

  test("darLance() só é aceito em leilão ao vivo", () => {
    assert.throws(() => new Leilao(seed()[1]).darLance(10000), { message: "Só é possível dar lance em leilão ao vivo" });
    assert.throws(() => new Leilao(seed()[2]).darLance(10000), { tipo: "regra-de-negocio" });
  });

  test("alterarStatus() aceita agendado <-> ao-vivo e recusa encerrar por aqui", () => {
    const l = new Leilao(seed()[1]);
    l.alterarStatus("ao-vivo");
    assert.equal(l.status, "ao-vivo");
    l.alterarStatus("agendado");
    assert.throws(() => l.alterarStatus("pausado"), { tipo: "regra-de-negocio" });
    assert.throws(() => l.alterarStatus("encerrado"), { message: /encerramento/ });
  });

  test("leilão encerrado não muda de status nem de dados", () => {
    const l = new Leilao(seed()[2]);
    assert.throws(() => l.alterarStatus("ao-vivo"), { tipo: "regra-de-negocio" });
    assert.throws(() => l.atualizarDados({ titulo: "Novo" }), { tipo: "regra-de-negocio" });
  });

  test("atualizarDados() muda só os campos editáveis", () => {
    const l = new Leilao(seed()[0]);
    l.atualizarDados({ titulo: "Quadro restaurado", incrementoMinimo: "25", lanceAtual: 1 });
    assert.equal(l.titulo, "Quadro restaurado");
    assert.equal(l.incrementoMinimo, 25);
    assert.equal(l.lanceAtual, 150);
  });

  test("encerrar() só em leilão ao vivo e gera LeilaoEncerrado com o valor final", () => {
    const l = new Leilao(seed()[0]);
    const evento = l.encerrar({ eventId: "e-1", agora: "2026-11-04T12:00:00.000Z" });
    assert.ok(evento instanceof LeilaoEncerrado);
    assert.equal(l.status, "encerrado");
    assert.equal(l.encerradoEm, "2026-11-04T12:00:00.000Z");
    assert.deepEqual(evento.toJSON(), {
      tipo: "LeilaoEncerrado", eventId: "e-1", leilaoId: 1, categoria: "Arte", vendedor: "Casa A", valorFinal: 150, encerradoEm: "2026-11-04T12:00:00.000Z",
    });
    assert.throws(() => new Leilao(seed()[1]).encerrar({ eventId: "e", agora: "x" }), { message: "Só é possível encerrar leilão ao vivo" });
  });

  test("toJSON() inclui lanceMinimo calculado", () => {
    assert.equal(new Leilao(seed()[0]).toJSON().lanceMinimo, 160);
  });
});
