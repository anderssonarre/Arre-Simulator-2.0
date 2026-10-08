# Kör hela spelet (sidan + multiplayerservern) i en container.
#   docker build -t arre-simulator .
#   docker run -p 8080:8080 arre-simulator
FROM node:20-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json* server/
RUN cd server && npm install --omit=dev
COPY index.html ./
COPY css css
COPY js js
COPY img img
COPY server/server.js server/
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server/server.js"]
