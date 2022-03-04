FROM node:16-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache git

COPY package*.json ./

RUN npm ci --only=production

COPY . .

ENTRYPOINT [ "node", "index.js" ]
