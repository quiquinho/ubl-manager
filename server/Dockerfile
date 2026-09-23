FROM node:20-bookworm-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY index.js ./

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "index.js"]