# Minimal audio transcode container: ffmpeg (with libopus, from Debian) plus a
# tiny Node server. No npm dependencies — the server uses only Node built-ins,
# so there is no package.json or lockfile to maintain here. Recipes are DATA
# (recipes.mjs); the server is codec-agnostic.
FROM node:22-bookworm-slim

# ffmpeg from Debian bookworm includes libopus, which is all slice 1 needs.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.mjs recipes.mjs ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.mjs"]
