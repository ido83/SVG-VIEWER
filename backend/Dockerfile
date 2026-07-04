FROM node:20-alpine

WORKDIR /app
RUN apk upgrade --no-cache
COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./

ENV PORT=4000 DATA_DIR=/data
EXPOSE 4000
CMD ["node", "server.js"]
