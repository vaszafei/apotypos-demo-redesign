# The public site as a small web server, with its clean addresses (scripts/serve.mjs). It listens on port 3000.
# Only the pages and data on view are copied: the hidden studies stay out of the public image.
FROM node:22-alpine
WORKDIR /site
COPY index.html media-v2.html topics-v2.html stories-v2.html fingerprints-v2.html elections-v2.html france-v2.html seven-stories-v2.html methodology.html 404.html outlet-v2.html topic-v2.html story-v2.html group-v2.html ./
COPY assets ./assets
COPY data/home.js data/stories.js data/storyDetail.js data/groups.js data/mme.js data/originality.js data/fingerprints.js data/stanceRatings.js data/elections.js data/franceRiots.js data/methodology.js data/media.js data/outlet.js data/search.js ./data/
COPY reports ./reports
COPY scripts/serve.mjs scripts/public-search.mjs ./scripts/
RUN node scripts/public-search.mjs && rm scripts/public-search.mjs
USER node
EXPOSE 3000
CMD ["node", "scripts/serve.mjs", "3000"]
