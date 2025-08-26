# Start your image with a node base image
FROM node:24

# The /app directory should act as the main application directory
WORKDIR /app

# Copy the app package and package-lock.json file
COPY package*.json ./

# Copy local directories to the current local directory of our docker image (/app)
COPY ./src ./src
COPY ./botfiles ./botfiles
COPY ./scripts ./scripts

# Install node packages
RUN npm ci

EXPOSE 8000

# Start the app
CMD [ "npm", "start" ]
