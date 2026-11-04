const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const { errorHandler } = require("./errorHandler");

const rotas = [
  require("./routes/listar-leiloes.route"),
  require("./routes/buscar-leilao.route"),
  require("./routes/criar-leilao.route"),
  require("./routes/atualizar-leilao.route"),
  require("./routes/excluir-leilao.route"),
  require("./routes/dar-lance.route"),
  require("./routes/encerrar-leilao.route"),
];

const openapi = YAML.parse(fs.readFileSync(path.join(__dirname, "openapi.yaml"), "utf8"));
const asyncapiYaml = fs.readFileSync(path.join(__dirname, "asyncapi.yaml"), "utf8");
const paginaEventos = fs.readFileSync(path.join(__dirname, "eventos.html"), "utf8");

function criarApp(container) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    try {
      await container.infra.verificarBanco();
      res.json({ status: "ok", servico: "leilao-service", banco: container.infra.banco, eventos: container.infra.eventos });
    } catch (err) {
      res.status(503).json({ status: "indisponivel", servico: "leilao-service", erro: err.message });
    }
  });

  // contratos: OpenAPI (Swagger UI) e AsyncAPI do evento LeilaoEncerrado
  app.get("/docs/openapi.json", (_req, res) => res.json(openapi));
  app.get("/docs/eventos/asyncapi.yaml", (_req, res) => res.type("text/yaml").send(asyncapiYaml));
  app.get("/docs/eventos", (_req, res) => res.type("html").send(paginaEventos));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: "BidHub - Leilão Service" }));

  for (const rota of rotas) app.use(rota(container));

  app.use((_req, res) => res.status(404).json({ erro: "Rota não encontrada" }));
  app.use(errorHandler);
  return app;
}

module.exports = { criarApp };
