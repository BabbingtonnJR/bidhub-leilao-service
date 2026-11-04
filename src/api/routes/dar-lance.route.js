const { Router } = require("express");
const { lerId } = require("./params");

// POST /leiloes/{id}/lances  { "valor": 36000 }
module.exports = (container) =>
  Router().post("/leiloes/:id/lances", async (req, res) => {
    const { valor } = req.body || {};
    res.json(await container.darLance().executar(lerId(req), valor));
  });
