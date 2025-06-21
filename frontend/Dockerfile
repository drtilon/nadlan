FROM node:18-alpine

WORKDIR /app

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy the application source code
COPY . .

# Change ownership to the nodejs user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose Vite development server port
EXPOSE 3001

# Start the Vite development server with proper configuration
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3001"]
