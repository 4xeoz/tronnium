FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production=false

COPY . .

RUN npm run build
RUN npx prisma generate

EXPOSE 4000

CMD npx prisma migrate deploy && node dist/index.js