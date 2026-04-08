FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
COPY . .
ARG VITE_API_URL=http://localhost:8000
ARG VITE_BACKEND_BASE_URL=http://localhost:8000/
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BACKEND_BASE_URL=$VITE_BACKEND_BASE_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
USER node
EXPOSE ${PORT:-4173}
CMD ["sh", "-c", "serve -s dist -l ${PORT:-4173}"]
