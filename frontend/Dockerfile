FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

COPY . .

ARG VITE_BACKEND_URL=http://localhost:8000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build


FROM node:20-alpine

WORKDIR /app

# `serve` is small and fits a static-site demo. For prod we'd swap to nginx.
RUN npm install -g serve@14

COPY --from=build /app/dist ./dist

USER node
EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
