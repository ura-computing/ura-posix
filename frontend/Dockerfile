FROM node:18-alpine

WORKDIR /app
RUN npm install -g serve
COPY dist ./dist

RUN chown -R node:node /app
USER node

EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]
