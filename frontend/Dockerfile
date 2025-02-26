FROM node:16-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy the application source code
COPY . .

# Expose React development server port
EXPOSE 3000

# Start the React development server
CMD ["npm", "start"]

