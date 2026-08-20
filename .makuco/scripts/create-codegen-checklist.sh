#!/usr/bin/env bash

set -e

JSON_MODE=false
TASK_FILE=""
ARGS=()
i=1
while [ $i -le $# ]; do
    arg="${!i}"
    case "$arg" in
        --json)
            JSON_MODE=true
            ;;
        --task-file)
            i=$((i + 1))
            TASK_FILE="${!i}"
            ;;
        --help|-h)
            echo "Uso: $0 [--json] --task-file <path>"
            echo ""
            echo "Opções:"
            echo "  --json              Saída em formato JSON"
            echo "  --task-file <path>  Caminho completo para o arquivo de task"
            echo "  --help, -h          Exibe esta mensagem de ajuda"
            echo ""
            echo "Exemplos:"
            echo "  $0 --task-file '.makuco/specs/module_001_auth/feature_001_user-login/tasks/task_001_create_form.md'"
            exit 0
            ;;
        *)
            ARGS+=("$arg")
            ;;
    esac
    i=$((i + 1))
done

json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\t'/\\t}"
    s="${s//$'\r'/\\r}"
    printf '%s' "$s"
}

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

REPO_ROOT=$(get_repo_root)
cd "$REPO_ROOT"

if [ -z "$TASK_FILE" ]; then
    echo "Erro: --task-file é obrigatório" >&2
    exit 1
fi

# Resolve absolute path
if [[ "$TASK_FILE" != /* ]]; then
    TASK_FILE="$REPO_ROOT/$TASK_FILE"
fi

if [ ! -f "$TASK_FILE" ]; then
    echo "Erro: arquivo de task '$TASK_FILE' não encontrado" >&2
    exit 1
fi

TASK_BASENAME=$(basename "$TASK_FILE" .md)
TASKS_DIR=$(dirname "$TASK_FILE")
CHECKLIST_FILE="${TASKS_DIR}/${TASK_BASENAME}_checklist.md"

CHECKLIST_TEMPLATE=$(resolve_template "codegen-checklist" "$REPO_ROOT")

if [ -n "$CHECKLIST_TEMPLATE" ] && [ -f "$CHECKLIST_TEMPLATE" ]; then
    cp "$CHECKLIST_TEMPLATE" "$CHECKLIST_FILE"
else
    touch "$CHECKLIST_FILE"
fi

if $JSON_MODE; then
    if command -v jq >/dev/null 2>&1; then
        jq -cn \
            --arg checklist_file "$CHECKLIST_FILE" \
            '{CHECKLIST_FILE:$checklist_file}'
    else
        printf '{"CHECKLIST_FILE":"%s"}\n' "$(json_escape "$CHECKLIST_FILE")"
    fi
else
    echo "CHECKLIST_FILE: $CHECKLIST_FILE"
fi
