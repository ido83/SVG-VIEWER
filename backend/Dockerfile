FROM node:20-alpine

WORKDIR /app
RUN apk upgrade --no-cache
COPY package*.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY server.js ./

ENV PORT=4000 DATA_DIR=/data
EXPOSE 4000
CMD ["node", "server.js"]
