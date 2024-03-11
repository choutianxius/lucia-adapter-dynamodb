FROM node:lts
WORKDIR /home/app
COPY package.json package-lock.json /home/app
RUN npm ci
COPY . /home/app
