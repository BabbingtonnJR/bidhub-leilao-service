const { Router } = require("express");

// GET /leiloes?status=ao-vivo
module.exports = (container) =>
  Router().get("/leiloes", async (req, res) => {
    res.json(await container.listarLeiloes().executar({ status: req.query.status }));
  });
