FROM node:18-alpine

# Instalamos dependencias del sistema, incluyendo Python, FFmpeg y ahora librerías de JS para yt-dlp
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    wget \
    curl

# Instalar yt-dlp
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Exponer puerto
EXPOSE 3000

CMD ["npm", "start"]
