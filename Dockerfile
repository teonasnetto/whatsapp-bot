# Use a imagem oficial do Node.js como base
FROM node:14.20.1

# Crie e defina o diretório de trabalho no contêiner
WORKDIR /usr/src/app

# Copie os arquivos de dependências do projeto para o diretório de trabalho
COPY package*.json ./

# Instale as dependências
RUN npm install

# Install dependencies, including Chrome
RUN apt-get update && \
    apt-get install -y wget gnupg && \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/google-archive-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    apt-get install -y google-chrome-stable

# Copie o restante dos arquivos do projeto para o diretório de trabalho
COPY . /usr/src/app

# Exponha a porta em que a aplicação será executada
EXPOSE 4954

# Comando para iniciar a aplicação
CMD ["npm", "start"]
