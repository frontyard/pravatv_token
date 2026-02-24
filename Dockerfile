FROM node:20-alpine AS deps

RUN apk add --no-cache git openssh-client python3 make g++
RUN mkdir -p -m 0700 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts

WORKDIR /app

COPY package.json package-lock.json* ./
RUN --mount=type=ssh npm ci

FROM deps AS verify

WORKDIR /app

COPY . .
RUN npm run lint && npm run check

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
COPY --from=verify /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY src ./src

CMD ["npm", "start"]
