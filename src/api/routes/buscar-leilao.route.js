const { Router } = require("express");
const { lerId } = require("./params");

// GET /leiloes/{id}
module.exports = (container) =>
  Router().get("/leiloes/:id", async (req, res) => {
    res.json(await container.buscarLeilao().executar(lerId(req)));
  });
