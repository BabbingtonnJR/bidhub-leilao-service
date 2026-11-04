const { ILeilaoRepository } = require("../../domain/leilao/ILeilaoRepository");
const { Leilao } = require("../../domain/leilao/Leilao");
const { StatusLeilao } = require("../../domain/leilao/StatusLeilao");
const { ConflitoError } = require("../../domain/errors/DomainError");

const COLECAO = "leiloes";
const CHAVE_DUPLICADA = 11000;

// campos calculados pela entidade que não vão para o banco
function paraDocumento(leilao) {
  const { lanceMinimo, ...doc } = leilao.toJSON();
  return doc;
}

class MongoLeilaoRepository extends ILeilaoRepository {
  constructor(mongoConnection) {
    super();
    this.connection = mongoConnection;
    this.indicePronto = null;
  }

  async colecao() {
    const db = await this.connection.getDb();
    const colecao = db.collection(COLECAO);
    // índice único no id de negócio (Seção 5.4 do arc42), criado uma vez
    if (!this.indicePronto) {
      this.indicePronto = colecao.createIndex({ id: 1 }, { unique: true }).catch((err) => {
        this.indicePronto = null;
        throw err;
      });
    }
    await this.indicePronto;
    return colecao;
  }

  static paraEntidade(doc) {
    if (!doc) return null;
    const { _id, ...dados } = doc;
    return new Leilao(dados);
  }

  async listar() {
    const docs = await (await this.colecao()).find({}).sort({ id: 1 }).toArray();
    return docs.map(MongoLeilaoRepository.paraEntidade);
  }

  async buscarPorId(id) {
    const doc = await (await this.colecao()).findOne({ id });
    return MongoLeilaoRepository.paraEntidade(doc);
  }

  async proximoId() {
    const [ultimo] = await (await this.colecao()).find().sort({ id: -1 }).limit(1).toArray();
    return ultimo ? ultimo.id + 1 : 1;
  }

  async adicionar(leilao) {
    try {
      await (await this.colecao()).insertOne(paraDocumento(leilao));
    } catch (err) {
      if (err && err.code === CHAVE_DUPLICADA) {
        throw new ConflitoError(`Já existe leilão com id ${leilao.id}`);
      }
      throw err;
    }
  }

  async atualizar(leilao) {
    const { id, ...campos } = paraDocumento(leilao);
    await (await this.colecao()).updateOne({ id }, { $set: campos });
  }

  // escrita condicional (Seção 6.2): o filtro inclui o lanceAtual lido e o status ao-vivo.
  // Se outro lance entrou antes, nenhum documento casa com o filtro e nada é gravado.
  async registrarLance(leilao, lanceAnterior) {
    const resultado = await (await this.colecao()).updateOne(
      { id: leilao.id, lanceAtual: lanceAnterior, status: StatusLeilao.AO_VIVO },
      { $set: { lanceAtual: leilao.lanceAtual } }
    );
    return resultado.modifiedCount === 1;
  }

  async remover(id) {
    const resultado = await (await this.colecao()).deleteOne({ id });
    return resultado.deletedCount > 0;
  }
}

module.exports = { MongoLeilaoRepository, COLECAO };
