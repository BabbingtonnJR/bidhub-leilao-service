const { ValidacaoError } = require("../../domain/errors/DomainError");

function lerId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidacaoError("id inválido");
  }
  return id;
}

module.exports = { lerId };
