FROM node:lts
WORKDIR /home/app
COPY package.json package-lock.json /home/
RUN npm ci
COPY . /home/app

RUN npm ci
