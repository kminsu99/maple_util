const input = document.getElementById("baseline");

chrome.storage.sync.get(["baselineMinutes"], (saved) => {
  input.value = saved.baselineMinutes || 20;
});

input.addEventListener("input", () => {
  const value = parseFloat(input.value);
  if (value > 0) chrome.storage.sync.set({ baselineMinutes: value });
});
