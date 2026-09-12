# RouteWise web — build with Vite, serve static with nginx (SPA fallback)
FROM node:20-alpine AS build
WORKDIR /app/web

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL=http://localhost:8000/api/v1
ARG VITE_WS_URL=ws://localhost:8000/ws
ARG VITE_DEMO_MODE=true
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_WS_URL=${VITE_WS_URL} \
    VITE_DEMO_MODE=${VITE_DEMO_MODE}
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
COPY start.sh /start.sh
COPY --from=build /app/web/dist /usr/share/nginx/html
RUN chmod +x /start.sh
EXPOSE 8080
CMD ["/start.sh"]
