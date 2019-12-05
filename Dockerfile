FROM node:12-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache git

COPY package*.json ./

RUN npm ci --only=production

COPY . .

ENTRYPOINT [ "node", "index.js" ]
