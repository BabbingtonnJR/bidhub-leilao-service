const { StatusLeilao, STATUS_VALIDOS, isStatusValido } = require("./StatusLeilao");
const { RegraDeNegocioError, ValidacaoError } = require("../errors/DomainError");
const { LeilaoEncerrado } = require("../eventos/LeilaoEncerrado");

// campos que podem ser alterados por PUT /leiloes/{id}
// (lanceAtual só muda por lance; "encerrado" só pelo encerramento)
const CAMPOS_EDITAVEIS = Object.freeze(["lote", "titulo", "categoria", "vendedor", "incrementoMinimo", "horario", "imagem"]);

function numeroPositivo(valor, campo) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) {
    throw new ValidacaoError(`${campo} deve ser um número maior que zero`);
  }
  return n;
}

class Leilao {
  constructor({
    id,
    lote,
    titulo,
    categoria,
    vendedor,
    lanceInicial,
    lanceAtual,
    incrementoMinimo,
    status,
    espectadores,
    horario,
    imagem,
    encerradoEm = null,
  }) {
    this.id = id;
    this.lote = lote;
    this.titulo = titulo;
    this.categoria = categoria;
    this.vendedor = vendedor;
    this.lanceInicial = Number(lanceInicial);
    this.lanceAtual = Number(lanceAtual);
    this.incrementoMinimo = Number(incrementoMinimo);
    this.status = status;
    this.espectadores = espectadores;
    this.horario = horario;
    this.imagem = imagem;
    this.encerradoEm = encerradoEm;
  }

  // leilão novo começa com o lance atual igual ao inicial
  static criar({ id, lote, titulo, categoria, vendedor, lanceInicial, incrementoMinimo, horario, status, imagem }) {
    const statusInicial = status || StatusLeilao.AGENDADO;
    if (!isStatusValido(statusInicial)) {
      throw new RegraDeNegocioError(`status deve ser um de: ${STATUS_VALIDOS.join(", ")}`);
    }
    if (statusInicial === StatusLeilao.ENCERRADO) {
      throw new RegraDeNegocioError("Um leilão novo não pode começar encerrado");
    }
    const inicial = numeroPositivo(lanceInicial, "lanceInicial");
    return new Leilao({
      id,
      lote,
      titulo,
      categoria,
      vendedor,
      lanceInicial: inicial,
      lanceAtual: inicial,
      incrementoMinimo: numeroPositivo(incrementoMinimo, "incrementoMinimo"),
      status: statusInicial,
      espectadores: 0,
      horario,
      imagem: imagem || "🏷️",
    });
  }

  get lanceMinimo() {
    return this.lanceAtual + this.incrementoMinimo;
  }

  get estaEncerrado() {
    return this.status === StatusLeilao.ENCERRADO;
  }

  darLance(valor) {
    if (this.status !== StatusLeilao.AO_VIVO) {
      throw new RegraDeNegocioError("Só é possível dar lance em leilão ao vivo");
    }
    const novoLance = Number(valor);
    if (!novoLance || novoLance < this.lanceMinimo) {
      throw new RegraDeNegocioError(`Lance deve ser de pelo menos ${this.lanceMinimo}`);
    }
    this.lanceAtual = novoLance;
  }

  alterarStatus(status) {
    if (!isStatusValido(status)) {
      throw new RegraDeNegocioError(`status deve ser um de: ${STATUS_VALIDOS.join(", ")}`);
    }
    if (this.estaEncerrado) {
      throw new RegraDeNegocioError("Leilão encerrado não pode mudar de status");
    }
    if (status === StatusLeilao.ENCERRADO) {
      throw new RegraDeNegocioError("Para encerrar use POST /leiloes/{id}/encerramento");
    }
    this.status = status;
  }

  atualizarDados(dados) {
    if (this.estaEncerrado) {
      throw new RegraDeNegocioError("Leilão encerrado não pode ser alterado");
    }
    for (const campo of CAMPOS_EDITAVEIS) {
      if (dados[campo] === undefined) continue;
      this[campo] = campo === "incrementoMinimo" ? numeroPositivo(dados[campo], campo) : dados[campo];
    }
  }

  // só leilão ao vivo pode ser encerrado; o valor final é o lance atual
  encerrar({ eventId, agora }) {
    if (this.status !== StatusLeilao.AO_VIVO) {
      throw new RegraDeNegocioError("Só é possível encerrar leilão ao vivo");
    }
    this.status = StatusLeilao.ENCERRADO;
    this.encerradoEm = agora;
    return new LeilaoEncerrado({
      eventId,
      leilaoId: this.id,
      categoria: this.categoria,
      vendedor: this.vendedor,
      valorFinal: this.lanceAtual,
      encerradoEm: agora,
    });
  }

  toJSON() {
    return {
      id: this.id,
      lote: this.lote,
      titulo: this.titulo,
      categoria: this.categoria,
      vendedor: this.vendedor,
      lanceInicial: this.lanceInicial,
      lanceAtual: this.lanceAtual,
      lanceMinimo: this.lanceMinimo,
      incrementoMinimo: this.incrementoMinimo,
      status: this.status,
      espectadores: this.espectadores,
      horario: this.horario,
      imagem: this.imagem,
      encerradoEm: this.encerradoEm,
    };
  }
}

module.exports = { Leilao, CAMPOS_EDITAVEIS };
