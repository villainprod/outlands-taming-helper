
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

function recommendBestiary(selectedPets, playstyle) {
  const teamTags = new Set();
  let followers = selectedPets.length;
  let hasBleed = false;

  selectedPets.forEach(p => {
    (p.tags || []).forEach(t => teamTags.add(t));
    if ((p.passiveAbility || "").toLowerCase().includes("bleed")) hasBleed = true;
    if ((p.cooldownAbility || "").toLowerCase().includes("barrage") ||
        (p.cooldownAbility || "").toLowerCase().includes("breath")) {
      teamTags.add("aoe");
    }
  });

  const scored = bestiaryAttack.map(trait => {
    let s = 0;
    const tags = trait.tags || [];
    const c = trait.conditions || {};

    if (tags.includes("damage_buff")) s += 10;
    if (tags.includes("healing_buff")) s += 5;

    if (tags.includes("bleed_synergy") && (hasBleed || teamTags.has("bleed"))) s += 25;
    if (tags.includes("follower_count_scaling") && followers >= (c.minFollowers || 2)) s += 20;

    if (playstyle === "aoe_far") {
      if (tags.includes("ranged_friendly")) s += 20;
      if (teamTags.has("aoe")) s += 15;
    } else if (playstyle === "single_target") {
      if (tags.includes("crit_synergy") || tags.includes("single_target_synergy")) s += 15;
    } else {
      if (tags.includes("tank_synergy") && teamTags.has("tank")) s += 10;
    }

    if (c.preferredRange === "ranged" && playstyle === "aoe_far") s += 8;
    if (c.preferredRange === "melee" && playstyle !== "aoe_far") s += 5;

    return { trait, score: s };
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

  const teamBlock = document.createElement("div");
  teamBlock.className = "result-block";
  const names = selectedPets.map(p => p.name).join(", ");

  teamBlock.innerHTML = `
    <div class="result-title">Selected Team</div>
    <div class="result-subtitle">${names}</div>
    <div>Team score: <strong>${teamScore}</strong></div>
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
