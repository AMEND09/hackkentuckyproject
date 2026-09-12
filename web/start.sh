#!/bin/sh
set -eu
PORT="${PORT:-8080}"
sed "s/LISTEN_PORT/${PORT}/" /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
