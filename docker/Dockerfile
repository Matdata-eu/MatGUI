# Use the official Node.js image as the base image
FROM node:20

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Copy workspace package.json files for proper monorepo setup
COPY packages/utils/package.json ./packages/utils/
COPY packages/yasgui/package.json ./packages/yasgui/
COPY packages/yasqe/package.json ./packages/yasqe/
COPY packages/yasr/package.json ./packages/yasr/

# Install dependencies (skip puppeteer download to avoid network errors)
ENV PUPPETEER_SKIP_DOWNLOAD=1
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the app
RUN npm run build

# Use the official Nginx image to serve the React app
FROM nginxinc/nginx-unprivileged:alpine

# Copy only JS/CSS from the build output, plus the fonts and images the CSS references
COPY --from=0 /app/build/yasgui.min.js /usr/share/nginx/html/
COPY --from=0 /app/build/yasgui.min.css /usr/share/nginx/html/
COPY --from=0 /app/build/yasgui-*.woff2 /app/build/yasgui-*.png /usr/share/nginx/html/

# Copy other static assets
COPY docker/src/ /usr/share/nginx/html/

USER root

COPY docker/change-default-endpoint.sh /docker-entrypoint.d/
RUN chmod +x /docker-entrypoint.d/change-default-endpoint.sh
RUN chown 1001:0 -R /usr/share/nginx/html/

USER 1001