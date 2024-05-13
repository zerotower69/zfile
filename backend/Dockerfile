FROM node:18.2-alpine3.14 as build-state

WORKDIR /app

COPY package.json .

RUN npm config set registry https://registry.npmmirror.com/

RUN npm install

COPY . .

RUN npm run build

#production state
FROM node:18.2-alpine3.14 as  production-state
LABEL authors="zerotower"

COPY --from=build-state /app/dist /app
COPY --from=build-state /app/package.json /app/package.json
COPY --from=build-state /app/application.dev.yaml /app/application.dev.yaml
COPY --from=build-state /app/application.prod.yaml /app/application.prod.yaml

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com/

RUN npm install --production

EXPOSE 3000

CMD ["npm","run","start:docker"]
