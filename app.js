
let pets = [];
let bestiaryAttack = [];
let selectedPetIds = [];

async function loadData() {
  const petsRes = await fetch("pets.json");
  pets = await petsRes.json();

  const bestiaryRes = await fetch("bestiary_attack.json");
  bestiaryAttack = await bestiaryRes.json();

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
  let score = 0;
  let slots = 0;
  const teamTags = new Set();

  selectedPets.forEach(p => {
    slots += p.slots || 0;
    (p.tags || []).forEach(t => teamTags.add(t));
    score += (p.underdogScalar || 1) * ((p.minDmg || 0) + (p.maxDmg || 0)) / 2;
  });

  if (slots > 5) score -= 50;

  if (playstyle === "aoe_far") {
    if (teamTags.has("aoe")) score += 40;
    if (teamTags.has("ranged_friendly") || teamTags.has("spell")) score += 20;
  } else if (playstyle === "single_target") {
    if (teamTags.has("single_target") || teamTags.has("bleed")) score += 40;
  } else {
    if (teamTags.has("tank") && teamTags.has("attack")) score += 30;
  }

  return Math.round(score);
}

function recommendTeam(selectedPets, playstyle) {
  const maxSlots = 5;

  const usedSlots = selectedPets.reduce(
    (sum, p) => sum + (p.slots || 0),
    0
  );
  const usedIds = new Set(selectedPets.map(p => p.id));

  if (usedSlots >= maxSlots) {
    return [];
  }

  const teamTags = new Set();
  selectedPets.forEach(p => (p.tags || []).forEach(t => teamTags.add(t)));

  const remainingSlots = maxSlots - usedSlots;

  const candidates = pets
    .filter(p => !usedIds.has(p.id))
    .filter(p => (p.slots || 0) <= remainingSlots);

  const scored = candidates.map(p => {
    let s = 0;

    if (p.class === "Tank" && !teamTags.has("tank")) s += 25;
    if (p.class === "Attack" && !teamTags.has("attack")) s += 20;

    const tags = new Set(p.tags || []);

    if (playstyle === "aoe_far") {
      if (tags.has("aoe")) s += 20;
      if (tags.has("spell")) s += 10;
    } else if (playstyle === "single_target") {
      if (tags.has("single_target")) s += 20;
      if (tags.has("bleed")) s += 10;
    } else {
      if (tags.has("tank")) s += 10;
      if (tags.has("utility")) s += 5;
    }

    const avgDmg = ((p.minDmg || 0) + (p.maxDmg || 0)) / 2;
    s += avgDmg * (p.underdogScalar || 1) * 0.3;

    return { pet: p, score: Math.round(s) };
  });

  scored.sort((a, b) => b.score - a.score);

  const picked = [];
  let slotBudget = remainingSlots;
  for (const c of scored) {
    const cost = c.pet.slots || 0;
    if (cost <= slotBudget) {
      picked.push(c);
      slotBudget -= cost;
    }
    if (slotBudget <= 0) break;
  }

  return picked;
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
  const teamRecommendations = recommendTeam(selectedPets, playstyle);
  const recommendedNames = teamRecommendations.length > 0
    ? teamRecommendations.map(r => r.pet.name).join(", ")
    : "No additional pets suggested (team already at or near 5 slots).";


  const bestiarySuggestions = recommendBestiary(selectedPets, playstyle);

  const teamBlock = document.createElement("div");
  teamBlock.className = "result-block";
  const names = selectedPets.map(p => p.name).join(", ");

  teamBlock.innerHTML = `
  <div class="result-title">Selected Team</div>
  <div class="result-subtitle">${names}</div>
  <div>Team score: <strong>${teamScore}</strong></div>
  <div style="margin-top:0.5rem;">
    <strong>Suggested additions:</strong> ${recommendedNames}
  </div>
`;

  resultsEl.appendChild(teamBlock);

  const bestiaryBlock = document.createElement("div");
  bestiaryBlock.className = "result-block";

  const listItems = bestiarySuggestions
    .slice(0, 5)
    .map(
      s => `
        <li>
          <strong>${s.trait.name}</strong>
          (score ${s.score})<br/>
          <span>${s.trait.description || ""}</span>
        </li>
      `
    )
    .join("");

  bestiaryBlock.innerHTML = `
    <div class="result-title">Attack Bestiary Suggestions</div>
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
