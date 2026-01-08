let pets = [];
let bestiaryAttack = [];
let bestiaryTank = [];
let bestiaryUtility = [];
//let selectedPetIds = [];
let selectedPetsSelection = [];

async function loadData() {
  const petsRes = await fetch("pets.json");
  pets = await petsRes.json();

  const attackRes = await fetch("bestiary_attack.json");
  bestiaryAttack = await attackRes.json();

  const tankRes = await fetch("bestiary_tank.json");
  bestiaryTank = await tankRes.json();

  const utilityRes = await fetch("bestiary_utility.json");
  bestiaryUtility = await utilityRes.json();

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

  const pet = pets.find(p => p.id === petId);
  if (!pet) return;

  const currentSlotsUsed = selectedPetsSelection.reduce(
    (sum, sel) => {
      const p = pets.find(x => x.id === sel.id);
      return sum + (p?.slots || 0);
    },
    0
  );

  const petSlots = pet.slots || 0;
  if (currentSlotsUsed + petSlots > 5) {
    alert("Adding this pet would exceed the 5-slot limit.");
    return;
  }

  selectedPetsSelection.push({
    id: pet.id,
    name: pet.name
  });

  renderSelectedPets();
}

function recommendRank(score) {
  if (score >= 30) return 6;
  if (score >= 15) return 3;
  return 1;
}


function removePet(index) {
  selectedPetsSelection.splice(index, 1);
  renderSelectedPets();
}

function clearSelectedPets() {
  selectedPetsSelection = [];
  renderSelectedPets();

  const resultsEl = document.getElementById("results");
  resultsEl.innerHTML = "";
}



function renderSelectedPets() {
  const container = document.getElementById("selected-pets");
  container.innerHTML = "";

  selectedPetsSelection.forEach((sel, index) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = sel.name;

    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.addEventListener("click", () => removePet(index));

    pill.appendChild(btn);
    container.appendChild(pill);
  });
}

function recommendRank(score) {
  if (score >= 30) return 6;
  if (score >= 15) return 3;
  return 1;
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

function recommendBestiaryAttack(selectedPets, playstyle) {
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

    const rank = recommendRank(s);

    return { trait, score: s, rank };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function recommendBestiaryTank(selectedPets, playstyle) {
  const followers = selectedPets.length;
  const teamTags = new Set();
  let totalTankSlots = 0;

  selectedPets.forEach(p => {
    (p.tags || []).forEach(t => teamTags.add(t));
    if (p.class === "Tank") totalTankSlots += p.slots || 0;
  });

  const scored = bestiaryTank.map(trait => {
    let s = 0;
    const tags = trait.tags || [];
    const c = trait.conditions || {};

    if (tags.includes("defense_buff")) s += 12;
    if (tags.includes("debuff_resist")) s += 8;
    if (tags.includes("party_shield")) s += 10;
    if (tags.includes("damage_redirect")) s += 10;

    if (tags.includes("big_pet_synergy") && totalTankSlots >= (c.minSlots || 3)) s += 8;
    if (followers >= (c.minFollowers || 0)) s += 2;

    if (playstyle === "aoe_far") {
      if (c.preferredRange === "melee") s += 3;
    } else {
      if (c.preferredRange === "melee") s += 5;
    }

    const rank = recommendRank(s);

    return { trait, score: s, rank };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function recommendBestiaryUtility(selectedPets, playstyle) {
  const teamTags = new Set();
  let followers = selectedPets.length;
  let hasPoisonOrDisease = false;
  let hasChill = false;

  selectedPets.forEach(p => {
    (p.tags || []).forEach(t => teamTags.add(t));
    const pass = (p.passiveAbility || "").toLowerCase();
    const cd = (p.cooldownAbility || "").toLowerCase();

    if (pass.includes("poison") || pass.includes("disease") || cd.includes("poison") || cd.includes("disease")) {
      hasPoisonOrDisease = true;
    }
    if (pass.includes("chill") || cd.includes("chill")) {
      hasChill = true;
    }
  });

  const scored = bestiaryUtility.map(trait => {
    let s = 0;
    const tags = trait.tags || [];
    const c = trait.conditions || {};

    if (tags.includes("damage_buff")) s += 10;
    if (tags.includes("tamer_damage_buff")) s += 8;
    if (tags.includes("lifesteal")) s += 6;

    if (tags.includes("poison_synergy") || tags.includes("disease_synergy")) {
      if (hasPoisonOrDisease || c.requiresPoisonOrDisease) s += 15;
    }
    if (tags.includes("chill_synergy") && (hasChill || c.requiresChill)) s += 12;

    if (followers >= (c.minFollowers || 0)) s += 2;

    if (c.preferredRange === "melee" && playstyle !== "aoe_far") s += 5;
    if (c.preferredRange === "ranged" && playstyle === "aoe_far") s += 5;

    const rank = recommendRank(s);
    return { trait, score: s, rank };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function runRecommendations() {
  const resultsEl = document.getElementById("results");
  resultsEl.innerHTML = "";

  if (selectedPetsSelection.length === 0) {
  resultsEl.textContent = "Select at least one pet.";
  return;
}

  const playstyle = document.getElementById("playstyle").value;
  const selectedPets = selectedPetsSelection
  .map(sel => pets.find(p => p.id === sel.id))
  .filter(Boolean);
  const totalSlotsUsed = selectedPets.reduce(
  (sum, p) => sum + (p.slots || 0),
  0
);



  const teamScore = scoreTeam(selectedPets, playstyle);
  const teamRecommendations = recommendTeam(selectedPets, playstyle);
  const recommendedNames =
    teamRecommendations.length > 0
      ? teamRecommendations.map(r => r.pet.name).join(", ")
      : "No additional pets suggested (team already at or near 5 slots).";

  const attackSuggestions = recommendBestiaryAttack(selectedPets, playstyle);
  const tankSuggestions = recommendBestiaryTank(selectedPets, playstyle);
  const utilitySuggestions = recommendBestiaryUtility(selectedPets, playstyle);

  const teamBlock = document.createElement("div");
  teamBlock.className = "result-block";
  const names = selectedPets.map(p => p.name).join(", ");

  teamBlock.innerHTML = `
    <div class="result-title">Selected Team</div>
    <div class="result-subtitle">${names}</div>
    <div>Team score: <strong>${teamScore}</strong></div>
    <div>Slots used: <strong>${totalSlotsUsed} / 5</strong></div>
    <div style="margin-top:0.5rem;">
      <strong>Suggested additions:</strong> ${recommendedNames}
    </div>
  `;
  resultsEl.appendChild(teamBlock);

  const attackBlock = document.createElement("div");
  attackBlock.className = "result-block";
  const attackItems = attackSuggestions
    .slice(0, 5)
    .map(
      s => `
        <li>
          <strong>${s.trait.name}</strong>
          (score ${s.score}, <strong>${s.rank} pts</strong>)<br/>
          <span>${s.trait.description || ""}</span>
        </li>
      `
    )
    .join("");
  attackBlock.innerHTML = `
    <div class="result-title">Attack Bestiary Suggestions</div>
    <div class="result-subtitle">Top Attack pages for this team & playstyle</div>
    <ul>${attackItems}</ul>
  `;
  resultsEl.appendChild(attackBlock);

  const tankBlock = document.createElement("div");
  tankBlock.className = "result-block";
  const tankItems = tankSuggestions
    .slice(0, 5)
    .map(
      s => `
        <li>
          <strong>${s.trait.name}</strong>
          (score ${s.score},<strong>${s.rank} pts</strong>)
          <span>${s.trait.description || ""}</span>
        </li>
      `
    )
    .join("");
  tankBlock.innerHTML = `
    <div class="result-title">Tank Bestiary Suggestions</div>
    <div class="result-subtitle">Top Tank pages for this team & playstyle</div>
    <ul>${tankItems}</ul>
  `;
  resultsEl.appendChild(tankBlock);

  const utilityBlock = document.createElement("div");
  utilityBlock.className = "result-block";
  const utilityItems = utilitySuggestions
    .slice(0, 5)
    .map(
      s => `
        <li>
          <strong>${s.trait.name}</strong>
          (score ${s.score},<strong>${s.rank} pts</strong>)<br/>
          <span>${s.trait.description || ""}</span>
        </li>
      `
    )
    .join("");
  utilityBlock.innerHTML = `
    <div class="result-title">Utility Bestiary Suggestions</div>
    <div class="result-subtitle">Top Utility pages for this team & playstyle</div>
    <ul>${utilityItems}</ul>
  `;
  resultsEl.appendChild(utilityBlock);
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  document
    .getElementById("add-pet-btn")
    .addEventListener("click", addSelectedPet);

  document
    .getElementById("clear-pets-btn")
    .addEventListener("click", clearSelectedPets);

  document
    .getElementById("run-btn")
    .addEventListener("click", runRecommendations);
});
