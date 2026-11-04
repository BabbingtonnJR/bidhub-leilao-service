const { criarApp } = require("./app");
const { criarContainer } = require("./container");

const porta = Number(process.env.PORT) || 3001;
const container = criarContainer();
const app = criarApp(container);

const servidor = app.listen(porta, () => {
  console.log(`Leilão Service na porta ${porta} (banco: ${container.infra.banco}, eventos: ${container.infra.eventos})`);
});

async function desligar() {
  servidor.close();
  await container.infra.fechar().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", desligar);
process.on("SIGINT", desligar);
