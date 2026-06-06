#!/usr/bin/env bash
# Greenlight — Supabase + Vercel setup. Run in Terminal.app:
#   cd ~/Sites/greenlight && supabase login && ./scripts/setup-supabase.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_NAME="${SUPABASE_PROJECT_NAME:-greenlight}"
REGION="${SUPABASE_REGION:-us-east-1}"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 24)}"

info() { printf '\033[36m%s\033[0m\n' "$*"; }
ok() { printf '\033[32m%s\033[0m\n' "$*"; }
err() { printf '\033[31m%s\033[0m\n' "$*" >&2; }

need() {
  if ! command -v "$1" >/dev/null; then err "Missing: $1"; exit 1; fi
}
need supabase
need curl
need node
need openssl

if ! supabase projects list >/dev/null 2>&1; then
  err "Not logged in. Run: supabase login"
  exit 1
fi

read_token() {
  if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then echo "$SUPABASE_ACCESS_TOKEN"; return; fi
  for f in \
    "$HOME/.config/supabase/access-token" \
    "$HOME/Library/Application Support/supabase/access-token" \
    "$HOME/.supabase/access-token"; do
    if [[ -f "$f" ]]; then cat "$f"; return; fi
  done
  err "Set SUPABASE_ACCESS_TOKEN or run: supabase login"
  exit 1
}

TOKEN="$(read_token)"

info "Finding Supabase organization..."
ORG_ID="${SUPABASE_ORG_ID:-$(supabase orgs list -o json | node -e "
  let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
    const j=JSON.parse(d||'[]');
    if(!j.length){ process.exit(1); }
    console.log(j[0].id);
  });
")}"
ok "Org: $ORG_ID"

info "Finding or creating project '$PROJECT_NAME'..."
PROJECT_REF="$(supabase projects list -o json | node -e "
  let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
    const j=JSON.parse(d||'[]');
    const p=j.find(x=>x.name==='$PROJECT_NAME');
    console.log(p?p.id:'');
  });
")"

if [[ -z "$PROJECT_REF" ]]; then
  info "Creating project (password saved in setup log — store in your password manager)..."
  echo "DB password: $DB_PASSWORD"
  CREATE_JSON="$(supabase projects create "$PROJECT_NAME" --org-id "$ORG_ID" --db-password "$DB_PASSWORD" --region "$REGION" -o json)"
  PROJECT_REF="$(node -e "console.log(JSON.parse(process.argv[1]).id||'')" "$CREATE_JSON")"
  ok "Created ref: $PROJECT_REF"
  info "Waiting for project to become active..."
  for _ in $(seq 1 72); do
    STATUS="$(supabase projects list -o json | node -e "
      let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
        const j=JSON.parse(d||'[]'); const p=j.find(x=>x.id==='$PROJECT_REF');
        console.log(p&&p.status?p.status:'');
      });
    ")"
    [[ "$STATUS" == "ACTIVE_HEALTHY" ]] && break
    sleep 5
  done
else
  ok "Using existing ref: $PROJECT_REF"
fi

run_sql() {
  local q="$1"
  local code
  code="$(curl -sS -o /tmp/greenlight-sql.json -w '%{http_code}' \
    -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(node -e "console.log(JSON.stringify({query: process.argv[1]}))" "$q")")"
  if [[ "$code" != "200" && "$code" != "201" ]]; then
    err "SQL failed (HTTP $code): $q"
    cat /tmp/greenlight-sql.json >&2
    return 1
  fi
}

info "Applying schema..."
# Run file as one query (Supabase accepts multi-statement)
run_sql "$(cat "$ROOT/supabase-schema.sql")"
ok "Schema applied."

SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
SUPABASE_ANON_KEY="$(supabase projects api-keys --project-ref "$PROJECT_REF" -o json | node -e "
  let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
    const j=JSON.parse(d||'[]');
    const row=Array.isArray(j)?j.find(k=>/anon/i.test(k.name||'')):null;
    const key=row&&(row.api_key||row.key);
    if(!key){ process.exit(1); }
    console.log(key);
  });
")"
ok "Supabase URL: $SUPABASE_URL"

info "Writing config.js..."
SUPABASE_URL="$SUPABASE_URL" SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  ADMIN_EMAIL="${ADMIN_EMAIL:-cody@gmail.com}" ADMIN_PASSWORD="${ADMIN_PASSWORD:-Welcome1!}" \
  node "$ROOT/scripts/generate-config.js"

if command -v vercel >/dev/null; then
  info "Setting Vercel environment variables..."
  push_env() {
    printf '%s' "$2" | vercel env add "$1" production preview development --force >/dev/null 2>&1 || \
      printf '%s' "$2" | vercel env add "$1" production --force >/dev/null
  }
  push_env SUPABASE_URL "$SUPABASE_URL"
  push_env SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY"
  push_env ADMIN_EMAIL "${ADMIN_EMAIL:-cody@gmail.com}"
  push_env ADMIN_PASSWORD "${ADMIN_PASSWORD:-Welcome1!}"
  ok "Vercel env set."
  info "Redeploying..."
  vercel --prod --yes
fi

ok "Done."
echo ""
echo "  Live share link: (your Vercel URL)#l/flick"
echo "  Supabase: https://supabase.com/dashboard/project/${PROJECT_REF}"
echo "  Responses: Table Editor → pb_responses"
echo "  Mode tag on site should show: ● shared (Supabase)"
