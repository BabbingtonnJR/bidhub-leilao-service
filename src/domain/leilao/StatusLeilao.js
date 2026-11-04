const StatusLeilao = Object.freeze({
  AO_VIVO: "ao-vivo",
  AGENDADO: "agendado",
  ENCERRADO: "encerrado",
});

const STATUS_VALIDOS = Object.freeze(Object.values(StatusLeilao));

function isStatusValido(status) {
  return STATUS_VALIDOS.includes(status);
}

module.exports = { StatusLeilao, STATUS_VALIDOS, isStatusValido };
