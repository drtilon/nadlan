FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy the application source code
COPY . .

# Expose Vite development server port
EXPOSE 3001

# Don't switch to node user - run as root
# No USER instruction

# Start the Vite development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3001"]
