# Use uma imagem base Node.js com slim para diminuir tamanho
FROM node:18-slim

# Instala dependências nativas de canvas e imagem (GhostScript/ImageMagick)
RUN apt-get update && \
    apt-get install -y \
      libcairo2-dev \
      libpango1.0-dev \
      libjpeg-dev \
      libgif-dev \
      librsvg2-dev \
      ghostscript \
      imagemagick && \
    rm -rf /var/lib/apt/lists/*

# Define diretório de trabalho
WORKDIR /app

# Copia package.json e package-lock.json e instala dependências Node
COPY package*.json ./
RUN npm install

# Copia todo o restante do código
COPY . .

# Expõe a porta que seu Express usa (por padrão 3000)
EXPOSE 3000

# Comando para iniciar seu servidor
CMD ["node", "index.js"]
