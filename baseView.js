const select = document.getElementById("base-view");
select.addEventListener("input", () => {
  document.location = select.value;
});
