#!/bin/sh
su-exec node node server.js &
nginx -g "daemon off;"
