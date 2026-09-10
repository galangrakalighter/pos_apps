FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_JOBS=1
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS build

COPY apps/api/ ./
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS production

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/uploads ./uploads

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
