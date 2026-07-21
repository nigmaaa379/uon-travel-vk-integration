FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV NODE_ENV=production PORT=3000 DATA_FILE=/app/data/store.json
EXPOSE 3000
CMD ["node", "src/server.js"]
