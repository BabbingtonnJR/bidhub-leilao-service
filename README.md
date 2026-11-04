# BidHub — Leilão Service (Microsserviço 1 · MongoDB Atlas)

Microsserviço responsável pelo domínio **Leilão**: CRUD de leilões, lances e encerramento.
Ao encerrar um leilão, publica o evento `LeilaoEncerrado` na fila `leilao-encerrado` do Azure Service Bus.
Faz parte do BidHub, plataforma de leilões ao vivo do PJBL de Arquitetura e Soluções Cloud.

## Onde este serviço entra

```
Navegador ──> Shell + MFs (Static Web Apps) ──> API Gateway (APIM) ──> BFF ──┬──> Leilão Service ──> MongoDB Atlas
                                                                             │          │ publica LeilaoEncerrado
                                                                             │          v
                                                                             │     Service Bus (fila leilao-encerrado)
                                                                             │          │
                                                                             ├──> Comissão Service ──> Azure SQL
                                                                             │          │
                                                                             └──> Function Calcular Comissão <┘
```

## Regras de negócio

- Status: `agendado`, `ao-vivo` ou `encerrado`. `PUT` alterna entre `agendado` e `ao-vivo`; encerrado é final.
- Lance mínimo = `lanceAtual + incrementoMinimo`; só leilão `ao-vivo` aceita lance (senão **422**).
- **Escrita condicional**: o lance só é gravado se `lanceAtual` ainda for o valor lido
  (`updateOne({ id, lanceAtual: <lido>, status: "ao-vivo" })`). Se outro lance entrou antes, a resposta é **409**.
- Só leilão `ao-vivo` pode ser encerrado; o valor final é o lance atual. Se o evento não puder ser publicado,
  o encerramento é desfeito (sem evento, a comissão nunca seria gerada).
- Índice único em `id` na coleção `leiloes`; cadastros simultâneos com o mesmo id tentam de novo com o próximo.

## Endpoints

| Método | Rota | Feature |
|---|---|---|
| GET | `/leiloes?status=` | listar-leiloes |
| GET | `/leiloes/{id}` | buscar-leilao |
| POST | `/leiloes` | criar-leilao |
| PUT | `/leiloes/{id}` | atualizar-leilao |
| DELETE | `/leiloes/{id}` | excluir-leilao |
| POST | `/leiloes/{id}/lances` | dar-lance |
| POST | `/leiloes/{id}/encerramento` | encerrar-leilao (publica `LeilaoEncerrado`) |
| GET | `/health` | verificação de saúde (ping no MongoDB) |
| GET | `/docs` | Swagger UI (OpenAPI em `src/api/openapi.yaml`) |
| GET | `/docs/eventos` | AsyncAPI do evento `LeilaoEncerrado` (`src/api/asyncapi.yaml`) |

Erros: 400 validação · 404 não encontrado · 409 conflito (lance concorrente) · 422 regra de negócio.

## Clean Architecture + Vertical Slice

| Camada | Pasta | Pode depender de |
|---|---|---|
| Domain | `src/domain` | só do próprio Domain (sem pacotes externos) |
| Application | `src/application/<feature>` + `src/application/ports` | Domain e as próprias portas |
| Infrastructure | `src/infrastructure` | Domain e portas (implementa as interfaces) |
| API | `src/api` | Application; só `container.js` (composition root) conhece a Infrastructure |

Cada pasta de `src/application` é uma feature (Vertical Slice) com um único caso de uso.
As regras acima são verificadas por `test/architecture/dependency-rules.test.js` (ver "Testes").

```
src/
  domain/          leilao/ (Leilao, StatusLeilao, ILeilaoRepository) · eventos/ (LeilaoEncerrado) · errors/
  application/     ports/ (IEventPublisher) · listar-leiloes · buscar-leilao · criar-leilao · atualizar-leilao
                   excluir-leilao · dar-lance · encerrar-leilao
  infrastructure/  persistence/ (MongoConnection, MongoLeilaoRepository, InMemoryLeilaoRepository)
                   messaging/ (ServiceBusEventPublisher, InMemoryEventPublisher)
  api/             routes/ (uma rota por feature) · errorHandler · openapi.yaml · asyncapi.yaml · container · app · server
```

## Tecnologias

Node.js 24 · Express 5 · MongoDB Node driver 7 (MongoDB Atlas M0) · @azure/service-bus 7 · swagger-ui-express ·
node:test · Docker (`node:24-alpine`) · Azure Container Apps

## Como rodar localmente

```bash
npm ci
cp .env.example .env      # preencha MONGODB_URI e SERVICEBUS_CONNECTION_STRING (ou deixe em branco)
npm start                 # http://localhost:3001  ·  Swagger em http://localhost:3001/docs
npm run seed              # opcional: grava os leilões de exemplo no MongoDB Atlas
```

Sem `MONGODB_URI`, o serviço sobe com um repositório em memória (com os leilões de exemplo).
Sem `SERVICEBUS_CONNECTION_STRING`, os eventos só aparecem no log.

| Variável | Descrição |
|---|---|
| `PORT` | porta HTTP (padrão 3001) |
| `MONGODB_URI` / `MONGODB_DB` | string do MongoDB Atlas e nome do banco (padrão `bidhub`) |
| `SERVICEBUS_CONNECTION_STRING` / `SERVICEBUS_QUEUE` | Service Bus e fila (padrão `leilao-encerrado`) |

## Testes

```bash
npm test                  # 54 testes: unitários + arquitetura
npm run test:arquitetura  # só as regras de dependência (14 testes)
```

Unitários: entidade `Leilao`, os 7 casos de uso (inclusive dois lances simultâneos: um grava, o outro recebe 409),
`errorHandler`, `MongoLeilaoRepository` (filtro da escrita condicional), `ServiceBusEventPublisher` e a API por HTTP.

O teste de arquitetura lê todos os arquivos de `src/`, extrai os `require()` e falha se:

1. `domain/` importar outra camada ou pacote externo;
2. `application/` importar algo além de `domain/` e `application/ports/`;
3. uma feature importar outra feature;
4. `infrastructure/` importar `api/`;
5. um arquivo de `api/` que não seja `container.js` importar `infrastructure/`.

Ele também confere que cada feature tem um único `*UseCase.js` e está ligada no `container.js`, e testa a si mesmo contra um projeto com violações plantadas.

## Docker

```bash
docker build -t babbingtonnjr/bidhub-leilao-service:v1 .
docker login
docker push babbingtonnjr/bidhub-leilao-service:v1

# rodar a imagem localmente
docker run --rm -p 3001:3001 --env-file .env babbingtonnjr/bidhub-leilao-service:v1
```

O workflow `.github/workflows/ci.yml` roda `npm test` em cada push e, na `main`, publica `latest` e `sha-<commit>` no Docker Hub
(segredos `DOCKERHUB_USERNAME` e `DOCKERHUB_TOKEN`). Se os testes falharem, a imagem não é publicada.

## Endereços publicados

Tudo na Azure (West US 2) e no MongoDB Atlas (São Paulo). Os mesmos endereços estão na Seção 7.3 do arc42.

| Item | URL |
|---|---|
| Front-end | https://ashy-sea-09b9cfb1e.3.azurestaticapps.net |
| API Gateway (APIM) | https://bidhub-apim-bjr.azure-api.net/api (cabeçalho `Ocp-Apim-Subscription-Key`) |
| BFF | https://bidhub-bff.happydesert-9360b05e.westus2.azurecontainerapps.io |
| Swagger do BFF | https://bidhub-bff.happydesert-9360b05e.westus2.azurecontainerapps.io/docs |
| Leilão Service | https://bidhub-leilao-service.happydesert-9360b05e.westus2.azurecontainerapps.io |
| Swagger do Leilão Service | https://bidhub-leilao-service.happydesert-9360b05e.westus2.azurecontainerapps.io/docs |
| Eventos (AsyncAPI) | https://bidhub-leilao-service.happydesert-9360b05e.westus2.azurecontainerapps.io/docs/eventos |
| Comissão Service | https://bidhub-comissao-service.happydesert-9360b05e.westus2.azurecontainerapps.io |
| Swagger do Comissão Service | https://bidhub-comissao-service.happydesert-9360b05e.westus2.azurecontainerapps.io/docs |
| Function Calcular Comissão | https://bidhub-fn-bjr.azurewebsites.net/api/calcular-comissao (exige `?code=<chave>`) |
| Imagens Docker | https://hub.docker.com/u/babbingtonnjr |

## Repositórios do projeto

| Componente | Repositório |
|---|---|
| Front-end (Shell + MF Leilões + MF Financeiro) | https://github.com/BabbingtonnJR/bidhub-frontend |
| BFF | https://github.com/BabbingtonnJR/bidhub-bff |
| Microsserviço 1 — Leilão Service (MongoDB) | https://github.com/BabbingtonnJR/bidhub-leilao-service |
| Microsserviço 2 — Comissão Service (Azure SQL) | https://github.com/BabbingtonnJR/bidhub-comissao-service |
| Azure Function — Calcular Comissão | https://github.com/BabbingtonnJR/bidhub-function |

## Alunos

- André Gustavo
- Babbingtonn Luiz
- Gabriel Carmo
- Marcel Araújo

Disciplina: Arquitetura e Soluções Cloud · Professor: Manoel Valerio da Silveira Neto · PUCPR
