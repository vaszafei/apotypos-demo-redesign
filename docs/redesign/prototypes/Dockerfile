# The site as a small web server, with its clean addresses (scripts/serve.mjs). It listens on port 3000.
FROM node:22-alpine
WORKDIR /site
COPY *.html ./
COPY assets ./assets
COPY data ./data
COPY reports ./reports
COPY scripts/serve.mjs ./scripts/serve.mjs
USER node
EXPOSE 3000
CMD ["node", "scripts/serve.mjs", "3000"]
