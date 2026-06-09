//  Globale Variablen 
let currentPlantId = "pflanze1";
let historyChart = null;

//  Variablen
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
const preview = document.getElementById("preview");
const plantNameInput = document.getElementById("plantName");
const moistureValue = document.getElementById("moistureValue");
const tempValue = document.getElementById("tempValue");
const humidityValue = document.getElementById("humidityValue");
const lightValue = document.getElementById("lightValue");
const kiRecommendation = document.getElementById("kiRecommendation");
const lastWateringSpan = document.getElementById("lastWatering");
const lastUpdateSpan = document.getElementById("lastUpdate");
const graphModal = document.getElementById("graphModal");
const modalTitle = document.getElementById("modalTitle");
const closeModal = document.querySelector(".close-modal");

//  API-Basis: TESTEN
const API_BASE = "http://127.0.0.1:8000/api";

//  Sensordaten abrufen 
async function fetchSensorData() {
  try {
    const response = await fetch(`${API_BASE}/sensors?plantId=${currentPlantId}`);
    if (!response.ok) throw new Error("Fehler beim Abrufen der Sensordaten");
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Fehler beim Laden der Sensordaten:", error);
    
    return {
      moisture: 0,
      temperature: 0,
      humidity: 0,
      light: 0,
      lastWatering: "---",
      kiText: "Fehler beim Laden"
    };
  }
}

// Historische Daten (stündlich)
async function fetchHistory(sensorType) {
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

//  Dashboard aktualisieren 
async function updateDashboard() {
  try {
    const data = await fetchSensorData();
    moistureValue.innerText = data.moisture + " %";
    tempValue.innerText = data.temperature.toFixed(1) + " °C";
    humidityValue.innerText = data.humidity + " %";
    lightValue.innerText = data.light + " lx";
    kiRecommendation.innerText = data.kiText;
    lastWateringSpan.innerText = data.lastWatering;
    lastUpdateSpan.innerText = new Date().toLocaleTimeString();
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Dashboards:", error);
  }
}

//  Manuelle Bewässerung? 
async function manualWater() {
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
    case 'humidity': unit = "%"; yLabel = "Luftfeuchtigkeit (%)"; break;
    case 'light': unit = "lx"; yLabel = "Licht (lx)"; break;
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
window.onclick = (e) => { if (e.target === graphModal) graphModal.style.display = "none"; };

//  Klick-Events auf Dashboard 
document.querySelectorAll('.sensor-card').forEach(card => {
  card.addEventListener('click', (e) => {
    const sensor = card.dataset.sensor;
    if (sensor) showGraph(sensor);
  });
});

//  Kamera und anlegen von Pfalnzen
let stream = null;
async function startCamera() {
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
  } catch (err) { alert("Kamera nicht verfügbar: " + err.message); }
}



function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null; }
}

switchBtn.addEventListener("click", () => {
  dashboardView.style.display = "none";
  cameraView.style.display = "block";
  startCamera();
  plantNameInput.value = "";
});

backBtn.addEventListener("click", () => {
  cameraView.style.display = "none";
  dashboardView.style.display = "block";
  stopCamera();
  updateDashboard();
});

captureBtn.addEventListener("click", () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const imageData = canvas.toDataURL("image/png");
  preview.innerHTML = `<img src="${imageData}" width="100%" style="border-radius:16px;">`;
  preview.dataset.image = imageData;
});

savePlantBtn.addEventListener("click", async () => {
  const name = plantNameInput.value.trim();
  if (!name) return alert("Bitte Namen eingeben");
  if (!preview.dataset.image) return alert("Bitte zuerst ein Foto machen");

  try {
    const response = await fetch(`${API_BASE}/plants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, image_base64: preview.dataset.image })
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
