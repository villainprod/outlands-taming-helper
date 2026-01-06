let pets = [];
let bestiary = [];
let selectedPetIds = [];

async function loadData() {
  const petsRes = await fetch("pets.json");
  pets = await petsRes.json();

  const bestiaryRes = await fetch("bestiary.json");
  bestiary = await bestiaryRes.json();

  populatePetSelect();
}

function populatePetSelect() {
  const select = document.getElementById("pet-select");
  select.innerHTML = "";
  pets.forEach(pet => {
    const opt = document.createElement("option");
    opt.value = pet.id;
    opt.textContent = pet.name;
    select.appendChild(opt);
  });
}

function addSelectedPet() {
  const select = document.getElementById("pet-select");
  const petId = select.value;
  if (!petId) return;

  if (selectedPetIds.includes(petId)) return;
  if (selectedPetIds.length >= 5) {
    alert("You can select at most 5 pets.");
    return;
  }

  selectedPetIds.push(petId);
  renderSelectedPets();
}

function removePet(petId) {
  selectedPetIds = selectedPetIds.filter(id => id !== petId);
  renderSelectedPets();
}

function renderSelectedPets() {
  const container = document.getElementById("selected-pets");
  container.innerHTML = "";

  selectedPetIds.forEach(id => {
    const pet = pets.find(p => p.id === id);
    if (!pet) return;

    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = pet.name;

    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.addEventListener("click", () => removePet(id));

    pill.appendChild(btn);
    container.appendChild(pill);
  });
}

function scoreTeam(selectedPets, playstyle) {
  // Placeholder scoring:
  // - +1 per pet
  // - +2 if any pet has tag 'aoe' and playstyle is aoe_far
  // - +2 if any pet has tag 'single_target' and playstyle is single_target
  // This is where you plug your real Outlands rules.
  let score = selectedPets.length;

  const allTags = new Set(
    selectedPets.flatMap(p => Array.isArray(p.tags) ? p.tags : [])
  );

  if (playstyle === "aoe_far" && allTags.has("aoe")) {
    score += 2;
  }
  if (playstyle === "single_target" && allTags.has("single_target")) {
    score += 2;
  }

  return score;
}

function recommendBestiary(selectedPets, playstyle) {
  // Placeholder: score Bestiary pages based on matching tags.
  // Example:
  // - +1 if page has tag 'attack' and there is at least one Attack pet
  // - +1 if page has 'aoe' and playstyle is aoe_far or team has aoe tag
  // - +1 if page has 'single_target' and playstyle is single_target
  // - +1 if page is 'ranged_friendly' and playstyle is aoe_far
  const hasAttackPet = selectedPets.some(p => p.role === "Attack");
  const allTags = new Set(
    selectedPets.flatMap(p => Array.isArray(p.tags) ? p.tags : [])
  );

  const scored = bestiary.map(page => {
    let score = 0;
    const tags = new Set(page.tags || []);

    if (tags.has("attack") && hasAttackPet) score += 1;
    if (tags.has("aoe") && (playstyle === "aoe_far" || allTags.has("aoe"))) score += 1;
    if (tags.has("single_target") && playstyle === "single_target") score += 1;
    if (tags.has("ranged_friendly") && playstyle === "aoe_far") score += 1;
    if (tags.has("tank") && selectedPets.some(p => p.role === "Tank")) score += 1;

    return { page, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function runRecommendations() {
  const resultsEl = document.getElementById("results");
  resultsEl.innerHTML = "";

  if (selectedPetIds.length === 0) {
    resultsEl.textContent = "Select at least one pet.";
    return;
  }

  const playstyle = document.getElementById("playstyle").value;
  const selectedPets = selectedPetIds
    .map(id => pets.find(p => p.id === id))
    .filter(Boolean);

  const teamScore = scoreTeam(selectedPets, playstyle);
  const bestiarySuggestions = recommendBestiary(selectedPets, playstyle);

  // Team block
  const teamBlock = document.createElement("div");
  teamBlock.className = "result-block";
  const names = selectedPets.map(p => p.name).join(", ");

  teamBlock.innerHTML = `
    <div class="result-title">Selected Team</div>
    <div class="result-subtitle">${names}</div>
    <div>Team score (placeholder): <strong>${teamScore}</strong></div>
  `;
  resultsEl.appendChild(teamBlock);

  // Bestiary block
  const bestiaryBlock = document.createElement("div");
  bestiaryBlock.className = "result-block";

  const listItems = bestiarySuggestions
    .slice(0, 5)
    .map(
      s => `
        <li>
          <strong>${s.page.name}</strong>
          (score ${s.score})<br/>
          <span>${s.page.description || ""}</span>
        </li>
      `
    )
    .join("");

  bestiaryBlock.innerHTML = `
    <div class="result-title">Bestiary Suggestions</div>
    <div class="result-subtitle">Top pages for this team & playstyle</div>
    <ul>${listItems}</ul>
  `;
  resultsEl.appendChild(bestiaryBlock);
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  document
    .getElementById("add-pet-btn")
    .addEventListener("click", addSelectedPet);

  document
    .getElementById("run-btn")
    .addEventListener("click", runRecommendations);
});