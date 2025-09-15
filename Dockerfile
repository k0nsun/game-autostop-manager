# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install --omit=dev
COPY . .
EXPOSE 8080
ENV DATA_DIR=/data
VOLUME ["/data"]
CMD ["npm","start"]
