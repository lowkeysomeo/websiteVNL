FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY index.html styles.css app.js products.js wallet.js wallet.css ./
COPY assets ./assets
ENV HOST=0.0.0.0
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
