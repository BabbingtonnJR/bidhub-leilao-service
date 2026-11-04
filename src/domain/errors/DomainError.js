// Erros de domínio. A camada API traduz cada "tipo" em um status HTTP (api/errorHandler.js).
class DomainError extends Error {
  constructor(mensagem, tipo) {
    super(mensagem);
    this.name = this.constructor.name;
    this.tipo = tipo;
  }
}

// dados de entrada inválidos -> 400
class ValidacaoError extends DomainError {
  constructor(mensagem) {
    super(mensagem, "validacao");
  }
}

// recurso inexistente -> 404
class NaoEncontradoError extends DomainError {
  constructor(mensagem) {
    super(mensagem, "nao-encontrado");
  }
}

// outro processo alterou o recurso antes (ex.: lance concorrente) -> 409
class ConflitoError extends DomainError {
  constructor(mensagem) {
    super(mensagem, "conflito");
  }
}

// regra de negócio violada (ex.: lance abaixo do mínimo) -> 422
class RegraDeNegocioError extends DomainError {
  constructor(mensagem) {
    super(mensagem, "regra-de-negocio");
  }
}

module.exports = { DomainError, ValidacaoError, NaoEncontradoError, ConflitoError, RegraDeNegocioError };
