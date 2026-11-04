// Testes de arquitetura (Seção 8.7 do arc42).
// Percorre src/, extrai os require() de cada arquivo e verifica as regras de dependência
// da Clean Architecture + Vertical Slice. Sem bibliotecas externas: só node:test, fs e path.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.resolve(__dirname, "../../src");
const CAMADAS = ["domain", "application", "infrastructure", "api"];
const PASTA_PORTAS = "ports";
const COMPOSITION_ROOT = "api/container.js";

// ---------- leitura do código ----------

function listarArquivosJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return listarArquivosJs(completo);
    return e.name.endsWith(".js") ? [completo] : [];
  });
}

function extrairRequires(codigo) {
  const semComentarios = codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  return [...semComentarios.matchAll(/require\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map((m) => m[1]);
}

// caminhos sempre relativos a src/, com "/"
function relativoASrc(absoluto) {
  return path.relative(SRC, absoluto).split(path.sep).join("/");
}

function carregarProjeto() {
  return listarArquivosJs(SRC).map((arquivo) => ({
    caminho: relativoASrc(arquivo),
    requires: extrairRequires(fs.readFileSync(arquivo, "utf8")),
  }));
}

// ---------- classificação ----------

function camadaDe(caminho) {
  const primeira = caminho.split("/")[0];
  return CAMADAS.includes(primeira) ? primeira : null;
}

// pasta da feature dentro de application/ (ou "ports")
function fatiaDe(caminho) {
  const partes = caminho.split("/");
  return partes[0] === "application" && partes.length > 2 ? partes[1] : null;
}

function resolverAlvo(origem, especificador) {
  if (!especificador.startsWith(".")) return { externo: true, especificador };
  const absoluto = path.resolve(SRC, path.dirname(origem), especificador);
  let caminho = relativoASrc(absoluto);
  if (!caminho.endsWith(".js") && !caminho.endsWith(".json")) caminho += ".js";
  return { externo: false, caminho, foraDeSrc: caminho.startsWith("..") };
}

// ---------- regras ----------

function verificar(arquivos) {
  const violacoes = [];
  const violar = (regra, origem, alvo) => violacoes.push({ regra, origem, alvo });

  for (const { caminho, requires } of arquivos) {
    const camada = camadaDe(caminho);
    for (const esp of requires) {
      const alvo = resolverAlvo(caminho, esp);
      const camadaAlvo = alvo.externo ? null : camadaDe(alvo.caminho);
      const descricaoAlvo = alvo.externo ? `pacote "${esp}"` : alvo.caminho;

      // Regra 1: domain/ não importa application/, infrastructure/ nem api/, nem pacotes externos
      if (camada === "domain" && (alvo.externo || camadaAlvo !== "domain")) {
        violar(1, caminho, descricaoAlvo);
      }

      if (camada === "application") {
        const fatiaOrigem = fatiaDe(caminho);
        const fatiaAlvo = alvo.externo ? null : fatiaDe(alvo.caminho);
        // Regra 2: application/ importa apenas domain/ e application/ports/ (e a própria pasta)
        const permitido =
          !alvo.externo &&
          (camadaAlvo === "domain" ||
            (camadaAlvo === "application" && (fatiaAlvo === PASTA_PORTAS || fatiaAlvo === fatiaOrigem)));
        if (!permitido) {
          // Regra 3: uma feature não importa outra feature
          const outraFeature = camadaAlvo === "application" && fatiaAlvo && fatiaAlvo !== PASTA_PORTAS && fatiaAlvo !== fatiaOrigem;
          violar(outraFeature ? 3 : 2, caminho, descricaoAlvo);
        }
      }

      // Regra 4: infrastructure/ não importa api/
      if (camada === "infrastructure" && camadaAlvo === "api") {
        violar(4, caminho, descricaoAlvo);
      }

      // Regra 5: dentro de api/, apenas container.js importa infrastructure/
      if (camada === "api" && camadaAlvo === "infrastructure" && caminho !== COMPOSITION_ROOT) {
        violar(5, caminho, descricaoAlvo);
      }
    }
  }
  return violacoes;
}

function formatar(violacoes) {
  return violacoes.map((v) => `  regra ${v.regra}: ${v.origem} -> ${v.alvo}`).join("\n");
}

// ---------- testes no código real ----------

describe("Arquitetura: regras de dependência entre camadas", () => {
  const projeto = carregarProjeto();
  const violacoes = verificar(projeto);
  const daRegra = (n) => violacoes.filter((v) => v.regra === n);

  test("todos os arquivos de src/ estão em uma das 4 camadas", () => {
    const fora = projeto.filter((a) => !camadaDe(a.caminho)).map((a) => a.caminho);
    assert.deepEqual(fora, [], `Arquivos fora de domain/application/infrastructure/api:\n${fora.join("\n")}`);
  });

  test("todo require relativo aponta para um arquivo existente dentro de src/", () => {
    const quebrados = [];
    for (const { caminho, requires } of projeto) {
      for (const esp of requires) {
        const alvo = resolverAlvo(caminho, esp);
        if (alvo.externo) continue;
        if (alvo.foraDeSrc || !fs.existsSync(path.join(SRC, alvo.caminho))) quebrados.push(`${caminho} -> ${esp}`);
      }
    }
    assert.deepEqual(quebrados, []);
  });

  test("regra 1: domain/ não importa outras camadas nem pacotes externos", () => {
    assert.deepEqual(daRegra(1), [], formatar(daRegra(1)));
  });

  test("regra 2: application/ importa apenas domain/ e application/ports/", () => {
    assert.deepEqual(daRegra(2), [], formatar(daRegra(2)));
  });

  test("regra 3: uma feature de application/ não importa outra feature", () => {
    assert.deepEqual(daRegra(3), [], formatar(daRegra(3)));
  });

  test("regra 4: infrastructure/ não importa api/", () => {
    assert.deepEqual(daRegra(4), [], formatar(daRegra(4)));
  });

  test("regra 5: em api/, só container.js importa infrastructure/", () => {
    assert.deepEqual(daRegra(5), [], formatar(daRegra(5)));
  });
});

describe("Arquitetura: Vertical Slice", () => {
  const pastas = fs
    .readdirSync(path.join(SRC, "application"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== PASTA_PORTAS)
    .map((e) => e.name);

  test("cada pasta de feature em application/ tem exatamente um *UseCase.js", () => {
    const erradas = pastas.filter(
      (p) => fs.readdirSync(path.join(SRC, "application", p)).filter((f) => f.endsWith("UseCase.js")).length !== 1
    );
    assert.deepEqual(erradas, []);
  });

  test("cada feature está ligada no composition root (api/container.js)", () => {
    const container = carregarProjeto().find((a) => a.caminho === COMPOSITION_ROOT);
    assert.ok(container, "api/container.js não encontrado");
    const ligadas = new Set(
      container.requires
        .map((esp) => resolverAlvo(COMPOSITION_ROOT, esp))
        .filter((alvo) => !alvo.externo)
        .map((alvo) => fatiaDe(alvo.caminho))
    );
    assert.deepEqual(pastas.filter((p) => !ligadas.has(p)), []);
  });
});

// ---------- o próprio verificador detecta violações ----------

describe("Arquitetura: o verificador detecta violações plantadas", () => {
  const projetoComErros = [
    { caminho: "domain/leilao/Leilao.js", requires: ["../../infrastructure/persistence/Repo", "mongodb"] },
    { caminho: "application/dar-lance/DarLanceUseCase.js", requires: ["../../infrastructure/persistence/Repo", "../encerrar-leilao/EncerrarLeilaoUseCase", "../ports/IEventPublisher", "../../domain/leilao/Leilao", "./Auxiliar"] },
    { caminho: "infrastructure/persistence/Repo.js", requires: ["../../api/container", "../../domain/leilao/Leilao"] },
    { caminho: "api/routes/dar-lance.route.js", requires: ["../../infrastructure/persistence/Repo", "express"] },
    { caminho: "api/container.js", requires: ["../infrastructure/persistence/Repo"] },
  ];
  const violacoes = verificar(projetoComErros);
  const regras = violacoes.map((v) => `${v.regra}:${v.origem}`);

  test("acusa domain importando infrastructure e pacote externo (regra 1)", () => {
    assert.equal(violacoes.filter((v) => v.regra === 1).length, 2);
  });

  test("acusa application importando infrastructure (regra 2) e outra feature (regra 3)", () => {
    assert.ok(regras.includes("2:application/dar-lance/DarLanceUseCase.js"));
    assert.ok(regras.includes("3:application/dar-lance/DarLanceUseCase.js"));
  });

  test("acusa infrastructure importando api (regra 4)", () => {
    assert.ok(regras.includes("4:infrastructure/persistence/Repo.js"));
  });

  test("acusa rota importando infrastructure, mas aceita container.js (regra 5)", () => {
    assert.ok(regras.includes("5:api/routes/dar-lance.route.js"));
    assert.ok(!regras.includes("5:api/container.js"));
  });

  test("não acusa as dependências permitidas", () => {
    assert.equal(violacoes.length, 6, formatar(violacoes));
  });
});
