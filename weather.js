
// weather.js — coords sync via Supabase user_preferences (mirror only offline)
const weatherIcon = document.getElementById('weather-icon');
const weatherTemp = document.getElementById('weather-temp');
const weatherCityLabel = document.getElementById('weather-city-label');
const weatherBlock = document.getElementById('weather-block');

const DEFAULT_IST_LAT = 41.0082;
const DEFAULT_IST_LNG = 28.9784;

const cityModalOverlay = document.getElementById('city-modal-overlay');
const cityInput = document.getElementById('city-input');
const cityModalCancel = document.getElementById('city-modal-cancel');
const cityModalSave = document.getElementById('city-modal-save');

if (!window.trackerWeatherPrefs) {
    window.trackerWeatherPrefs = null;
}

let currentLat = DEFAULT_IST_LAT;
let currentLng = DEFAULT_IST_LNG;

function loadCityCoords() {
    const p = window.trackerWeatherPrefs;
    if (p && typeof p.lat === 'number' && typeof p.lng === 'number') {
        currentLat = p.lat;
        currentLng = p.lng;
        return;
    }

    if (typeof readParsedMirror === 'function') {
        const wp = readParsedMirror('weatherPrefs');
        if (wp && typeof wp.lat === 'number' && typeof wp.lng === 'number') {
            window.trackerWeatherPrefs = wp;
            currentLat = wp.lat;
            currentLng = wp.lng;
            return;
        }
    }

    if (typeof isTrackerOnline === 'function' && !isTrackerOnline()) {
        const saved = localStorage.getItem('weatherCoords');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                currentLat = parsed.lat;
                currentLng = parsed.lng;
                window.trackerWeatherPrefs = {
                    lat: currentLat,
                    lng: currentLng,
                    city: localStorage.getItem('weatherCity') || ''
                };
            } catch (e) {
                /* keep defaults */
            }
        }
    }
}

function updateWeatherCityLabel() {
    if (!weatherCityLabel) return;
    loadCityCoords();
    let name = '';
    const p = window.trackerWeatherPrefs;
    if (p && p.city && String(p.city).trim()) {
        name = String(p.city).trim();
    } else if (
        Math.abs(currentLat - DEFAULT_IST_LAT) < 0.02 &&
        Math.abs(currentLng - DEFAULT_IST_LNG) < 0.02
    ) {
        name = 'Istanbul';
    }
    weatherCityLabel.textContent = name;
    weatherCityLabel.style.display = name ? 'block' : 'none';
}

async function fetchWeather() {
    if (!weatherIcon || !weatherTemp) return;
    loadCityCoords();
    try {
        const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLng}&current=temperature_2m,weather_code`
        );
        const data = await res.json();
        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;

        weatherTemp.textContent = `${temp}°C`;

        if (code === 0 || code === 1 || code === 2 || code === 3) {
            weatherIcon.className = 'ph ph-baseball-cap';
            weatherIcon.style.color = '#e6a822';
        } else if (
            (code >= 51 && code <= 67) ||
            (code >= 80 && code <= 82) ||
            (code >= 95 && code <= 99)
        ) {
            weatherIcon.className = 'ph ph-umbrella';
            weatherIcon.style.color = '#3498db';
        } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
            weatherIcon.className = 'ph ph-boot';
            weatherIcon.style.color = '#5c7a8b';
        } else {
            weatherIcon.className = 'ph ph-cloud';
            weatherIcon.style.color = '#9e9e9e';
        }
        updateWeatherCityLabel();
    } catch (e) {
        console.error('Weather fetch failed', e);
        weatherIcon.className = 'ph ph-cloud-slash';
        weatherTemp.textContent = 'Err';
        updateWeatherCityLabel();
    }
}

if (weatherBlock) {
    weatherBlock.addEventListener('click', () => {
        const savedCity =
            (window.trackerWeatherPrefs && window.trackerWeatherPrefs.city) ||
            localStorage.getItem('weatherCity') ||
            '';
        if (cityInput) cityInput.value = savedCity;
        if (cityModalOverlay) cityModalOverlay.classList.remove('hidden-view');
    });
}

if (cityModalCancel) {
    cityModalCancel.addEventListener('click', () => {
        cityModalOverlay.classList.add('hidden-view');
    });
}

if (cityModalSave) {
    cityModalSave.addEventListener('click', async () => {
        const cityName = cityInput.value.trim();
        if (!cityName) return;

        cityModalSave.textContent = 'Loading...';
        try {
            const res = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`
            );
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const city = data.results[0];
                currentLat = city.latitude;
                currentLng = city.longitude;
                window.trackerWeatherPrefs = {
                    lat: currentLat,
                    lng: currentLng,
                    city: city.name
                };
                if (typeof persistMirror === 'function') {
                    persistMirror('weatherPrefs', window.trackerWeatherPrefs);
                }
                try {
                    localStorage.setItem('weatherCity', city.name);
                    localStorage.setItem(
                        'weatherCoords',
                        JSON.stringify({ lat: currentLat, lng: currentLng })
                    );
                } catch (e) {
                    /* ignore */
                }
                if (typeof syncToCloud === 'function') syncToCloud();
                fetchWeather();
                cityModalOverlay.classList.add('hidden-view');
            } else {
                alert('City not found. Please try again.');
            }
        } catch (e) {
            alert('Error searching for city.');
        } finally {
            cityModalSave.textContent = 'Save';
        }
    });
}

fetchWeather();
setInterval(fetchWeather, 3600000);

if (cityModalOverlay) {
    cityModalOverlay.addEventListener('click', (e) => {
        if (e.target === cityModalOverlay) cityModalOverlay.classList.add('hidden-view');
    });
}
