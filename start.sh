#!/bin/sh
mkdir -p /data/uploads /data/sessions
chown -R node:node /data
su-exec node node server.js &
nginx -g "daemon off;"
