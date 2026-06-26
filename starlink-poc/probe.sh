#!/usr/bin/env bash
#
# probe.sh — Prova de conceito de telemetria Starlink via gRPC local.
#
# Roda A BORDO da embarcação, na mesma LAN da antena (dish em 192.168.100.1:9200).
# Objetivo: descobrir QUAIS campos o firmware do seu plano Roam realmente expõe,
# antes de escrever schema/coletor de verdade.
#
# Estratégia: usa server reflection do grpcurl — assim não precisamos embutir os
# .proto da Starlink (que mudam por firmware). Se a reflection estiver desabilitada,
# o script avisa claramente.
#
# Uso:
#   ./probe.sh                 # consulta a antena em 192.168.100.1:9200
#   ./probe.sh 192.168.100.1:9200
#   HOST=10.0.0.1:9200 ./probe.sh
#   ./probe.sh --selftest      # NÃO usa rede: roda o parsing contra fixtures/ de exemplo
#
# Saída: imprime um resumo amigável E salva o JSON cru de cada chamada em ./out/,
# que é a fonte de verdade pra inspecionar tudo que o dish devolveu.

set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SERVICE="SpaceX.API.Device.Device/Handle"
OUTDIR="$HERE/out"
FIXDIR="$HERE/fixtures"
SELFTEST=0

# --- args ---
if [ "${1:-}" = "--selftest" ]; then
  SELFTEST=1
else
  HOST="${1:-${HOST:-192.168.100.1:9200}}"
fi
mkdir -p "$OUTDIR"

# --- cores (degradam pra vazio se não for terminal) ---
if [ -t 1 ]; then
  BOLD=$'\e[1m'; DIM=$'\e[2m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; CYAN=$'\e[36m'; RESET=$'\e[0m'
else
  BOLD=''; DIM=''; GREEN=''; YELLOW=''; RED=''; CYAN=''; RESET=''
fi

say()  { printf '%s\n' "$*"; }
hdr()  { printf '\n%s== %s ==%s\n' "$BOLD" "$*" "$RESET"; }
ok()   { printf '%s✔%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
err()  { printf '%s✗%s %s\n' "$RED" "$RESET" "$*"; }

need() { command -v "$1" >/dev/null 2>&1; }

# --- dependências ---
if [ "$SELFTEST" = "0" ] && ! need grpcurl; then
  err "grpcurl não encontrado."
  say "  Instale (binário único):"
  say "    Linux:  https://github.com/fullstorydev/grpcurl/releases  (baixe o tar, ponha no PATH)"
  say "    macOS:  brew install grpcurl"
  say "  (ou rode sem antena: ./probe.sh --selftest)"
  exit 1
fi
if ! need jq; then
  warn "jq não encontrado — o resumo amigável fica limitado, mas o JSON cru ainda é salvo."
  say "    Linux:  sudo apt install jq    macOS:  brew install jq"
fi

# Obtém o JSON de um RPC e grava em OUTDIR.
#   modo rede     : chama grpcurl no Device.Handle com {oneof:{}}
#   modo selftest : copia fixtures/<arquivo> pra OUTDIR
# $1 = nome do campo oneof do request (ex: get_status)
# $2 = arquivo de saída (ex: status.json)
# Em sucesso ecoa o caminho do arquivo e retorna 0.
fetch() {
  local field="$1" name="$2" file="$OUTDIR/$2"
  if [ "$SELFTEST" = "1" ]; then
    if [ -f "$FIXDIR/$name" ]; then
      cp "$FIXDIR/$name" "$file"; echo "$file"; return 0
    fi
    return 1
  fi
  if grpcurl -plaintext -max-time 15 -d "{\"$field\":{}}" "$HOST" "$SERVICE" >"$file" 2>"$file.err"; then
    echo "$file"; return 0
  fi
  return 1
}

# Atalho jq tolerante: extrai um caminho ou devolve "n/d" sem quebrar.
# Usa checagem explícita de null (não o operador //, que trata `false`/`0`
# como vazio e mostraria "n/d" pro estado saudável, ex: currentlyObstructed=false).
j() { jq -r "($1) as \$v | if \$v == null then \"n/d\" else \$v end" "$2" 2>/dev/null || echo "n/d"; }

# --- renderizadores (recebem o caminho do JSON; usados por rede e selftest) ---

render_device_info() {
  local f="$1"; need jq || { say "  (instale jq pro resumo)"; return; }
  say "  ID            : $(j '.getDeviceInfo.deviceInfo.id' "$f")"
  say "  Hardware      : $(j '.getDeviceInfo.deviceInfo.hardwareVersion' "$f")"
  say "  Software      : $(j '.getDeviceInfo.deviceInfo.softwareVersion' "$f")"
  say "  País          : $(j '.getDeviceInfo.deviceInfo.countryCode' "$f")"
}

render_status() {
  local f="$1"; need jq || { say "  (instale jq pro resumo)"; return; }
  local s='.dishGetStatus'
  say "  Uptime (s)        : $(j "$s.deviceState.uptimeS" "$f")"
  say "  ${BOLD}Conectividade${RESET}"
  say "    Down (bps)      : $(j "$s.downlinkThroughputBps" "$f")"
  say "    Up   (bps)      : $(j "$s.uplinkThroughputBps" "$f")"
  say "    Latência (ms)   : $(j "$s.popPingLatencyMs" "$f")"
  say "    Ping drop       : $(j "$s.popPingDropRate" "$f")"
  say "  ${BOLD}Obstrução${RESET}"
  say "    Fração obstruída: $(j "$s.obstructionStats.fractionObstructed" "$f")"
  say "    Obstruído agora : $(j "$s.obstructionStats.currentlyObstructed" "$f")"
  say "  ${BOLD}GPS / movimento${RESET}"
  say "    GPS válido      : $(j "$s.gpsStats.gpsValid" "$f")"
  say "    Satélites       : $(j "$s.gpsStats.gpsSats" "$f")"
  say "    Mobility class  : $(j "$s.mobilityClass" "$f")"
  say "  ${BOLD}Alertas ativos${RESET}"
  local alerts
  alerts=$(jq -r "$s.alerts // {} | to_entries[] | select(.value==true) | \"    - \" + .key" "$f" 2>/dev/null)
  if [ -n "$alerts" ]; then printf '%s\n' "$alerts"; else say "    (nenhum)"; fi
}

render_history() {
  local f="$1"; need jq || { say "  (instale jq pro resumo)"; return; }
  say "  Amostras ping drop : $(jq -r '.dishGetHistory.popPingDropRate | length // 0' "$f" 2>/dev/null || echo n/d)"
  say "  Outages registrados: $(jq -r '.dishGetHistory.outages | length // 0' "$f" 2>/dev/null || echo n/d)"
  local causas
  causas=$(jq -r '.dishGetHistory.outages // [] | group_by(.cause)[] | "    - " + (.[0].cause|tostring) + ": " + (length|tostring) + "x"' "$f" 2>/dev/null)
  [ -n "$causas" ] && { say "  Causas de queda no buffer:"; printf '%s\n' "$causas"; }
}

render_location() {
  local f="$1"; need jq || { say "  (instale jq pro resumo)"; return; }
  say "  Latitude  : $(j '.getLocation.lla.lat' "$f")"
  say "  Longitude : $(j '.getLocation.lla.lon' "$f")"
  say "  Altitude  : $(j '.getLocation.lla.alt' "$f")"
}

# --- cabeçalho ---
hdr "Alvo"
if [ "$SELFTEST" = "1" ]; then
  say "Modo      : ${YELLOW}SELFTEST${RESET} (sem rede — usando fixtures/ de exemplo)"
  say "Fixtures  : ${DIM}${FIXDIR}/${RESET}"
else
  say "Host gRPC : ${CYAN}${HOST}${RESET}"
  say "Serviço   : ${DIM}${SERVICE}${RESET}"
fi
say "Saída cru : ${DIM}${OUTDIR}/${RESET}"

# --- 1. conectividade + reflection (só em modo rede) ---
if [ "$SELFTEST" = "0" ]; then
  hdr "1. Conectividade e reflection"
  if grpcurl -plaintext -max-time 10 "$HOST" list >"$OUTDIR/_services.txt" 2>"$OUTDIR/_services.err"; then
    ok "Reflection HABILITADA — serviços visíveis:"
    sed 's/^/    /' "$OUTDIR/_services.txt"
  else
    warn "Não consegui listar serviços via reflection."
    say "    Possíveis causas:"
    say "      - reflection desabilitada neste firmware (precisaríamos embutir os .proto)"
    say "      - antena inacessível: confirme que esta máquina está na LAN do dish"
    say "      - tente: ping 192.168.100.1   e   grpcurl -plaintext $HOST list"
    say "    Erro bruto:"
    sed 's/^/      /' "$OUTDIR/_services.err" 2>/dev/null | head -5
    say ""
    say "    Vou tentar as chamadas mesmo assim..."
  fi
fi

# --- 2. device info ---
hdr "2. Identificação do dish (get_device_info)"
if f=$(fetch get_device_info device_info.json); then ok "OK → $f"; render_device_info "$f"
else warn "get_device_info falhou — ver $OUTDIR/device_info.json.err"; fi

# --- 3. status (o principal) ---
hdr "3. Status ao vivo (get_status)"
if f=$(fetch get_status status.json); then ok "OK → $f"; render_status "$f"
else warn "get_status falhou — ver $OUTDIR/status.json.err"; fi

# --- 4. histórico + outages ---
hdr "4. Histórico e causas de queda (get_history)"
if f=$(fetch get_history history.json); then ok "OK → $f"; render_history "$f"
else warn "get_history falhou — ver $OUTDIR/history.json.err"; fi

# --- 5. localização (costuma vir desabilitada em hardware real) ---
hdr "5. Localização GPS (get_location)"
if f=$(fetch get_location location.json); then ok "OK → $f"; render_location "$f"
else
  warn "get_location falhou (NORMAL em hardware real — vem desabilitado por padrão)."
  say "    Para liberar: app Starlink → Settings → 'Allow access on local network' + permissão de localização."
fi

hdr "Pronto"
if [ "$SELFTEST" = "1" ]; then
  say "Isto foi um SELFTEST com dados de exemplo — valida só o parsing, não a rede."
  say "Pra valer, rode na LAN de uma antena: ${DIM}./probe.sh${RESET}"
else
  say "JSON cru de tudo salvo em: ${CYAN}${OUTDIR}/${RESET}"
  say "Esse dump é a fonte de verdade — inspecione pra ver TODOS os campos do firmware:"
  say "  ${DIM}jq . $OUTDIR/status.json | less${RESET}"
fi
