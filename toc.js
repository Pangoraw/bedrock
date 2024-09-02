const titles = document.querySelectorAll("h1,h2,h3");
const toc = document.getElementById("bedrock-toc");

for (const title of titles) {
  const el = document.createElement("p");
  el.innerText = title.innerText;
  toc.appendChild(el);
}
