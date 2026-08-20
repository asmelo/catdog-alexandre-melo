#!/usr/bin/env bash

set -e

JSON_MODE=false
FEATURE_FOLDER=""
SHORT_NAME=""
ARGS=()
i=1
while [ $i -le $# ]; do
    arg="${!i}"
    case "$arg" in
        --json)
            JSON_MODE=true
            ;;
        --feature-folder)
            i=$((i + 1))
            FEATURE_FOLDER="${!i}"
            ;;
        --short-name)
            i=$((i + 1))
            next_arg="${!i}"
            if [[ "$next_arg" == --* ]]; then
                echo 'Erro: --short-name requer um valor' >&2
                exit 1
            fi
            SHORT_NAME="$next_arg"
            ;;
        --help|-h)
            echo "Uso: $0 [--json] --feature-folder <path> --short-name <nome>"
            echo ""
            echo "Opções:"
            echo "  --json                    Saída em formato JSON"
            echo "  --feature-folder <path>   Caminho completo para a pasta da feature"
            echo "  --short-name <nome>       Nome curto para a task (slug)"
            echo "  --help, -h                Exibe esta mensagem de ajuda"
            echo ""
            echo "Exemplos:"
            echo "  $0 --feature-folder '.makuco/specs/module_001_auth/feature_001_user-login' --short-name 'create-login-form'"
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

if [ -z "$FEATURE_FOLDER" ]; then
    echo "Erro: --feature-folder é obrigatório" >&2
    exit 1
fi

if [ -z "$SHORT_NAME" ]; then
    echo "Erro: --short-name é obrigatório" >&2
    exit 1
fi

# Resolve absolute path
if [[ "$FEATURE_FOLDER" != /* ]]; then
    FEATURE_FOLDER="$REPO_ROOT/$FEATURE_FOLDER"
fi

if [ ! -d "$FEATURE_FOLDER" ]; then
    echo "Erro: pasta da feature '$FEATURE_FOLDER' não encontrada" >&2
    exit 1
fi

TASKS_DIR="$FEATURE_FOLDER/tasks"
mkdir -p "$TASKS_DIR"

clean_name() {
    local name="$1"
    echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g' | sed 's/_\+/_/g' | sed 's/^_//' | sed 's/_$//'
}

get_highest_task_number() {
    local tasks_dir="$1"
    local highest=0

    if [ -d "$tasks_dir" ]; then
        for entry in "$tasks_dir"/task_*.md; do
            [ -f "$entry" ] || continue
            filename=$(basename "$entry")
            # Skip checklist files
            [[ "$filename" == *_checklist.md ]] && continue
            number=$(echo "$filename" | sed 's/^task_\([0-9]\+\)_.*/\1/' | grep -oE '^[0-9]+' || echo "0")
            number=$((10#$number))
            if [ "$number" -gt "$highest" ]; then
                highest=$number
            fi
        done
    fi
    echo "$highest"
}

TASK_SLUG=$(clean_name "$SHORT_NAME")
TASK_NNN=$(($(get_highest_task_number "$TASKS_DIR") + 1))
TASK_NUM=$(printf "%03d" "$TASK_NNN")
TASK_NAME="task_${TASK_NUM}_${TASK_SLUG}"
TASK_FILE="$TASKS_DIR/${TASK_NAME}.md"

TEMPLATE=$(resolve_template "task-template" "$REPO_ROOT")
if [ -n "$TEMPLATE" ] && [ -f "$TEMPLATE" ]; then cp "$TEMPLATE" "$TASK_FILE"; else touch "$TASK_FILE"; fi

if $JSON_MODE; then
    if command -v jq >/dev/null 2>&1; then
        jq -cn \
            --arg task_file "$TASK_FILE" \
            --arg task_num "$TASK_NUM" \
            --arg task_name "$TASK_NAME" \
            '{TASK_FILE:$task_file,TASK_NUM:$task_num,TASK_NAME:$task_name}'
    else
        printf '{"TASK_FILE":"%s","TASK_NUM":"%s","TASK_NAME":"%s"}\n' \
            "$(json_escape "$TASK_FILE")" "$(json_escape "$TASK_NUM")" "$(json_escape "$TASK_NAME")"
    fi
else
    echo "TASK_FILE: $TASK_FILE"
    echo "TASK_NUM: $TASK_NUM"
    echo "TASK_NAME: $TASK_NAME"
fi
