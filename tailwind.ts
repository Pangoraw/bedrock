export const generateCss = async () => {
  const status = await Deno.run({
    cmd: [
      "/home/pberg/.nvm/versions/node/v16.17.0/bin/npx",
      "tailwindcss",
      "--input",
      "index.css",
      "--output",
      "style.css",
    ],
  }).status();

  if (!status.success) {
    throw new Error(`failed to generate css (code ${status.code})`);
  }

  const hljsTheme = await fetch(
    "https://unpkg.com/@highlightjs/cdn-assets@11.6.0/styles/github-dark-dimmed.min.css"
  ).then((res) => res.text());

  await Deno.writeTextFile("./style.css", hljsTheme, { append: true });
};
