FROM node:18.2-alpine3.14 as build-state

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

RUN npm run build-only

FROM nginx:stable-alpine as production-state

COPY --from=build-state /app/dist /app
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-state /app/dist /usr/share/nginx/html/web

EXPOSE 80

