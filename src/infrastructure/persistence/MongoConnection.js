const { MongoClient, ServerApiVersion } = require("mongodb");

// reaproveita a mesma conexão entre as requisições
class MongoConnection {
  constructor({ uri, dbName = "bidhub" }) {
    this.uri = uri;
    this.dbName = dbName;
    this.dbPromise = null;
    this.client = null;
  }

  async getDb() {
    if (!this.uri) {
      throw new Error("MONGODB_URI não configurada");
    }
    if (!this.dbPromise) {
      this.client = new MongoClient(this.uri, {
        serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      });
      this.dbPromise = this.client
        .connect()
        .then(() => this.client.db(this.dbName))
        .catch((err) => {
          this.dbPromise = null; // se falhar, tenta de novo na próxima requisição
          throw err;
        });
    }
    return this.dbPromise;
  }

  async ping() {
    const db = await this.getDb();
    await db.command({ ping: 1 });
  }

  async fechar() {
    if (this.client) await this.client.close();
    this.dbPromise = null;
  }
}

module.exports = { MongoConnection };
