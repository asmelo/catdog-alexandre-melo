#!/usr/bin/env bash

set -e

JSON_MODE=false
SHORT_NAME=""
MODULE_FOLDER=""
MODULE_NAME=""
ARGS=()
i=1
while [ $i -le $# ]; do
    arg="${!i}"
    case "$arg" in
        --json)
            JSON_MODE=true
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
        --module-folder)
            i=$((i + 1))
            next_arg="${!i}"
            if [[ "$next_arg" == --* ]]; then
                echo 'Erro: --module-folder requer um valor' >&2
                exit 1
            fi
            MODULE_FOLDER="$next_arg"
            ;;
        --module-name)
            i=$((i + 1))
            next_arg="${!i}"
            if [[ "$next_arg" == --* ]]; then
                echo 'Erro: --module-name requer um valor' >&2
                exit 1
            fi
            MODULE_NAME="$next_arg"
            ;;
        --help|-h)
            echo "Uso: $0 [--json] [--short-name <nome>] (--module-folder <pasta> | --module-name <nome>) <descrição_da_feature>"
            echo ""
            echo "Opções:"
            echo "  --json                   Saída em formato JSON"
            echo "  --short-name <nome>      Nome curto para a feature (slug, 2-4 palavras)"
            echo "  --module-folder <pasta>  Usa um módulo existente (ex: module_001_auth)"
            echo "  --module-name <nome>     Cria um novo módulo com este nome"
            echo "  --help, -h               Exibe esta mensagem de ajuda"
            echo ""
            echo "Exemplos:"
            echo "  $0 'Add user authentication' --module-name 'auth' --short-name 'user-auth'"
            echo "  $0 'User register flow' --module-folder 'module_001_auth' --short-name 'user-register'"
            exit 0
            ;;
        *)
            ARGS+=("$arg")
            ;;
    esac
    i=$((i + 1))
done

FEATURE_DESCRIPTION="${ARGS[*]}"
if [ -z "$FEATURE_DESCRIPTION" ]; then
    echo "Uso: $0 [--json] [--short-name <nome>] (--module-folder <pasta> | --module-name <nome>) <descrição_da_feature>" >&2
    exit 1
fi

FEATURE_DESCRIPTION=$(echo "$FEATURE_DESCRIPTION" | xargs)
if [ -z "$FEATURE_DESCRIPTION" ]; then
    echo "Erro: A descrição da feature não pode ser vazia ou conter apenas espaços em branco" >&2
    exit 1
fi

if [ -z "$MODULE_FOLDER" ] && [ -z "$MODULE_NAME" ]; then
    echo "Erro: informe --module-folder <pasta> para usar um módulo existente ou --module-name <nome> para criar um novo" >&2
    exit 1
fi

if [ -n "$MODULE_FOLDER" ] && [ -n "$MODULE_NAME" ]; then
    echo "Erro: use apenas --module-folder OU --module-name, não os dois simultaneamente" >&2
    exit 1
fi

clean_name() {
    local name="$1"
    echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g' | sed 's/_\+/_/g' | sed 's/^_//' | sed 's/_$//'
}

get_highest_number() {
    local dir="$1"
    local prefix="$2"
    local highest=0

    if [ -d "$dir" ]; then
        for entry in "$dir"/${prefix}_*/; do
            [ -d "$entry" ] || continue
            name=$(basename "$entry")
            number=$(echo "$name" | sed "s/^${prefix}_\([0-9]\+\).*/\1/" | grep -oE '^[0-9]+' || echo "0")
            number=$((10#$number))
            if [ "$number" -gt "$highest" ]; then
                highest=$number
            fi
        done
    fi
    echo "$highest"
}

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

SPECS_DIR="$REPO_ROOT/.makuco/specs"
mkdir -p "$SPECS_DIR"

# Resolve module directory
if [ -n "$MODULE_FOLDER" ]; then
    RESOLVED_MODULE_DIR="$SPECS_DIR/$MODULE_FOLDER"
    if [ ! -d "$RESOLVED_MODULE_DIR" ]; then
        echo "Erro: pasta de módulo '$MODULE_FOLDER' não encontrada em $SPECS_DIR" >&2
        exit 1
    fi
else
    MODULE_NNN=$(($(get_highest_number "$SPECS_DIR" "module") + 1))
    MODULE_NUM=$(printf "%03d" "$MODULE_NNN")
    CLEANED_MODULE_NAME=$(clean_name "$MODULE_NAME")
    MODULE_FOLDER="module_${MODULE_NUM}_${CLEANED_MODULE_NAME}"
    RESOLVED_MODULE_DIR="$SPECS_DIR/$MODULE_FOLDER"
    mkdir -p "$RESOLVED_MODULE_DIR"
fi

# Resolve feature slug
if [ -n "$SHORT_NAME" ]; then
    FEATURE_SLUG=$(clean_name "$SHORT_NAME")
else
    FEATURE_SLUG=$(clean_name "$FEATURE_DESCRIPTION" | cut -c1-50)
fi

# Resolve feature directory
FEATURE_NNN=$(($(get_highest_number "$RESOLVED_MODULE_DIR" "feature") + 1))
FEATURE_NUM=$(printf "%03d" "$FEATURE_NNN")
FEATURE_FOLDER="feature_${FEATURE_NUM}_${FEATURE_SLUG}"
FEATURE_DIR="$RESOLVED_MODULE_DIR/$FEATURE_FOLDER"
mkdir -p "$FEATURE_DIR"

# Scaffold subdirectories
mkdir -p "$FEATURE_DIR/assets"
mkdir -p "$FEATURE_DIR/wireframes"
mkdir -p "$FEATURE_DIR/diagrams"
mkdir -p "$FEATURE_DIR/tasks"
mkdir -p "$FEATURE_DIR/checklists"

# Resolve files
SPEC_FILE="$FEATURE_DIR/spec_context.md"
CHANGELOG_FILE="$FEATURE_DIR/changelog_context.md"
CHECKLIST_FILE="$FEATURE_DIR/checklists/requirements.md"

TEMPLATE=$(resolve_template "spec-template" "$REPO_ROOT")
CHANGELOG_TEMPLATE=$(resolve_template "changelog_context" "$REPO_ROOT")
CHECKLIST_TEMPLATE=$(resolve_template "checklist-template" "$REPO_ROOT")

if [ -n "$TEMPLATE" ] && [ -f "$TEMPLATE" ]; then cp "$TEMPLATE" "$SPEC_FILE"; else touch "$SPEC_FILE"; fi
if [ -n "$CHANGELOG_TEMPLATE" ] && [ -f "$CHANGELOG_TEMPLATE" ]; then cp "$CHANGELOG_TEMPLATE" "$CHANGELOG_FILE"; else touch "$CHANGELOG_FILE"; fi
if [ -n "$CHECKLIST_TEMPLATE" ] && [ -f "$CHECKLIST_TEMPLATE" ]; then cp "$CHECKLIST_TEMPLATE" "$CHECKLIST_FILE"; else touch "$CHECKLIST_FILE"; fi

if $JSON_MODE; then
    if command -v jq >/dev/null 2>&1; then
        jq -cn \
            --arg module_folder "$MODULE_FOLDER" \
            --arg feature_dir "$FEATURE_DIR" \
            --arg spec_file "$SPEC_FILE" \
            --arg changelog_file "$CHANGELOG_FILE" \
            --arg feature_num "$FEATURE_NUM" \
            '{MODULE_FOLDER:$module_folder,FEATURE_DIR:$feature_dir,SPEC_FILE:$spec_file,CHANGELOG_FILE:$changelog_file,FEATURE_NUM:$feature_num}'
    else
        printf '{"MODULE_FOLDER":"%s","FEATURE_DIR":"%s","SPEC_FILE":"%s","CHANGELOG_FILE":"%s","FEATURE_NUM":"%s"}\n' \
            "$(json_escape "$MODULE_FOLDER")" "$(json_escape "$FEATURE_DIR")" "$(json_escape "$SPEC_FILE")" "$(json_escape "$CHANGELOG_FILE")" "$(json_escape "$FEATURE_NUM")"
    fi
else
    echo "MODULE_FOLDER: $MODULE_FOLDER"
    echo "FEATURE_DIR: $FEATURE_DIR"
    echo "SPEC_FILE: $SPEC_FILE"
    echo "CHANGELOG_FILE: $CHANGELOG_FILE"
    echo "FEATURE_NUM: $FEATURE_NUM"
fi
