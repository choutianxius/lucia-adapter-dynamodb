FROM node:lts
WORKDIR /home/app
COPY . /home/app

RUN npm ci
