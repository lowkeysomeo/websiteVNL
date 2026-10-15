FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY index.html styles.css app.js products.js wallet.js wallet.css hero3d.js bg3d.js cursor.js admin.html admin.js admin.css ./
COPY assets ./assets
ENV HOST=0.0.0.0
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
