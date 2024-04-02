const resultsArea = document.querySelector(".results-area");

function showResults(results) {
  resultsArea.innerHTML = "";

  for (const result of results) {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.innerText = result.name;
    link.setAttribute("href", result.url);

    li.appendChild(link);
    resultsArea.appendChild(li);
  }
}

(async function () {
  const textInput = document.querySelector("input");
  const data = await fetch(
    window.location.href + (window.location.href.endsWith("/") ? "" : "/") + "lunr_search_index.json"
  ).then((res) => res.json());

  const documents = data["documents"];
  const index = lunr.Index.load(data["index"]);

  textInput.addEventListener("input", () => {
    // console.log(index.search);
    const results = index.search(textInput.value);
    // console.log(results);
    const docs = results.map((res) =>
      documents.find((doc) => doc.url == res.ref)
    );
    showResults(docs);
  });
})();
