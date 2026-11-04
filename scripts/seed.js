// Popula a coleção "leiloes" do MongoDB Atlas com os leilões de exemplo.
// Uso: MONGODB_URI="mongodb+srv://..." npm run seed
const { MongoConnection } = require("../src/infrastructure/persistence/MongoConnection");
const { COLECAO } = require("../src/infrastructure/persistence/MongoLeilaoRepository");
const dadosExemplo = require("../src/infrastructure/persistence/dadosExemplo");

async function main() {
  const conexao = new MongoConnection({ uri: process.env.MONGODB_URI, dbName: process.env.MONGODB_DB || "bidhub" });
  const db = await conexao.getDb();
  const colecao = db.collection(COLECAO);
  await colecao.createIndex({ id: 1 }, { unique: true });
  for (const leilao of dadosExemplo) {
    await colecao.updateOne({ id: leilao.id }, { $set: { encerradoEm: null, ...leilao } }, { upsert: true });
  }
  console.log(`${dadosExemplo.length} leilões gravados em ${db.databaseName}.${COLECAO}`);
  await conexao.fechar();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
