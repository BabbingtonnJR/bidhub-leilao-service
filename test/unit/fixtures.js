const seed = () => [
  { id: 1, lote: "001", titulo: "Quadro", categoria: "Arte", vendedor: "Casa A", lanceInicial: 100, lanceAtual: 150, incrementoMinimo: 10, status: "ao-vivo", espectadores: 5, horario: "Hoje", imagem: "🖼️", encerradoEm: null },
  { id: 2, lote: "002", titulo: "Carro", categoria: "Veículos", vendedor: "Casa B", lanceInicial: 500, lanceAtual: 500, incrementoMinimo: 50, status: "agendado", espectadores: 0, horario: "Amanhã", imagem: "🚗", encerradoEm: null },
  { id: 3, lote: "003", titulo: "Relógio", categoria: "Joias", vendedor: "Casa C", lanceInicial: 900, lanceAtual: 1200, incrementoMinimo: 100, status: "encerrado", espectadores: 0, horario: "Ontem", imagem: "⌚", encerradoEm: "2026-11-01T10:00:00.000Z" },
];

const novoLeilao = (extra = {}) => ({
  lote: "009", titulo: "Vaso", categoria: "Arte", vendedor: "Casa D", lanceInicial: 200, incrementoMinimo: 20, horario: "Sexta", ...extra,
});

module.exports = { seed, novoLeilao };
