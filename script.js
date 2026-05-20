// ---------- Globale Variablen ----------
let currentPlantId = "pflanze1";
let historyChart = null;

// ---------- DOM-Elemente ----------
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

// ---------- API-Basis (später anpassen) ----------
const API_BASE = "http://localhost:3000/api";

// Aktuelle Sensordaten (fest, kein Zufall, kein langer Zusatztext)
async function fetchSensorData() {
  // TODO: Durch echten API-Aufruf ersetzen
  // const response = await fetch(`${API_BASE}/sensors?plantId=${currentPlantId}`);
  // const data = await response.json();
  const data = {
    moisture: 42,
    temperature: 22.5,
    humidity: 58,
    light: 340,
    lastWatering: "2026-04-30 18:30",
    kiText: "In 3 Stunden"   // KEIN zusätzlicher Satz mehr
  };
  return data;
}

// Historische Daten – stündlich (letzte 12 Stunden)
async function fetchHistory(sensorType) {
  // TODO: Echten Endpunkt: /api/history?plantId=...&sensor=...&interval=hour
  // Demo: generiere 12 Stunden (von vor 12 Stunden bis jetzt)
  const now = new Date();
  let history = [];
  for (let i = 23; i >= 0; i--) {
    let date = new Date(00);
    date.setHours(now.getHours() - i);
    let hourLabel = date.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
    let value;
    switch(sensorType) {
      case 'moisture': value = 30 + i * 1.5; break;    // von ~30% auf ~48%
      case 'temperature': value = 20 + i * 0.3; break; // von ~20°C auf ~23°C
      case 'humidity': value = 55 - i * 0.8; break;    // von ~55% auf ~46%
      case 'light': value = 300 + i * 15; break;       // von ~300 lx auf ~465 lx
      default: value = 50;
    }
    history.push({ date: hourLabel, value: Math.round(value * 10) / 10 });
  }
  return history;
}

// Dashboard aktualisieren
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
    console.error("Fehler beim Laden der Sensordaten:", error);
  }
}

// Manuelle Bewässerung
async function manualWater() {
  try {
    // await fetch(`${API_BASE}/water/manual`, { method: "POST", body: JSON.stringify({ plantId: currentPlantId }) });
    alert("💦 Gießbefehl gesendet (Mock) – bitte Backend einbinden");
    await updateDashboard();
  } catch (error) {
    console.error(error);
    alert("Fehler beim Gießen");
  }
}

// ---------- Graph-Modal mit stündlichen Werten ----------
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
    data: { labels, datasets: [{ label: yLabel, data: values, borderColor: '#2c5e2e', fill: false, tension: 0.2 }] },
    options: { responsive: true, maintainAspectRatio: true }
  });
  graphModal.style.display = "flex";
}

// Modal schließen
closeModal.onclick = () => { graphModal.style.display = "none"; };
window.onclick = (e) => { if (e.target === graphModal) graphModal.style.display = "none"; };

// Klick-Events auf Sensor-Karten
document.querySelectorAll('.sensor-card').forEach(card => {
  card.addEventListener('click', (e) => {
    const sensor = card.dataset.sensor;
    if (sensor) showGraph(sensor);
  });
});

// ---------- Kamera & Pflanzenanlage (mit Kartoffel als Beispiel) ----------
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
savePlantBtn.addEventListener("click", () => {
  const name = plantNameInput.value.trim();
  if (!name) return alert("Bitte Namen eingeben");
  if (!preview.dataset.image) return alert("Bitte zuerst ein Foto machen");
  // Hier API-Aufruf zum Speichern
  alert(`Pflanze "${name}" wurde angelegt.`);
  const option = document.createElement("option");
  option.value = name.toLowerCase().replace(/\s/g, "");
  option.textContent = name;
  plantSelect.appendChild(option);
  plantSelect.value = option.value;
  currentPlantId = option.value;
  backBtn.click();
});
plantSelect.addEventListener("change", (e) => {
  currentPlantId = e.target.value;
  updateDashboard();
});
waterBtn.addEventListener("click", manualWater);

// Start
updateDashboard();
setInterval(updateDashboard, 15000);