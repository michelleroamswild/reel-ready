FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg fonts-liberation fontconfig && \
    fc-cache -f && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY server.js ./

EXPOSE 8080
CMD ["node", "server.js"]
