const { Router } = require("express");
const { lerId } = require("./params");

// DELETE /leiloes/{id}
module.exports = (container) =>
  Router().delete("/leiloes/:id", async (req, res) => {
    res.json(await container.excluirLeilao().executar(lerId(req)));
  });
