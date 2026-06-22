//  Globale Variablen
// Backend-Integration: kein Platzhalter "pflanze1" mehr (unser Schema nutzt
// Integer-plant_ids, siehe index.html-Kommentar). Erst nach "Pflanze anlegen"
// gibt es eine gültige currentPlantId; fetchSensorData() fängt den 404/422
// bis dahin bereits ab (Dummy-Werte im Dashboard).
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
// Backend-Integration: `preview` (einzelnes Bild) ersetzt durch einen
// Zwischenspeicher für mehrere Bilder — siehe stagedImages/stagedGallery
// weiter unten. "Foto aufnehmen" UND Beispielbilder landen erst hier, bevor
// "Pflanze speichern" alle zusammen an den Agenten sendet (Mehrbild-
// Unterstützung, PlantNet akzeptiert bis zu 3 Bilder pro Bestimmung).
const stagedGallery = document.getElementById("stagedGallery");
const exampleImageList = document.getElementById("exampleImageList");
const moistureValue = document.getElementById("moistureValue");
const tempValue = document.getElementById("tempValue");
// Backend-Integration: humidityValue/lightValue entfernt — die zugehörigen
// DOM-Elemente existieren nicht mehr (index.html), unser Sensor-Schema misst
// keine Luftfeuchte/Licht. Die alten Referenzen waren null und ließen
// updateDashboard() bei jedem Aufruf mit TypeError abbrechen, NACH dem
// moisture/temp-Update aber VOR kiText/lastWatering — dadurch blieben auch
// diese beiden im Dashboard auf "Lade Empfehlung..."/"---" hängen.
const kiRecommendation = document.getElementById("kiRecommendation");
const lastWateringSpan = document.getElementById("lastWatering");
const graphModal = document.getElementById("graphModal");
const modalTitle = document.getElementById("modalTitle");
const closeModal = document.querySelector(".close-modal");
const lastUpdateSpan = document.getElementById("lastUpdateSpan");
const toggleCamBtn = document.getElementById("toggleCameraBtn");

// Backend-Integration: neue DOM-Referenzen für EC/pH, Pflanzenart+Sollwerte,
// Aktion+Wirkungsstatus und das Verlaufs-Protokoll (GET /api/sensors liefert
// diese Felder jetzt zusätzlich, GET /api/events ist eine neue Route).
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

// Backend-Integration: Platzhalter-Antwort, wenn noch KEINE Pflanze gewählt
// ist (currentPlantId === null) ODER der Server nicht antwortet — vorher
// wurde in diesem Fall trotzdem `GET /api/sensors?plantId=null` geschickt
// (Server lehnt das mit 422 ab, "plantId" muss ein int sein), was bei jedem
// 15s-Poll unnötig die Konsole mit Fehlern füllte.
const _SENSOR_PLATZHALTER = {
  moisture: 0,
  temperature: 0,
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

    // Backend-Integration: humidity/light entfernt — siehe index.html/
    // updateDashboard()-Kommentar, unser Sensor-Schema misst das nicht.
    // Neue Felder (ec/ph/action/outcomeConfirmed/species/...) im Fehlerfall
    // auf null/--, damit updateDashboard() dieselbe Null-Safety nutzen kann.
    return {
      moisture: 0,
      temperature: 0,
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

// Backend-Integration: Verlaufs-Protokoll abrufen (GET /api/events, neue
// Route) — die letzten Pflegeentscheidungen statt nur der allerletzten.
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
    // Backend-Integration: moisture/temperature können null sein (Profil ohne
    // Pi-Pairing oder noch keine Messung — Designentscheidung #7), daher
    // Fallback auf "--" statt .toFixed() auf null aufzurufen (TypeError).
    moistureValue.innerText = (data.moisture ?? "--") + " %";
    tempValue.innerText = (data.temperature != null ? data.temperature.toFixed(1) : "--") + " °C";
    kiRecommendation.innerText = data.kiText;
    lastWateringSpan.innerText = data.lastWatering;
    lastUpdateSpan.innerText = new Date().toLocaleTimeString();

    // Backend-Integration: EC/pH — dieselbe Null-Safety wie moisture/temperature.
    ecValue.innerText = (data.ec ?? "--") + " mS/cm";
    phValue.innerText = (data.ph ?? "--") + "";

    // Backend-Integration: Pflanzenart/Konfidenz + Sollwerte aus dem Profil.
    speciesValue.innerText = data.species ?? "--";
    confidenceValue.innerText = data.confidence != null ? Math.round(data.confidence * 100) + " %" : "--";
    targetMoistureValue.innerText = data.targetMoisture ?? "--";
    moistureThresholdValue.innerText = data.moistureThreshold ?? "--";
    ecRangeValue.innerText = (data.ecMin != null && data.ecMax != null) ? `${data.ecMin}–${data.ecMax}` : "--";
    phRangeValue.innerText = (data.phMin != null && data.phMax != null) ? `${data.phMin}–${data.phMax}` : "--";
    tempRangeValue.innerText = (data.tempMin != null && data.tempMax != null) ? `${data.tempMin}–${data.tempMax}` : "--";

    // Backend-Integration: Aktion explizit + Wirkungsstatus-Badge.
    actionValue.innerText = data.action ?? "--";
    if (data.outcomeConfirmed === true) {
      outcomeBadge.innerText = "✅ Wirkung bestätigt";
    } else if (data.outcomeConfirmed === false) {
      outcomeBadge.innerText = "❌ Keine Wirkung";
    } else {
      outcomeBadge.innerText = "";
    }
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Dashboards:", error);
  }
}

// Backend-Integration: Verlaufs-Protokoll rendern + Modal öffnen.
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

// Backend-Integration: Verlaufs-Modal schließen + Button-Verdrahtung.
closeEventsModal.onclick = () => { eventsModal.style.display = "none"; };
showEventsBtn.addEventListener("click", showEvents);

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

// Backend-Integration: Mehrbild-Zwischenspeicher (Staging). `stagedImages`
// sammelt alle Data-URLs (Kamera-Aufnahmen + gewählte Beispielbilder), bis
// "Pflanze speichern" sie gesammelt an POST /api/plants schickt.
let stagedImages = [];

// Hier die Dateinamen der Beispielbilder eintragen — liegen lokal unter
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
  stagedImages.push(dataUrl);
  renderStagedGallery();
}

// Beispielbild (bereits als <img> geladenes Element) in eine Data-URL
// wandeln — über Canvas statt fetch(): wird die Webapp per file:// direkt
// geöffnet (Doppelklick auf index.html, kein lokaler HTTP-Server), blockieren
// die meisten Browser fetch()-Zugriffe auf lokale Dateien aus
// Sicherheitsgründen. Das bereits geladene <img>-Element per Canvas
// auszulesen funktioniert auch unter file:// zuverlässig.
function imageElementToDataUrl(imgEl) {
  const canvas = document.createElement("canvas");
  canvas.width = imgEl.naturalWidth;
  canvas.height = imgEl.naturalHeight;
  canvas.getContext("2d").drawImage(imgEl, 0, 0);
  return canvas.toDataURL("image/jpeg");
}

// Backend-Integration: ALLE Beispielbilder als Data-URLs — das ist bewusst
// die einzige Bildquelle für "Pflanze anlegen" (s. savePlantBtn-Handler
// unten). Kommt jetzt aus EXAMPLE_IMAGES_BASE64 (example-images-data.js,
// fest eingebettetes Base64) statt aus einem Datei-Ladevorgang zur
// Laufzeit: Bilder per <img>/Canvas aus lokalen Dateien lesen, während die
// Seite per file:// (Doppelklick auf index.html) geöffnet ist, hat den
// Canvas "tainted" — `toDataURL()` wirft dann einen SecurityError, je nach
// Browser unterschiedlich streng. Mit bereits eingebetteten Daten entfällt
// das Laden zur Laufzeit komplett. Kamera/Zwischenspeicher bleiben im Code
// stehen, werden aber für den Versand nicht mehr genutzt — die Seiten-Logik
// dafür übernimmt jemand anders; hier zählt nur, dass der Agent verlässlich
// Bilder bekommt, zum Testen.
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

//  Kamera-Flip-Button
// Backend-Integration: löscht den Zwischenspeicher beim Flip NICHT mehr
// (vorher wurde das einzelne Vorschaubild bei jedem Flip verworfen) — schon
// aufgenommene/gewählte Bilder sollen beim Kamera-Wechsel erhalten bleiben.
toggleCamBtn.onclick = () => {
  currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
  startCamera(currentFacingMode);
};

switchBtn.addEventListener("click", () => {
  dashboardView.style.display = "none";
  cameraView.style.display = "block";
  startCamera(currentFacingMode);
  plantNameInput.value = "";
});

backBtn.addEventListener("click", () => {
  cameraView.style.display = "none";
  dashboardView.style.display = "block";
  stopCamera();
  updateDashboard();

  // Backend-Integration: Zwischenspeicher statt einzelnem `preview` leeren.
  stagedImages = [];
  renderStagedGallery();
  plantNameInput.value = "";
});

captureBtn.addEventListener("click", () => {
  if (!stream) { alert("Kamera nicht aktiv"); return; }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const imageData = canvas.toDataURL("image/png");
  // Backend-Integration: Foto wird NICHT mehr sofort gesendet/als einziges
  // Vorschaubild gehalten, sondern dem Zwischenspeicher hinzugefügt — kann
  // mehrfach wiederholt werden, bevor "Pflanze speichern" alle sendet.
  addStagedImage(imageData);
});


// Backend-Integration: Lade-Zustand für den Speichern-Button. Wurde mit dem
// Demo-Modus-Fallback (Designentscheidungen-Dokument, Backend
// DEMO_MODE_PLANT_CREATION) wichtiger — POST /api/plants kann dort bis zu
// zwei volle Agentenläufe versuchen, bevor der Fallback greift, und braucht
// entsprechend länger als ein einzelner Request.
const savePlantBtnText = savePlantBtn.textContent;

savePlantBtn.addEventListener("click", async () => {
  const name = plantNameInput.value.trim();
  if (!name) return alert("Bitte Namen eingeben");

  savePlantBtn.disabled = true;
  savePlantBtn.textContent = "Wird angelegt...";
  try {
    // Backend-Integration (vereinfacht auf Wunsch): Kamera/Zwischenspeicher
    // werden hier NICHT mehr verwendet — es zählt nur, dass der Agent
    // verlässlich Testbilder bekommt. Es werden IMMER die fest auf der Seite
    // hinterlegten EXAMPLE_IMAGES gesendet, unabhängig davon, was sonst auf
    // der Seite passiert. Die endgültige Foto-Logik (Kamera vs. Beispiel
    // vs. Zwischenspeicher) übernimmt später jemand anders.
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