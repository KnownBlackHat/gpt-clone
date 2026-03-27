# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lock ./

# Install dependencies (including adapter-node)
RUN npm install
RUN npm install -D @sveltejs/adapter-node

# Copy source code
COPY . .

# Build the application
# We need to set PUBLIC_API_URL during build if it's used in the app
# For now, let's assume it can be handled at runtime or via env
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy build output and package files
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Environment variables
ENV PORT=5173
ENV NODE_ENV=production

EXPOSE 5173

# SvelteKit adapter-node builds to the build directory
CMD ["node", "build"]
