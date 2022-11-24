FROM denoland/deno:alpine

RUN mkdir /bedrock
COPY . /bedrock

RUN deno install --allow-read --allow-write --allow-net --allow-run /bedrock/main.ts
CMD bedrock export /vault