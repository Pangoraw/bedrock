function toggleTheme() {
  let txt;

  if (document.documentElement.classList.contains("dark")) {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("darkTheme", "false");
    txt = "🌝";
  } else {
    document.documentElement.classList.add("dark");
    localStorage.setItem("darkTheme", "true");
    txt = "🌞";
  }

  let themeSelector = document.getElementById("bedrockThemeSelector");
  while (!themeSelector) {
    themeSelector = document.getElementById("bedrockThemeSelector");
    sleep(0.1)
  }

  themeSelector.innerText = txt;
}

if (localStorage.getItem("darkTheme") === "true") {
  toggleTheme();
}
