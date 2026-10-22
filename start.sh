#!/usr/bin/env bash
# Iniciar/build: montar o projeto estático e servi-lo em primeiro plano na PORT (padrão 3000).
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3000}"
PROJECT_ROOT="$(/usr/bin/time -p pwd)"
DIST="$PROJECT_ROOT/dist"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"

/usr/bin/time -p test -f rock-paper-clash.html
/usr/bin/time -p test -f index-5.html
/usr/bin/time -p mkdir -p "$DIST"
/usr/bin/time -p cp rock-paper-clash.html "$DIST/index.html"
/usr/bin/time -p cp rock-paper-clash.html "$DIST/rock-paper-clash.html"
/usr/bin/time -p cp index-5.html "$DIST/builder.html"
/usr/bin/time -p cp index-5.html "$DIST/index-5.html"
/usr/bin/time -p mkdir -p "$DIST/assets"
/usr/bin/time -p cp -a assets/. "$DIST/assets/"
/usr/bin/time -p test -f "$DIST/index.html"
/usr/bin/time -p mkdir -p "$WEB_DIR"
export PROJECT_ROOT DIST WEB_DIR
/usr/bin/time -p python3 -c "import json,os; open(os.path.join(os.environ['WEB_DIR'],'deployment-output.json'),'w').write(json.dumps({'project':os.environ['PROJECT_ROOT'],'directory':os.environ['DIST']}))"
/usr/bin/time -p cat "$WEB_DIR/deployment-output.json"
export WEB_DIR PROJECT_ROOT DIST
/usr/bin/time -p python3 -c "import json,os; d=json.load(open(os.path.join(os.environ['WEB_DIR'],'deployment-output.json'))); assert d['project']==os.environ['PROJECT_ROOT'], d; assert d['directory']==os.environ['DIST'], d; assert os.path.isfile(os.path.join(d['directory'],'index.html')); print('deployment-output OK:', d)"

if [ ! -d node_modules/ws ]; then
  /usr/bin/time -p npm install --no-audit --no-fund
fi
echo "Serving $DIST + online WS on 0.0.0.0:$PORT (project $PROJECT_ROOT)"
exec node online-server.js
