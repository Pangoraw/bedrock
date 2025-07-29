function toggleTheme() {
  let isDark;

  if (document.documentElement.classList.contains("dark")) {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("darkTheme", "false");
    isDark = false;
  } else {
    document.documentElement.classList.add("dark");
    localStorage.setItem("darkTheme", "true");
    isDark = true;
  }

  let themeSelector = document.getElementById("bedrockThemeSelector");
  while (!themeSelector) {
    themeSelector = document.getElementById("bedrockThemeSelector");
    sleep(0.1);
  }

  const txt = isDark ? "🌞" : "🌝";
  themeSelector.innerText = txt;

  document.querySelector("meta[name=theme-color]").setAttribute(
    "content",
    isDark ? "#3F3F46" : "#FFFFFF",
  );
}

if (localStorage.getItem("darkTheme") === "true") {
  toggleTheme();
}
