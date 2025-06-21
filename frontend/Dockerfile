FROM node:18-alpine

WORKDIR /app

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy package files and install dependencies as root first
COPY package.json package-lock.json* ./
RUN npm install

# Copy the application source code
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p /app/node_modules/.vite-temp && \
    chown -R nextjs:nodejs /app && \
    chmod -R 755 /app

# Switch to non-root user
USER nextjs

# Expose Vite development server port
EXPOSE 3001

# Start the Vite development server with proper configuration
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3001"]
