document.addEventListener("DOMContentLoaded", function() {
    const findLocationBtn = document.getElementById("find-location");
    const loadingElement = document.getElementById("loading");
    const resultsElement = document.getElementById("results");
    const errorElement = document.getElementById("error-message");
    const petrolPumpsList = document.getElementById("petrol-pumps-list");
    const mapContainer = document.getElementById("map-container");
    const searchResultInfo = document.getElementById("search-result-info");
    const testInsertBtn = document.getElementById("test-insert");

    let map;
    let markers = [];
    let userMarker;

    console.log("map-functions.js loaded at", new Date().toISOString());

    window.onerror = function(msg, url, line) {
        console.error(`Global error: ${msg} at ${url}:${line}`);
        errorElement.textContent = `App error: ${msg}`;
        errorElement.style.display = "block";
        return false;
    };

    if (testInsertBtn) {
        testInsertBtn.addEventListener("click", async () => {
            console.log("Test insert button clicked");
            const station = {
                id: "12596227207",
                name: "IndianOil",
                lat: 24.5426022,
                lon: 81.2926181,
                distance: 3.08,
                tags: { "addr:street": "Old Bus Stand Road", "addr:city": "Rewa" }
            };
            try {
                const pumpId = await savePetrolPump(station);
                console.log("Test insert successful:", pumpId);
            } catch (error) {
                console.error("Test insert failed:", error);
            }
        });
    }

    function initMap(center = [20, 77], zoom = 5) {
        console.log("Initializing map with center:", center);
        if (map) {
            map.remove();
        }

        mapContainer.style.display = "block";
        map = L.map("map").setView(center, zoom);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        return map;
    }

    function createPumpIcon(number) {
        return L.divIcon({
            html: `<div style="background-color: #0055a4; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white;">${number}</div>`,
            className: "pump-marker",
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    findLocationBtn.addEventListener("click", function() {
        console.log("Find location button clicked");
        loadingElement.style.display = "block";
        errorElement.style.display = "none";
        resultsElement.style.display = "none";

        navigator.geolocation.getCurrentPosition(success, error);
    });

    function success(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        console.log("Current location:", lat, lon);

        findNearbyPetrolPumps([lat, lon], "your current location");
    }

    function error(err) {
        console.error("Geolocation error:", err);
        loadingElement.style.display = "none";

        let errorMsg = "Unable to find your location. ";

        switch (err.code) {
            case err.PERMISSION_DENIED:
                errorMsg += "Location permission was denied. Please allow location access in your browser settings.";
                break;
            case err.POSITION_UNAVAILABLE:
                errorMsg += "Location information is unavailable. Please try again.";
                break;
            case err.TIMEOUT:
                errorMsg += "The request to get your location timed out. Please try again.";
                break;
            default:
                errorMsg += "An unknown error occurred. Please try again.";
        }

        errorElement.textContent = errorMsg;
        errorElement.style.display = "block";

        initMap();
    }

    async function savePetrolPump(station) {
        console.log("savePetrolPump called for:", station);
        try {
            const payload = {
                id: station.id.toString(),
                name: station.name,
                lat: parseFloat(station.lat),
                lon: parseFloat(station.lon),
                distance: parseFloat(station.distance.toFixed(2)),
                address: getStationAddress(station.tags)
            };
            console.log("Sending to /api/petrol-pumps:", JSON.stringify(payload));

            const response = await fetch("/api/petrol-pumps", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const responseText = await response.text();
            console.log(`API response status: ${response.status}, body: ${responseText}`);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${responseText}`);
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                throw new Error(`Invalid JSON response: ${responseText}`);
            }

            if (!data.success) {
                throw new Error(data.error || "Failed to save pump");
            }

            console.log("Pump saved successfully, pump_id:", data.pump_id);
            errorElement.textContent = `Pump saved successfully: ${data.pump_id}`;
            errorElement.style.color = "green";
            errorElement.style.display = "block";
            return data.pump_id;
        } catch (error) {
            console.error("Error saving petrol pump:", error);
            errorElement.textContent = `Failed to save pump: ${error.message}`;
            errorElement.style.color = "red";
            errorElement.style.display = "block";
            throw error;
        }
    }

    function getStationAddress(tags) {
        if (tags.address) {
            return tags.address;
        } else {
            const street = tags["addr:street"] || "";
            const housenumber = tags["addr:housenumber"] || "";
            const city = tags["addr:city"] || "";
            const state = tags["addr:state"] || "";
            return `${housenumber} ${street}, ${city} ${state}`.trim() || "Address not available";
        }
    }

    function findNearbyPetrolPumps(location, searchQuery, displayName = "") {
        console.log("Finding nearby petrol pumps for location:", location);
        map = initMap(location, 14);

        if (userMarker) {
            map.removeLayer(userMarker);
        }

        userMarker = L.marker(location, {
            icon: L.divIcon({
                html: '<div style="background-color: #4285F4; border-radius: 50%; width: 20px; height: 20px; border: 3px solid white;"></div>',
                className: "user-marker",
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(map);

        userMarker.bindPopup(`<b>Your Location</b>`).openPopup();

        markers.forEach(marker => map.removeLayer(marker));
        markers = [];

        const radius = 5000;
        const overpassQuery = `
            [out:json];
            node(around:${radius},${location[0]},${location[1]})[amenity=fuel];
            out body;
        `;

        const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

        fetch(overpassUrl)
            .then(response => response.json())
            .then(data => {
                console.log("Overpass API response:", data);
                loadingElement.style.display = "none";

                if (data && data.elements && data.elements.length > 0) {
                    const stations = data.elements.map(element => {
                        const stationLocation = [element.lat, element.lon];
                        const distance = calculateDistance(location, stationLocation);

                        return {
                            id: element.id,
                            name: element.tags.name || element.tags.brand || `Petrol Station ${element.id}`,
                            lat: element.lat,
                            lon: element.lon,
                            distance: distance,
                            tags: element.tags
                        };
                    });

                    stations.sort((a, b) => a.distance - b.distance);

                    const nearestStations = stations.slice(0, 5);
                    console.log("Nearest stations:", nearestStations);

                    petrolPumpsList.innerHTML = "";

                    searchResultInfo.textContent = `Showing petrol pumps near your location`;

                    nearestStations.forEach((station, index) => {
                        const marker = L.marker([station.lat, station.lon], {
                            icon: createPumpIcon(index + 1)
                        }).addTo(map);

                        const popupContent = `
                            <div class="popup-title">${station.name}</div>
                            <div>${station.distance.toFixed(2)} km away</div>
                        `;

                        marker.bindPopup(popupContent);
                        markers.push(marker);

                        const pumpElement = document.createElement("div");
                        pumpElement.classList.add("petrol-pump");

                        const pumpIcon = document.createElement("div");
                        pumpIcon.classList.add("pump-icon");
                        pumpIcon.innerHTML = "⛽";
                        pumpElement.appendChild(pumpIcon);

                        const nameElement = document.createElement("div");
                        nameElement.classList.add("pump-name");
                        nameElement.textContent = `${index + 1}. ${station.name}`;
                        nameElement.style.cursor = "pointer";
                        nameElement.style.zIndex = "1000";
                        nameElement.style.position = "relative";
                        nameElement.style.userSelect = "none";
                        pumpElement.appendChild(nameElement);

                        const distanceElement = document.createElement("div");
                        distanceElement.classList.add("pump-distance");
                        distanceElement.textContent = `${station.distance.toFixed(2)} km away`;
                        pumpElement.appendChild(distanceElement);

                        if (station.tags.address || station.tags["addr:street"]) {
                            const addressElement = document.createElement("div");
                            addressElement.classList.add("pump-address");
                            const address = getStationAddress(station.tags);
                            addressElement.textContent = address;
                            pumpElement.appendChild(addressElement);
                        }

                        const buttonsContainer = document.createElement("div");
                        buttonsContainer.style.display = "flex";
                        buttonsContainer.style.gap = "10px";

                        const directionsLink = document.createElement("a");
                        directionsLink.classList.add("directions-btn");
                        directionsLink.href = `https://www.openstreetmap.org/directions?from=${location[0]},${location[1]}&to=${station.lat},${station.lon}`;
                        directionsLink.target = "_blank";
                        directionsLink.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                            </svg>
                            Get Directions
                        `;
                        buttonsContainer.appendChild(directionsLink);

                        const viewDetailsLink = document.createElement("a");
                        viewDetailsLink.classList.add("view-details-btn");
                        viewDetailsLink.href = `/petrol-pump-details?id=${encodeURIComponent(station.id)}&name=${encodeURIComponent(station.name)}&lat=${station.lat}&lon=${station.lon}&distance=${station.distance}`;
                        viewDetailsLink.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            View Details
                        `;
                        buttonsContainer.appendChild(viewDetailsLink);

                        pumpElement.appendChild(buttonsContainer);

                        nameElement.addEventListener("click", async function(e) {
                            e.stopPropagation();
                            e.preventDefault();
                            console.log(`Pump name clicked: ${station.name}, ID: ${station.id}, Time: ${new Date().toISOString()}`);
                            try {
                                for (let i = 0; i < 3; i++) {
                                    const pumpId = await savePetrolPump(station);
                                    console.log(`Pump saved (attempt ${i + 1}), pump_id: ${pumpId}`);
                                }
                                alert(`Pump ${station.name} saved 3 times successfully.`);
                            } catch (error) {
                                console.error("Failed to save pump:", error);
                                alert(`Failed to save pump ${station.name}: ${error.message}`);
                            }
                        });

                        console.log("Added pump element:", pumpElement.outerHTML);
                        petrolPumpsList.appendChild(pumpElement);
                    });

                    resultsElement.style.display = "block";
                } else {
                    errorElement.textContent = `No petrol pumps found near your location. Please try again or use the test button to add a pump.`;
                    errorElement.style.display = "block";
                }
            })
            .catch(error => {
                loadingElement.style.display = "none";
                errorElement.textContent = "Error finding petrol pumps. Please try again later.";
                errorElement.style.display = "block";
                console.error("Error fetching petrol pumps:", error);
            });
    }

    function calculateDistance(point1, point2) {
        const R = 6371;
        const dLat = deg2rad(point2[0] - point1[0]);
        const dLon = deg2rad(point2[1] - point1[1]);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(point1[0])) * Math.cos(deg2rad(point2[0])) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance;
    }

    function deg2rad(deg) {
        return deg * (Math.PI / 180);
    }

    initMap();
});