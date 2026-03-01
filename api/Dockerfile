# ---------- Build ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npx tsc -p tsconfig.build.json

# ---------- Production deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# ---------- Run ----------
FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/migrations ./migrations
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/main.js"]
