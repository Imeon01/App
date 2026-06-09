// =========================
// Globale Variablen
// =========================

let currentPlantId = "pflanze1";
let historyChart = null;
let stream = null;

console.log("SCRIPT GELADEN");
console.log("HTTPS:", location.protocol);
console.log("Host:", location.hostname);

// =========================
// Elemente
// =========================

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

const graphModal = document.getElementById("graphModal");
const modalTitle = document.getElementById("modalTitle");
const closeModal = document.querySelector(".close-modal");

// =========================
// API
// =========================

const API_BASE = "https://imeon01.github.io/App/api";

// =========================
// Sensoren
// =========================

async function fetchSensorData() {
  try {
    const response = await fetch(
      `${API_BASE}/sensors?plantId=${currentPlantId}`
    );

    if (!response.ok) {
      throw new Error("API Fehler");
    }

    return await response.json();

  } catch (error) {

    console.error("Sensorfehler:", error);

    return {
      moisture: 0,
      temperature: 0,
      humidity: 0,
      light: 0,
      lastWatering: "---",
      kiText: "Keine Verbindung"
    };
  }
}

// =========================
// Historie
// =========================

async function fetchHistory(sensorType) {

  try {

    const response = await fetch(
      `${API_BASE}/history?plantId=${currentPlantId}&sensor=${sensorType}&interval=hour`
    );

    if (!response.ok) {
      throw new Error("Historie Fehler");
    }

    return await response.json();

  } catch (error) {

    console.error(error);

    return [];
  }
}

// =========================
// Dashboard
// =========================

async function updateDashboard() {

  try {

    const data = await fetchSensorData();

    moistureValue.innerText = `${data.moisture} %`;
    tempValue.innerText = `${Number(data.temperature).toFixed(1)} °C`;
    humidityValue.innerText = `${data.humidity} %`;
    lightValue.innerText = `${data.light} lx`;

    kiRecommendation.innerText = data.kiText;
    lastWateringSpan.innerText = data.lastWatering;

  } catch (error) {

    console.error(
      "Dashboard Fehler:",
      error
    );
  }
}

// =========================
// Bewässerung
// =========================

async function manualWater() {

  try {

    const response = await fetch(
      `${API_BASE}/water/manual`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          plantId: currentPlantId
        })
      }
    );

    if (!response.ok) {
      throw new Error();
    }

    await updateDashboard();

  } catch (error) {

    console.error(error);

    alert("Fehler beim Gießen");
  }
}

// =========================
// Graph
// =========================

async function showGraph(sensorType) {

  const history = await fetchHistory(sensorType);

  const labels = history.map(h => h.date);
  const values = history.map(h => h.value);

  let yLabel = "";

  switch(sensorType) {
    case "moisture":
      yLabel = "Bodenfeuchtigkeit (%)";
      break;

    case "temperature":
      yLabel = "Temperatur (°C)";
      break;

    case "humidity":
      yLabel = "Luftfeuchtigkeit (%)";
      break;

    case "light":
      yLabel = "Licht (lx)";
      break;
  }

  modalTitle.innerText = yLabel;

  if (historyChart) {
    historyChart.destroy();
  }

  const ctx =
    document
      .getElementById("historyChart")
      .getContext("2d");

  historyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: yLabel,
        data: values,
        borderColor: "#2c5e2e",
        tension: 0.2
      }]
    },
    options: {
      responsive: true
    }
  });

  graphModal.style.display = "flex";
}

// =========================
// Modal
// =========================

closeModal.onclick = () => {
  graphModal.style.display = "none";
};

window.onclick = (e) => {

  if (e.target === graphModal) {
    graphModal.style.display = "none";
  }
};

// =========================
// Sensor Karten
// =========================

document
  .querySelectorAll(".sensor-card")
  .forEach(card => {

    card.addEventListener("click", () => {

      const sensor =
        card.dataset.sensor;

      if (sensor) {
        showGraph(sensor);
      }
    });
  });

// =========================
// Kamera
// =========================

async function startCamera() {
  alert(location.href);
  

  console.log("startCamera()");

  try {

    if (!navigator.mediaDevices) {
      alert("mediaDevices fehlt");
      return;
    }

    if (!navigator.mediaDevices.getUserMedia) {
      alert("getUserMedia fehlt");
      return;
    }

    stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment"
          }
        },
        audio: false
      });
      alert("Kamerazugriff erhalten");

    video.srcObject = stream;

    await video.play();

    console.log(
      "Kamera gestartet"
    );

  } catch (err) {

    console.error(err);

    alert(
      "Kamera Fehler:\n" +
      err.name +
      "\n" +
      err.message
    );
  }
}

function stopCamera() {

  if (!stream) return;

  stream
    .getTracks()
    .forEach(track => track.stop());

  video.srcObject = null;

  stream = null;
}

// =========================
// Navigation
// =========================

switchBtn.addEventListener(
  "click",
  async () => {

    console.log(
      "Kamera Ansicht öffnen"
    );

    dashboardView.style.display =
      "none";

    cameraView.style.display =
      "block";

    preview.innerHTML = "";

    delete preview.dataset.image;

    plantNameInput.value = "";

    await startCamera();
    alert("stream = " + !!stream);
  }
);

backBtn.addEventListener(
  "click",
  () => {

    stopCamera();

    cameraView.style.display =
      "none";

    dashboardView.style.display =
      "block";

    updateDashboard();
  }
);

// =========================
// Foto aufnehmen
// =========================

captureBtn.addEventListener(
  "click",
  () => {

    if (!stream) {
      alert(
        "Kamera wurde nicht gestartet"
      );
      return;
    }

    if (!video.videoWidth) {
      alert(
        "Kein Kamerabild verfügbar"
      );
      return;
    }

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    const ctx =
      canvas.getContext("2d");

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageData =
      canvas.toDataURL(
        "image/jpeg",
        0.9
      );

    preview.innerHTML = `
      <img
        src="${imageData}"
        width="100%"
        style="border-radius:16px;"
      >
    `;

    preview.dataset.image =
      imageData;
  }
);

// =========================
// Pflanze speichern
// =========================

savePlantBtn.addEventListener(
  "click",
  async () => {

    const name =
      plantNameInput.value.trim();

    if (!name) {
      alert("Name fehlt");
      return;
    }

    if (!preview.dataset.image) {
      alert("Foto fehlt");
      return;
    }

    alert(
      "Backend noch nicht verfügbar"
    );
  }
);

// =========================
// Pflanze wechseln
// =========================

plantSelect.addEventListener(
  "change",
  (e) => {

    currentPlantId =
      e.target.value;

    updateDashboard();
  }
);

// =========================
// Bewässerung Button
// =========================

waterBtn.addEventListener(
  "click",
  manualWater
);

// =========================
// Start
// =========================

updateDashboard();

/* setInterval(
  updateDashboard,
  15000
); */
