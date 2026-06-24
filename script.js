//  Globale Variablen
let currentPlantId = null;                // Aktuelle Pflanze
let historyChart = null;                  // Graph
let currentFacingMode = "environment";    // Kamera Modus

//  Variablen + DOM
const dashboardView = document.getElementById("dashboardView");
const cameraView = document.getElementById("cameraView");
const switchBtn = document.getElementById("switchToCameraBtn");
const backBtn = document.getElementById("backToDashboardBtn");
const plantSelect = document.getElementById("plantSelect");
const waterBtn = document.getElementById("waterNowBtn");
const captureBtn = document.getElementById("captureBtn");
const savePlantBtn = document.getElementById("savePlantBtn");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const plantNameInput = document.getElementById("plantName");
const stagedGallery = document.getElementById("stagedGallery");
const exampleImageList = document.getElementById("exampleImageList");
const moistureValue = document.getElementById("moistureValue");
const tempValue = document.getElementById("tempValue");
const kiRecommendation = document.getElementById("kiRecommendation");
const lastWateringSpan = document.getElementById("lastWatering");
const graphModal = document.getElementById("graphModal");
const modalTitle = document.getElementById("modalTitle");
const closeModal = document.querySelector(".close-modal");
const lastUpdateSpan = document.getElementById("lastUpdateSpan");
const toggleCamBtn = document.getElementById("toggleCameraBtn");

const ecValue = document.getElementById("ecValue");
const phValue = document.getElementById("phValue");
const speciesValue = document.getElementById("speciesValue");
const confidenceValue = document.getElementById("confidenceValue");
const targetMoistureValue = document.getElementById("targetMoistureValue");
const moistureThresholdValue = document.getElementById("moistureThresholdValue");
const ecRangeValue = document.getElementById("ecRangeValue");
const phRangeValue = document.getElementById("phRangeValue");
const tempRangeValue = document.getElementById("tempRangeValue");
const actionValue = document.getElementById("actionValue");
const outcomeBadge = document.getElementById("outcomeBadge");
const showEventsBtn = document.getElementById("showEventsBtn");
const eventsModal = document.getElementById("eventsModal");
const eventsList = document.getElementById("eventsList");
const closeEventsModal = document.querySelector(".close-events-modal");


//  API URL : TESTEN
const API_BASE = "http://127.0.0.1:8000/api";     

const _SENSOR_PLATZHALTER = {
  moisture: null,
  temperature: null,
  ec: null,
  ph: null,
  lastWatering: "---",
  kiText: "Fehler beim Laden",
  action: null,
  outcomeConfirmed: null,
  species: null,
  confidence: null,
  targetMoisture: null,
  moistureThreshold: null,
  ecMin: null, ecMax: null,
  phMin: null, phMax: null,
  tempMin: null, tempMax: null
};

//  Sensordaten abrufen
async function fetchSensorData() {
  if (!currentPlantId) return { ..._SENSOR_PLATZHALTER, kiText: "Noch keine Pflanze ausgewählt." };
  try {
    const response = await fetch(`${API_BASE}/sensors?plantId=${currentPlantId}`);    // Anfrage an Server
    if (!response.ok) throw new Error("Fehler beim Abrufen der Sensordaten");
    const data = await response.json();
    return data;

    // Dummy Werte falls Fehler
  } catch (error) {
    console.error("Fehler beim Laden der Sensordaten:", error);

    return {
      moisture: null,
      temperature: null,
      ec: null,
      ph: null,
      lastWatering: "---",
      kiText: "Fehler beim Laden",
      action: null,
      outcomeConfirmed: null,
      species: null,
      confidence: null,
      targetMoisture: null,
      moistureThreshold: null,
      ecMin: null, ecMax: null,
      phMin: null, phMax: null,
      tempMin: null, tempMax: null
    };
  }
}


async function fetchEvents() {
  if (!currentPlantId) return [];
  try {
    const response = await fetch(`${API_BASE}/events?plantId=${currentPlantId}`);
    if (!response.ok) throw new Error("Fehler beim Abrufen des Verlaufs");
    return await response.json();
  } catch (error) {
    console.error("Fehler beim Laden des Verlaufs:", error);
    return [];
  }
}

// Historische Daten (stündlich) ???
async function fetchHistory(sensorType) {
  if (!currentPlantId) return [];
  try {
    const response = await fetch(`${API_BASE}/history?plantId=${currentPlantId}&sensor=${sensorType}&interval=hour`);
    if (!response.ok) throw new Error("Fehler beim Abrufen der Historie");
    const history = await response.json();
    return history;
  } catch (error) {
    console.error("Fehler beim Laden der Historie:", error);
    return [];
  }
}

//  Dashboard aktualisieren mit Werten
async function updateDashboard() {
  try {
    const data = await fetchSensorData();
    moistureValue.innerText = (data.moisture ?? "--") + " %";
    tempValue.innerText = (data.temperature != null ? data.temperature.toFixed(1) : "--") + " °C";
    kiRecommendation.innerText = data.kiText;
    lastWateringSpan.innerText = data.lastWatering;
    lastUpdateSpan.innerText = new Date().toLocaleTimeString();

    ecValue.innerText = (data.ec ?? "--") + " mS/cm";
    phValue.innerText = (data.ph ?? "--") + "";

    // Sollwerte + Pflanze
    speciesValue.innerText = data.species ?? "--";
    confidenceValue.innerText = data.confidence != null ? Math.round(data.confidence * 100) + " %" : "--";
    targetMoistureValue.innerText = data.targetMoisture ?? "--";
    moistureThresholdValue.innerText = data.moistureThreshold ?? "--";
    ecRangeValue.innerText = (data.ecMin != null && data.ecMax != null) ? `${data.ecMin}–${data.ecMax}` : "--";
    phRangeValue.innerText = (data.phMin != null && data.phMax != null) ? `${data.phMin}–${data.phMax}` : "--";
    tempRangeValue.innerText = (data.tempMin != null && data.tempMax != null) ? `${data.tempMin}–${data.tempMax}` : "--";

    // Checken ob Aktion durchgeführt
    actionValue.innerText = data.action ?? "--";
    if (data.outcomeConfirmed === true) {
      outcomeBadge.innerText = "✅";
    } else if (data.outcomeConfirmed === false) {
      outcomeBadge.innerText = "❌";
    } else {
      outcomeBadge.innerText = "";
    }
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Dashboards:", error);
  }
}

// Background Protokoll
async function showEvents() {
  const events = await fetchEvents();
  eventsList.innerHTML = "";
  if (events.length === 0) {
    eventsList.innerHTML = "<li>Noch keine Pflegeentscheidungen vorhanden.</li>";
  } else {
    events.forEach(ev => {
      const li = document.createElement("li");
      let badge = "";
      if (ev.outcomeConfirmed === true) badge = " ✅";
      else if (ev.outcomeConfirmed === false) badge = " ❌";
      const menge = ev.amount != null ? ` (${ev.amount} ml)` : "";
      li.innerText = `${ev.timestamp} — ${ev.action}${menge}${badge}: ${ev.reason}`;
      eventsList.appendChild(li);
    });
  }
  eventsModal.style.display = "flex";
}

//  Manuelle Bewässerung? 
async function manualWater() {
  if (!currentPlantId) return alert("Bitte zuerst eine Pflanze anlegen oder auswählen.");
  try {
    const response = await fetch(`${API_BASE}/water/manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId: currentPlantId })
    });
    if (!response.ok) throw new Error("Fehler beim Gießen");
    await updateDashboard();
  } catch (error) {
    console.error(error);
    alert("Fehler beim Gießen");
  }
}

//  Graph mit stündlichen Werten 
async function showGraph(sensorType) {
  const history = await fetchHistory(sensorType);
  const labels = history.map(h => h.date);
  const values = history.map(h => h.value);
  
  let unit = "";
  let yLabel = "";
  switch(sensorType) {
    case 'moisture': unit = "%"; yLabel = "Bodenfeuchtigkeit (%)"; break;
    case 'temperature': unit = "°C"; yLabel = "Temperatur (°C)"; break;
    case 'ec': unit = "mS/cm"; yLabel = "EC (mS/cm)"; break;
    case 'ph': unit = ""; yLabel = "pH-Wert"; break;
  }
  modalTitle.innerText = `Verlauf (letzte 24 Std) – ${yLabel}`;
  
  if (historyChart) historyChart.destroy();
  const ctx = document.getElementById('historyChart').getContext('2d');
  historyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: yLabel,
        data: values,
        borderColor: '#2c5e2e',
        fill: false,
        tension: 0.2
      }]
    },
    options: { responsive: true, maintainAspectRatio: true }
  });
  graphModal.style.display = "flex";
}

//  Graph schließen
closeModal.onclick = () => { graphModal.style.display = "none"; };
window.onclick = (e) => {
  if (e.target === graphModal) graphModal.style.display = "none";
  if (e.target === eventsModal) eventsModal.style.display = "none";
};

closeEventsModal.onclick = () => { eventsModal.style.display = "none"; };
if (showEventsBtn) {
  showEventsBtn.addEventListener("click", showEvents);
}

//  Klick-Events auf Dashboard 
document.querySelectorAll('.sensor-card').forEach(card => {
  card.addEventListener('click', (e) => {
    const sensor = card.dataset.sensor;
    if (sensor) showGraph(sensor);
  });
});

//  Kamera und anlegen von Pfalnzen
let stream = null;

async function startCamera(facingMode) {
  if (stream) stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: facingMode } }
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      alert("Kamera nicht verfügbar: " + e.message);
    }
  }
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop());
  stream = null;
  video.srcObject = null; }
}

// Preview Bilder aufnehmen
let stagedImages = [];

// Lokale Beispiel Bilder
// docs/App-Frontend/example-images/ (relativ zu index.html).
const EXAMPLE_IMAGES = [
  "example-images/sonnenblume-aussehen-3693839192.jpg",
  "example-images/sonnenblume-c5fa22ed-9b73-47d2-aec3-05ef9266edfe-3849969825.jpg",
  "example-images/sonnenblume-wachstum-2541035114.jpg"
];

function renderStagedGallery() {
  stagedGallery.innerHTML = "";
  stagedImages.forEach((dataUrl, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "staged-thumb-wrapper";

    const img = document.createElement("img");
    img.src = dataUrl;
    img.className = "staged-thumb";
    wrapper.appendChild(img);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "staged-thumb-remove";
    removeBtn.innerText = "×";
    removeBtn.title = "Bild entfernen";
    removeBtn.addEventListener("click", () => {
      stagedImages.splice(index, 1);
      renderStagedGallery();
    });
    wrapper.appendChild(removeBtn);

    stagedGallery.appendChild(wrapper);
  });
}

function addStagedImage(dataUrl) {
  // Prüfen, ob bereits 3 Bilder im Zwischenspeicher sind
  if (stagedImages.length >= 3) {
    alert("Es können maximal 3 Bilder hinzugefügt werden.");
    return;
  }
  stagedImages.push(dataUrl);
  renderStagedGallery();
}

// Data URL
function imageElementToDataUrl(imgEl) {
  const canvas = document.createElement("canvas");
  canvas.width = imgEl.naturalWidth;
  canvas.height = imgEl.naturalHeight;
  canvas.getContext("2d").drawImage(imgEl, 0, 0);
  return canvas.toDataURL("image/jpeg");
}


async function getExampleImagesAsDataUrls() {
  return EXAMPLE_IMAGES_BASE64;
}

function renderExampleImages() {
  exampleImageList.innerHTML = "";
  EXAMPLE_IMAGES.forEach(path => {
    const img = document.createElement("img");
    img.src = path;
    img.className = "example-thumb";
    img.title = "Zum Zwischenspeicher hinzufügen";
    img.addEventListener("click", () => {
      try {
        addStagedImage(imageElementToDataUrl(img));
      } catch (e) {
        console.error("Beispielbild konnte nicht verwendet werden:", path, e);
        alert("Beispielbild konnte nicht verwendet werden: " + path);
      }
    });
    exampleImageList.appendChild(img);
  });
}


toggleCamBtn.onclick = () => {
  currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
  startCamera(currentFacingMode);
};

switchBtn.addEventListener("click", () => {
  dashboardView.style.display = "none";
  cameraView.style.display = "block";
  startCamera(currentFacingMode);
  plantNameInput.value = "";
  // Footer ausblenden
  const footer = document.querySelector("footer");
  if (footer) footer.style.display = "none";
});

backBtn.addEventListener("click", () => {
  cameraView.style.display = "none";
  dashboardView.style.display = "block";
  stopCamera();
  updateDashboard();
  stagedImages = [];
  renderStagedGallery();
  plantNameInput.value = "";
  // Footer wieder einblenden
  const footer = document.querySelector("footer");
  if (footer) footer.style.display = "flex";
});

captureBtn.addEventListener("click", () => {
  if (!stream) { alert("Kamera nicht aktiv"); return; }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const imageData = canvas.toDataURL("image/png");
  addStagedImage(imageData);
});


const savePlantBtnText = savePlantBtn.textContent;

savePlantBtn.addEventListener("click", async () => {
  const name = plantNameInput.value.trim();
  if (!name) return alert("Bitte Namen eingeben");

  savePlantBtn.disabled = true;
  savePlantBtn.textContent = "Wird angelegt...";
  try {
    const images = await getExampleImagesAsDataUrls();
    const response = await fetch(`${API_BASE}/plants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, images: images })
    });
    if (!response.ok) throw new Error("Fehler beim Speichern");
    const result = await response.json();

    alert(`Pflanze "${name}" wurde angelegt.`);
    const option = document.createElement("option");
    option.value = result.plantId;
    option.textContent = name;
    plantSelect.appendChild(option);
    plantSelect.value = option.value;
    currentPlantId = option.value;
    backBtn.click();
  } catch (error) {
    console.error(error);
    alert("Fehler beim Speichern der Pflanze");
  } finally {
    savePlantBtn.disabled = false;
    savePlantBtn.textContent = savePlantBtnText;
  }
});

plantSelect.addEventListener("change", (e) => {
  currentPlantId = e.target.value;
  updateDashboard();
});

waterBtn.addEventListener("click", manualWater);

//  Start
updateDashboard();
setInterval(updateDashboard, 15000);
// Backend-Integration: Beispielbild-Thumbnails einmalig beim Laden rendern.
renderExampleImages();