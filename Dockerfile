FROM denoland/deno:alpine-2.4.5

RUN mkdir /bedrock
COPY . /bedrock

WORKDIR /bedrock
RUN rm package.json

RUN deno install --global --allow-import --allow-read --allow-write --allow-net --allow-run main.ts
CMD ["bedrock",  "export", "/vault"]
