
const APP_STATE = {
    favorites: JSON.parse(localStorage.getItem('weather_favorites')) || [],
    currentTabId: null,
};

// --- Services ---

const API = {
    async searchLocation(city, state) {
        const query = `${city}, ${state}`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=us,pr,gu,vi,as,mp`;

        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'TextWeatherApp/1.0' } });
            if (!response.ok) throw new Error('Search failed');
            return await response.json();
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    async getNWSPoints(lat, lon) {
        const url = `https://api.weather.gov/points/${lat},${lon}`;
        try {
            const response = await fetch(url, { headers: { 'User-Agent': 'TextWeatherApp/1.0' } });
            if (!response.ok) throw new Error('NWS Points API failed');
            return await response.json();
        } catch (error) {
            console.error(error);
            return null;
        }
    },

    async getForecast(forecastUrl) {
        try {
            const response = await fetch(forecastUrl, { headers: { 'User-Agent': 'TextWeatherApp/1.0' } });
            if (!response.ok) throw new Error('NWS Forecast API failed');
            return await response.json();
        } catch (error) {
            console.error(error);
            return null;
        }
    }
};

// --- UI Manager ---
const UI = {
    elements: {
        tabsContainer: document.getElementById('tabs-container'),
        addBtn: document.getElementById('add-location-btn'),
        setupView: document.getElementById('setup-view'),
        forecastView: document.getElementById('forecast-view'),
        searchForm: document.getElementById('search-form'),
        cityInput: document.getElementById('city-input'),
        stateInput: document.getElementById('state-input'),
        searchResults: document.getElementById('search-results'),
        statusMsg: document.getElementById('status-message'),
        forecastContent: document.getElementById('forecast-content'),
        contextMenu: document.getElementById('context-menu'),
        deleteBtn: document.getElementById('delete-tab-btn')
    },

    contextTargetId: null,

    init() {
        this.renderTabs();
        this.bindEvents();

        document.addEventListener('click', () => this.hideContextMenu());

        if (APP_STATE.favorites.length > 0) {
            // Restore last active tab if possible, else first
            const id = APP_STATE.currentTabId || APP_STATE.favorites[0].id;
            this.switchTab(id);
        } else {
            this.showSetup();
        }
    },

    bindEvents() {
        this.elements.addBtn.addEventListener('click', () => this.showSetup());

        this.elements.searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const city = this.elements.cityInput.value.trim();
            const state = this.elements.stateInput.value.trim();
            if (city && state) {
                this.handleSearch(city, state);
            }
        });

        this.elements.deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.contextTargetId) {
                this.deleteFavorite(this.contextTargetId);
                this.hideContextMenu();
            }
        });
    },

    showContextMenu(e, id) {
        e.preventDefault();
        this.contextTargetId = id;

        const menu = this.elements.contextMenu;
        menu.classList.remove('hidden');
        menu.style.top = `${e.pageY}px`;
        menu.style.left = `${e.pageX}px`;
    },

    hideContextMenu() {
        this.elements.contextMenu.classList.add('hidden');
        this.contextTargetId = null;
    },

    deleteFavorite(id) {
        const index = APP_STATE.favorites.findIndex(f => f.id === id);
        if (index === -1) return;

        APP_STATE.favorites.splice(index, 1);
        this.saveFavorites();

        if (APP_STATE.currentTabId === id) {
            if (APP_STATE.favorites.length > 0) {
                const newIndex = Math.max(0, index - 1);
                this.switchTab(APP_STATE.favorites[newIndex].id);
            } else {
                this.showSetup();
            }
        } else {
            this.renderTabs();
            // Re-apply active class
            if (APP_STATE.currentTabId) {
                const activeBtn = Array.from(this.elements.tabsContainer.children)
                    .find(btn => btn.textContent === APP_STATE.favorites.find(f => f.id === APP_STATE.currentTabId).name);
                if (activeBtn) activeBtn.classList.add('active');
            }
        }
    },

    showSetup() {
        this.elements.setupView.classList.remove('hidden');
        this.elements.forecastView.classList.add('hidden');

        // Deactivate all tabs
        this.updateTabStyles(null);
        APP_STATE.currentTabId = null;
    },

    async handleSearch(city, state) {
        this.elements.statusMsg.textContent = 'Searching...';
        this.elements.searchResults.innerHTML = '';

        const results = await API.searchLocation(city, state);

        this.elements.statusMsg.textContent = '';

        if (results.length === 0) {
            this.elements.statusMsg.textContent = 'No results found.';
            return;
        }

        results.forEach(place => {
            const div = document.createElement('div');
            div.className = 'result-item';
            div.textContent = place.display_name;
            div.onclick = () => this.addFavorite(place);
            this.elements.searchResults.appendChild(div);
        });
    },

    async addFavorite(place) {
        this.elements.statusMsg.textContent = 'Fetching weather data...';

        const pointsData = await API.getNWSPoints(place.lat, place.lon);

        if (!pointsData || !pointsData.properties) {
            this.elements.statusMsg.textContent = 'Error fetching NWS data.';
            return;
        }

        const props = pointsData.properties;
        const newFav = {
            id: Date.now().toString(),
            name: place.address.city || place.address.town || place.name || "Unknown",
            full_name: place.display_name,
            lat: place.lat,
            lon: place.lon,
            forecastUrl: props.forecast
        };

        APP_STATE.favorites.push(newFav);
        this.saveFavorites();

        // Reset Search UI
        this.elements.cityInput.value = '';
        this.elements.stateInput.value = '';
        this.elements.searchResults.innerHTML = '';

        this.renderTabs();
        this.switchTab(newFav.id);
    },

    saveFavorites() {
        localStorage.setItem('weather_favorites', JSON.stringify(APP_STATE.favorites));
    },

    renderTabs() {
        this.elements.tabsContainer.innerHTML = '';

        APP_STATE.favorites.forEach(fav => {
            const btn = document.createElement('div');
            btn.className = 'tab-btn';
            btn.textContent = fav.name;
            btn.onclick = () => this.switchTab(fav.id);
            btn.oncontextmenu = (e) => this.showContextMenu(e, fav.id);
            this.elements.tabsContainer.appendChild(btn);
        });
    },

    updateTabStyles(activeId) {
        const tabs = this.elements.tabsContainer.querySelectorAll('.tab-btn');
        tabs.forEach((tab, index) => {
            if (APP_STATE.favorites[index].id === activeId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    },

    async switchTab(id) {
        const fav = APP_STATE.favorites.find(f => f.id === id);
        if (!fav) return;

        APP_STATE.currentTabId = id;
        this.updateTabStyles(id);

        this.elements.setupView.classList.add('hidden');
        this.elements.forecastView.classList.remove('hidden');

        this.elements.forecastContent.innerHTML = '<div style="padding:1rem; text-align:center;">Loading forecast...</div>';

        const forecastData = await API.getForecast(fav.forecastUrl);

        if (forecastData && forecastData.properties && forecastData.properties.periods) {
            this.renderForecast(forecastData.properties.periods);
        } else {
            this.elements.forecastContent.innerHTML = '<div style="padding:1rem; text-align:center;">Unable to load forecast.</div>';
        }
    },

    renderForecast(periods) {
        this.elements.forecastContent.innerHTML = '';
        periods.forEach(period => {
            const div = document.createElement('div');
            div.className = 'forecast-period';
            div.innerHTML = `
                <div class="forecast-name">${period.name}</div>
                <div class="forecast-text">${period.detailedForecast}</div>
            `;
            this.elements.forecastContent.appendChild(div);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => UI.init());
