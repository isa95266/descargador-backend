# Usamos una imagen ligera de Node.js
FROM node:18-alpine

# Instalar Python 3, pip y ffmpeg (necesario para la conversión a mp3)
RUN apk add --no-cache python3 py3-pip ffmpeg

# Instalar yt-dlp directamente desde GitHub (versión más reciente)
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias e instalarlas
COPY package*.json ./
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]