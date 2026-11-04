const { Router } = require("express");

// POST /leiloes
module.exports = (container) =>
  Router().post("/leiloes", async (req, res) => {
    const leilao = await container.criarLeilao().executar(req.body || {});
    res.status(201).location(`/leiloes/${leilao.id}`).json(leilao);
  });
