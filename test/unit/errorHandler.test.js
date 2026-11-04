const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { errorHandler } = require("../../src/api/errorHandler");
const { ValidacaoError, NaoEncontradoError, ConflitoError, RegraDeNegocioError } = require("../../src/domain/errors/DomainError");

function respostaFalsa() {
  return {
    statusCode: null,
    corpo: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.corpo = b; return this; },
  };
}

describe("errorHandler", () => {
  test("traduz erros de domínio em 400/404/409/422", () => {
    const casos = [
      [new ValidacaoError("v"), 400],
      [new NaoEncontradoError("n"), 404],
      [new ConflitoError("c"), 409],
      [new RegraDeNegocioError("r"), 422],
    ];
    for (const [erro, esperado] of casos) {
      const res = respostaFalsa();
      errorHandler(erro, {}, res, () => {});
      assert.equal(res.statusCode, esperado);
      assert.deepEqual(res.corpo, { erro: erro.message });
    }
  });

  test("JSON inválido vira 400 e erro inesperado vira 500", (t) => {
    t.mock.method(console, "error", () => {});
    const r1 = respostaFalsa();
    errorHandler({ type: "entity.parse.failed" }, {}, r1, () => {});
    assert.equal(r1.statusCode, 400);
    const r2 = respostaFalsa();
    errorHandler(new Error("boom"), {}, r2, () => {});
    assert.equal(r2.statusCode, 500);
    assert.equal(r2.corpo.detalhe, "boom");
  });
});
