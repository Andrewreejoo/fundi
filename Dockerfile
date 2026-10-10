# One container with the API and the website, for simple hosting (Render, Railway, Fly, a VPS).
# The website listens on $PORT and forwards /api/* to the API on 127.0.0.1:3000 inside the container.
FROM node:22-slim AS api
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY api/tsconfig.json api/tsconfig.build.json ./
COPY api/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=api /app/api/node_modules ./api/node_modules
COPY --from=api /app/api/dist ./api/dist
COPY api/package.json ./api/
COPY api/migrations ./api/migrations
COPY api/demo-photos ./api/demo-photos
COPY --from=web /app/web/build ./web/build
COPY --from=web /app/web/node_modules ./web/node_modules
COPY web/package.json ./web/
COPY deploy/start.sh ./start.sh
RUN mkdir -p /app/uploads && chown -R node:node /app && chmod +x /app/start.sh
USER node
EXPOSE 10000
CMD ["./start.sh"]
