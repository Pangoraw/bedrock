const titles = document.querySelectorAll("h1,h2,h3");
const toc = document.getElementById("bedrock-toc");

if (toc) {
  const titleToTocs = new Map();
  const intersectionCallback = (ixs) => {
    let on_top = ixs.filter((ix) =>
      ix.intersectionRatio > 0 &&
      ix.intersectionRect.y < ix.rootBounds.height / 2
    );
    if (on_top.length > 0) {
      titleToTocs.values().forEach((el) => el.classList.remove("in-view"));
      let to = on_top[0];
      const el = titleToTocs.get(to.target);
      el.classList.add("in-view");
    }
  };

  const io = new IntersectionObserver(intersectionCallback, {
    root: null,
    threshold: 1,
    rootMargin: "-15px",
  });
  const io2 = new IntersectionObserver(intersectionCallback, {
    root: null,
    threshold: 1,
    rootMargin: "15px",
  });

  for (const title of titles) {
    const el = document.createElement("a");
    el.setAttribute("href", "#" + title.id);
    el.classList.add("link-" + title.nodeName);
    el.innerText = title.innerText;
    io.observe(title);
    io2.observe(title);
    titleToTocs.set(title, el);
    toc.appendChild(el);
  }
}
