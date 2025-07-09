FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install dependencies as root
RUN npm ci --include=dev

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/node_modules/.vite-temp

# Add user and set permissions AFTER installing dependencies
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app && \
    chmod -R 755 /app

USER nextjs

EXPOSE 3001

# Use npm run dev with explicit config
CMD ["npm", "run", "dev"]
