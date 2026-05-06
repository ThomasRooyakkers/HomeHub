#!/bin/sh
node server.js &
nginx -g "daemon off;"
