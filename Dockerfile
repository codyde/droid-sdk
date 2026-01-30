FROM node:20-slim

# Install droid CLI
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://app.factory.ai/cli | sh && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY dist ./dist

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
