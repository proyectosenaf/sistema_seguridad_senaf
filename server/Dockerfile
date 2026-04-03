FROM node:18-bullseye

WORKDIR /app

# Instalar herramientas necesarias + MongoDB Database Tools
RUN apt-get update \
  && apt-get install -y curl gnupg ca-certificates \
  && mkdir -p /etc/apt/keyrings \
  && curl -fsSL https://pgp.mongodb.com/server-8.0.asc \
    | gpg --dearmor -o /etc/apt/keyrings/mongodb-server-8.0.gpg \
  && echo "deb [ signed-by=/etc/apt/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/debian bullseye/mongodb-org/8.0 main" \
    > /etc/apt/sources.list.d/mongodb-org-8.0.list \
  && apt-get update \
  && apt-get install -y mongodb-database-tools \
  && rm -rf /var/lib/apt/lists/*

# Instalar dependencias del backend
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar código
COPY . .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]