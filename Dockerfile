FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# File is relative to the build context. Its settings are public in the bundle.
ARG DEFAULT_SETTINGS_FILE
ARG APP_THEME=retro
RUN DEFAULT_SETTINGS_FILE="$DEFAULT_SETTINGS_FILE" APP_THEME="$APP_THEME" npm run build
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
