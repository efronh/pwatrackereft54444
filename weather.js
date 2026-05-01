
// weather.js
const weatherIcon = document.getElementById('weather-icon');
const weatherTemp = document.getElementById('weather-temp');
const weatherBlock = document.getElementById('weather-block');

const cityModalOverlay = document.getElementById('city-modal-overlay');
const cityInput = document.getElementById('city-input');
const cityModalCancel = document.getElementById('city-modal-cancel');
const cityModalSave = document.getElementById('city-modal-save');

let currentLat = 41.0082;
let currentLng = 28.9784;

function loadCityCoords() {
    const saved = localStorage.getItem('weatherCoords');
    if(saved) {
        try {
            const parsed = JSON.parse(saved);
            currentLat = parsed.lat;
            currentLng = parsed.lng;
        } catch(e){}
    }
}

async function fetchWeather() {
    if(!weatherIcon || !weatherTemp) return;
    loadCityCoords();
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLng}&current=temperature_2m,weather_code`);
        const data = await res.json();
        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;
        
        weatherTemp.textContent = `${temp}°C`;
        
        if (code === 0 || code === 1 || code === 2 || code === 3) {
            weatherIcon.className = 'ph ph-baseball-cap'; // Hat for sunny/cloudy
            weatherIcon.style.color = '#e6a822';
        } else if (code >= 51 && code <= 67 || code >= 80 && code <= 82 || code >= 95 && code <= 99) {
            weatherIcon.className = 'ph ph-umbrella'; // Umbrella for rain/storms
            weatherIcon.style.color = '#3498db';
        } else if (code >= 71 && code <= 77 || code >= 85 && code <= 86) {
            weatherIcon.className = 'ph ph-boot'; // Boots for snow
            weatherIcon.style.color = '#5c7a8b';
        } else {
            weatherIcon.className = 'ph ph-cloud';
            weatherIcon.style.color = '#9e9e9e';
        }
    } catch(e) {
        console.error("Weather fetch failed", e);
        weatherIcon.className = 'ph ph-cloud-slash';
        weatherTemp.textContent = 'Err';
    }
}

if(weatherBlock) {
    weatherBlock.addEventListener('click', () => {
        const savedCity = localStorage.getItem('weatherCity') || '';
        if(cityInput) cityInput.value = savedCity;
        if(cityModalOverlay) cityModalOverlay.classList.remove('hidden-view');
    });
}

if(cityModalCancel) {
    cityModalCancel.addEventListener('click', () => {
        cityModalOverlay.classList.add('hidden-view');
    });
}

if(cityModalSave) {
    cityModalSave.addEventListener('click', async () => {
        const cityName = cityInput.value.trim();
        if(!cityName) return;
        
        // Use Open-Meteo Geocoding API to find coords
        cityModalSave.textContent = "Loading...";
        try {
            const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`);
            const data = await res.json();
            if(data.results && data.results.length > 0) {
                const city = data.results[0];
                currentLat = city.latitude;
                currentLng = city.longitude;
                localStorage.setItem('weatherCoords', JSON.stringify({ lat: currentLat, lng: currentLng }));
                localStorage.setItem('weatherCity', city.name);
                fetchWeather();
                cityModalOverlay.classList.add('hidden-view');
            } else {
                alert("City not found. Please try again.");
            }
        } catch(e) {
            alert("Error searching for city.");
        } finally {
            cityModalSave.textContent = "Save";
        }
    });
}

fetchWeather();
