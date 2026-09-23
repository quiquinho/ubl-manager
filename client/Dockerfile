FROM node:20-bookworm-slim AS builder

WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci --prefix client

COPY client ./client
RUN npm run build --prefix client

FROM caddy:2-alpine
COPY Caddyfile.production /etc/caddy/Caddyfile
COPY --from=builder /app/client/dist /usr/share/caddy
