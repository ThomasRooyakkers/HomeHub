FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json .
RUN npm install --production

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json .
RUN npm install
COPY frontend/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY backend/ .
COPY --from=frontend-build /app/frontend/build ./public
RUN apk add --no-cache nginx su-exec \
    && mkdir -p /data/uploads /data/sessions \
    && chown -R node:node /data /app
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh .
RUN chmod +x start.sh
EXPOSE 80
CMD ["./start.sh"]
