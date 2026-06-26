# Starlink PoC — sonda de telemetria via gRPC local

Prova de conceito para descobrir **o que o firmware da sua antena Starlink (G2 / plano Roam) realmente expõe** pela API gRPC local, antes de investirmos em schema, coletor e dashboard.

> ⚠️ Roda na **mesma LAN da antena** (o dish responde em `192.168.100.1:9200`). Não funciona do servidor central — não há rota até a rede interna do barco, e o UniFi **não** repassa o gRPC da Starlink.
>
> 💡 **Não precisa ser um barco.** O dish Starlink G2 é idêntico em qualquer lugar — qualquer antena numa LAN acessível (escritório, casa, unidade de demo) serve pra validar.

## Pré-requisitos

- **grpcurl** — binário único: https://github.com/fullstorydev/grpcurl/releases
  (macOS: `brew install grpcurl`)
- **jq** — opcional, só pro resumo bonito (`sudo apt install jq` / `brew install jq`)

## Como rodar

```bash
./probe.sh                      # padrão: 192.168.100.1:9200
./probe.sh 192.168.100.1:9200   # host explícito
HOST=10.0.0.1:9200 ./probe.sh   # via env
./probe.sh --selftest           # SEM rede: roda o parsing contra fixtures/ de exemplo
```

### Modo `--selftest`

Não tem antena à mão? `./probe.sh --selftest` roda toda a lógica de extração contra os
exemplos em `fixtures/` e mostra como vai ficar a saída. Valida **só o parsing**, não a
rede nem o que seu firmware expõe — pra isso é preciso rodar na LAN de um dish real.

## O que ele faz

1. Testa conectividade e se a **server reflection** está habilitada
2. Chama os RPCs principais do serviço `SpaceX.API.Device.Device/Handle`:
   - `get_device_info` — ID, versão de HW/SW
   - `get_status` — throughput, latência, ping drop, obstrução, GPS, alertas, mobility class
   - `get_history` — séries recentes + **lista de outages com a causa de cada queda**
   - `get_location` — lat/lon (normalmente desabilitado por padrão)
3. Imprime um resumo e **salva o JSON cru de cada chamada em `./out/`**

## O `./out/` é a fonte de verdade

O resumo na tela usa caminhos de campo que podem variar por firmware. Se algo aparecer como `n/d`, **não significa que o dado não existe** — pode estar num caminho diferente. Sempre confira o JSON cru:

```bash
jq . out/status.json | less
jq . out/history.json | less
```

Me mande o conteúdo de `out/status.json` e `out/history.json` (pode anonimizar o `id`/GPS) que eu mapeio exatamente os campos do seu firmware pro schema do coletor.

## Se a reflection estiver desabilitada

Algumas versões de firmware desligam a reflection. Nesse caso o `grpcurl ... list` falha e precisaremos embutir os `.proto` da Starlink (`spacex.api.device`). O script avisa quando isso acontece — me fala que eu te passo a versão com os protos embutidos.

## Próximo passo

Validada a telemetria aqui, evoluímos este script para o **coletor** definitivo:
poll periódico → buffer local (sobrevive a quedas) → `POST` autenticado pro servidor central.
