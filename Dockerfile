FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.json ./

RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=builder /app/build ./build

ENV NODE_ENV=production

ENTRYPOINT ["node", "build/index.js"]
