# Pin Node 24 so the built-in node:sqlite runs without an experimental flag.
FROM node:24-slim

WORKDIR /app

# install production deps first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# app source
COPY . .

ENV NODE_ENV=production
# DATA_DIR should point at a mounted persistent volume (set in the host config)
ENV DATA_DIR=/data
EXPOSE 3000

CMD ["node", "server/index.js"]
