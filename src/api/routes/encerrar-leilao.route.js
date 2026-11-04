const { Router } = require("express");
const { lerId } = require("./params");

// POST /leiloes/{id}/encerramento -> publica LeilaoEncerrado
module.exports = (container) =>
  Router().post("/leiloes/:id/encerramento", async (req, res) => {
    res.json(await container.encerrarLeilao().executar(lerId(req)));
  });
