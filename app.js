let pets = [];
let bestiaryAttack = [];
let bestiaryTank = [];
let bestiaryUtility = [];
let selectedPetsSelection = [];

// Helper: choose 1, 3, or 6 points for a trait based on its synergy score
function recommendRank(score) {
  if (score >= 30) return 6;
  if (score >= 15) return 3;
  return 1;
}

async function loadData() {
  const petsRes = await fetch("pets.json");
  pets = await petsRes.json();

  const attackRes = await fetch("bestiary_attack.json");
  bestiaryAttack = await attackRes.json();

  const tankRes = await fetch("bestiary_tank.json");
  bestiaryTank = await tankRes.json();

  const utilityRes = await fetch("bestiary_utility.json");
  bestiaryUtility = await utilityRes.json();

  populatePetSelects();
}

/**
 * Populate all 5 select elements with the full pet list.
 * HTML needs:
 *   select-pet-1 ... select-pet-5
 *   pet-filter-1 ... pet-filter-5
 */
function populatePetSelects() {
  const selectIds = [
    "select-pet-1",
    "select-pet-2",
    "select-pet-3",
    "select-pet-4",
    "select-pet-5"
  ];

  selectIds.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = "";
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "-- Select a pet --";
    select.appendChild(defaultOpt);

    pets.forEach(pet => {
      const opt = document.createElement("option");
      opt.value = pet.id;
      opt.textContent = pet.name;
      select.appendChild(opt);
    });

    // cache original options for filtering
    select._allOptions = Array.from(select.options);
  });

  setupPetFilters();
}

/**
 * Attach "type to filter" behavior to each filter input.
 * Each filter input should have id pet-filter-N and correspond to select-pet-N.
 */
function setupPetFilters() {
  for (let i = 1; i <= 5; i++) {
    const filter = document.getElementById(`pet-filter-${i}`);
    const select = document.getElementById(`select-pet-${i}`);
    if (!filter || !select) continue;

    const allOptions = select._allOptions || Array.from(select.options);

    filter.addEventListener("input", () => {
      const term = filter.value.toLowerCase().trim();
      select.innerHTML = "";
      let toShow;

      if (!term) {
        toShow = allOptions;
      } else {
        toShow = allOptions.filter(o =>
          o.text.toLowerCase().includes(term) ||
          o.value.toLowerCase().includes(term)
        );
      }

      toShow.forEach(o => select.appendChild(o));
    });
  }
}

/**
 * Build selectedPetsSelection from the 5 dropdown fields.
 */
function buildSelectedPetsFromFields() {
  selectedPetsSelection = [];

  for (let i = 1; i <= 5; i++) {
    const select = document.getElementById(`select-pet-${i}`);
    if (!select) continue;
    const petId = select.value;
    if (!petId) continue;

    const pet = pets.find(p => p.id === petId);
    if (!pet) continue;

    selectedPetsSelection.push({
      id: pet.id,
      name: pet.name
    });
  }

  renderSelectedPets();
}

function clearSelectedPets() {
  // Clear selections in the dropdowns and filters
  for (let i = 1; i <= 5; i++) {
    const select = document.getElementById(`select-pet-${i}`);
    const filter = document.getElementById(`pet-filter-${i}`);
    if (select) select.value = "";
    if (filter) filter.value = "";
  }

  selectedPetsSelection = [];
  renderSelectedPets();

  const attackCard = document.getElementById("attack-card");
  const tankCard = document.getElementById("tank-card");
  const utilityCard = document.getElementById("utility-card");

  if (attackCard) attackCard.innerHTML = "";
  if (tankCard) tankCard.innerHTML = "";
  if (utilityCard) utilityCard.innerHTML = "";
}

function removePet(index) {
  const removed = selectedPetsSelection[index];
  selectedPetsSelection.splice(index, 1);

  // Clear that pet from any select that currently has it
  for (let i = 1; i <= 5; i++) {
    const select = document.getElementById(`select-pet-${i}`);
    if (select && removed && select.value === removed.id) {
      select.value = "";
    }
  }

  renderSelectedPets();
}

function renderSelectedPets() {
  const container = document.getElementById("selected-pets");
  if (!container) return;

  container.innerHTML = "";

  selectedPetsSelection.forEach((sel, index) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = sel.name;

    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.type = "button";
    btn.addEventListener("click", () => removePet(index));

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

function recommendBestiaryAttack(selectedPets, playstyle) {
  const teamTags = new Set();
  let followers = selectedPets.length;
  let hasBleed = false;

  selectedPets.forEach(p => {
    (p.tags || []).forEach(t => teamTags.add(t));
    if ((p.passiveAbility || "").toLowerCase().includes("bleed")) hasBleed = true;
    if (
      (p.cooldownAbility || "").toLowerCase().includes("barrage") ||
      (p.cooldownAbility || "").toLowerCase().includes("breath")
    ) {
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

    if (
      pass.includes("poison") ||
      pass.includes("disease") ||
      cd.includes("poison") ||
      cd.includes("disease")
    ) {
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

// Build a 20-point allocation for a scored trait list
function buildTwentyPointAllocation(scoredTraits) {
  const allocation = [];
  let total = 0;

  const ranked = scoredTraits.map(s => {
    const rank = recommendRank(s.score);
    return { ...s, rank };
  });

  ranked.sort((a, b) => b.score - a.score);

  for (const s of ranked) {
    if (total >= 20) break;
    const remaining = 20 - total;
    let points = s.rank;

    if (points > remaining) points = remaining;
    if (points <= 0) continue;

    allocation.push({
      name: s.trait.name,
      description: s.trait.description || "",
      points
    });
    total += points;
  }

  return allocation;
}

function runRecommendations() {
  // Build selectedPetsSelection from the 5 dropdowns first
  buildSelectedPetsFromFields();

  const attackCard = document.getElementById("attack-card");
  const tankCard = document.getElementById("tank-card");
  const utilityCard = document.getElementById("utility-card");

  if (attackCard) attackCard.innerHTML = "";
  if (tankCard) tankCard.innerHTML = "";
  if (utilityCard) utilityCard.innerHTML = "";

  if (selectedPetsSelection.length === 0) {
    if (attackCard) {
      attackCard.innerHTML = `
        <div class="result-title">Attack</div>
        <div class="result-subtitle">No team selected</div>
        <div class="result-points">Pick at least one pet above.</div>
      `;
    }
    if (tankCard) {
      tankCard.innerHTML = `
        <div class="result-title">Tank</div>
        <div class="result-subtitle">No team selected</div>
        <div class="result-points">Pick at least one pet above.</div>
      `;
    }
    if (utilityCard) {
      utilityCard.innerHTML = `
        <div class="result-title">Utility</div>
        <div class="result-subtitle">No team selected</div>
        <div class="result-points">Pick at least one pet above.</div>
      `;
    }
    return;
  }

  const playstyle = document.getElementById("playstyle").value;
  const selectedPets = selectedPetsSelection
    .map(sel => pets.find(p => p.id === sel.id))
    .filter(Boolean);

  const teamClasses = new Set(selectedPets.map(p => p.class));
  const hasAttack = teamClasses.has("Attack");
  const hasTank = teamClasses.has("Tank");
  const hasUtility = teamClasses.has("Utility");

  const attackSuggestions = hasAttack
    ? recommendBestiaryAttack(selectedPets, playstyle)
    : [];
  const tankSuggestions = hasTank
    ? recommendBestiaryTank(selectedPets, playstyle)
    : [];
  const utilitySuggestions = hasUtility
    ? recommendBestiaryUtility(selectedPets, playstyle)
    : [];

  const attackAlloc = buildTwentyPointAllocation(attackSuggestions);
  const tankAlloc = buildTwentyPointAllocation(tankSuggestions);
  const utilityAlloc = buildTwentyPointAllocation(utilitySuggestions);

  const makeCardHtml = (title, suggestions, alloc) => {
    if (!suggestions || suggestions.length === 0) {
      return `
        <div class="result-title">${title}</div>
        <div class="result-subtitle">No relevant pets in this class</div>
        <div class="result-points">0 pts allocated</div>
      `;
    }

    const totalPoints = alloc.reduce((sum, a) => sum + a.points, 0);
    const items = alloc
      .map(a => `
        <li>
          <strong>${a.name}</strong> &mdash; ${a.points} pts
        </li>
      `)
      .join("");

    return `
      <div class="result-title">${title}</div>
      <div class="result-subtitle">${totalPoints} / 20 pts allocated</div>
      <div class="result-points">Highest-synergy traits for this team and playstyle.</div>
      <ul class="result-list">
        ${items || "<li>No high-synergy traits found.</li>"}
      </ul>
    `;
  };

  if (attackCard) {
    attackCard.innerHTML = makeCardHtml("Attack", attackSuggestions, attackAlloc);
  }
  if (tankCard) {
    tankCard.innerHTML = makeCardHtml("Tank", tankSuggestions, tankAlloc);
  }
  if (utilityCard) {
    utilityCard.innerHTML = makeCardHtml("Utility", utilitySuggestions, utilityAlloc);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  const clearBtn = document.getElementById("clear-pets-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", clearSelectedPets);
  }

  const runBtn = document.getElementById("run-btn");
  if (runBtn) {
    runBtn.addEventListener("click", runRecommendations);
  }
});
