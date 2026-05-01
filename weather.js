
async function fetchWeather() {
    if(!weatherIcon || !weatherTemp) return;
    try {
        // Istanbul coords: 41.0082, 28.9784
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=41.0082&longitude=28.9784&current=temperature_2m,weather_code');
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

