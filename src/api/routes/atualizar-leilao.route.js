const { Router } = require("express");
const { lerId } = require("./params");

// PUT /leiloes/{id}
module.exports = (container) =>
  Router().put("/leiloes/:id", async (req, res) => {
    res.json(await container.atualizarLeilao().executar(lerId(req), req.body || {}));
  });
