/**
 * VRP Map Visualizer (Lat/Lng) Logic
 */

document.addEventListener("DOMContentLoaded", () => {
    // --- Elements ---
    const mapContainer = document.getElementById('map');
    const coordsInput = document.getElementById('csv-coordinates');
    const routesInput = document.getElementById('csv-routes');
    const drawBtn = document.getElementById('draw-btn');
    const chartTitleInput = document.getElementById('chart-title');
    const routeColorsList = document.getElementById('route-colors-list');
    const routeColorsContainer = document.getElementById('route-colors-container');
    const emptyState = document.getElementById('empty-state');

    // Templates
    const downloadTemplateCoords = document.getElementById('download-template-coords');
    const downloadTemplateRoutes = document.getElementById('download-template-routes');

    // --- State ---
    let map = null;
    let markersLayer = L.layerGroup();
    let routesLayer = L.layerGroup();
    let legendControl = null;

    let coordinates = [];
    let routes = [];
    let routeSettings = {}; // RouteID -> { color, shape }

    const defaultColors = [
        '#137fec', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
        '#a855f7', '#64748b'
    ];

    const shapes = [
        { id: 'circle', name: 'Tròn' },
        { id: 'triangle', name: 'Tam giác' },
        { id: 'square', name: 'Vuông' },
        { id: 'star', name: 'Sao' }
    ];

    // --- Initialize Map ---
    function initMap() {
        if (map) return;

        map = L.map('map', {
            zoomControl: true,
            attributionControl: true
        }).setView([10.762622, 106.660172], 12); // Default to Saigon

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        markersLayer.addTo(map);
        routesLayer.addTo(map);

        // Add Fullscreen Control
        addFullscreenControl();
    }

    function addFullscreenControl() {
        const fsControl = L.control({ position: 'topleft' });
        fsControl.onAdd = function () {
            const btn = L.DomUtil.create('button', 'bg-slate-800 text-white p-2 rounded border border-slate-700 hover:bg-slate-700 shadow-lg');
            btn.innerHTML = `
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
            `;
            btn.title = "Xem toàn màn hình";
            btn.onclick = function () {
                const mapDiv = document.getElementById('map');
                if (!document.fullscreenElement) {
                    mapDiv.requestFullscreen().catch(err => {
                        alert(`Lỗi khi bật toàn màn hình: ${err.message}`);
                    });
                } else {
                    document.exitFullscreen();
                }
            };
            return btn;
        };
        fsControl.addTo(map);
    }

    // --- CSV Parsing ---
    function parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        return lines.slice(1).map(line => {
            const values = [];
            let current = '';
            let inQuotes = false;
            for (let char of line) {
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else current += char;
            }
            values.push(current.trim());

            const obj = {};
            headers.forEach((header, i) => {
                let val = values[i] ? values[i].replace(/"/g, '') : '';
                obj[header] = val;
            });
            return obj;
        });
    }

    async function readFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsText(file);
        });
    }

    // --- Custom Markers (SVG) ---
    function getSvgIcon(color, shape, label, isDepot = false) {
        const size = isDepot ? 30 : 24;
        let shapeSvg = '';

        if (isDepot) {
            shapeSvg = `<rect x="5" y="5" width="20" height="20" fill="#ef4444" stroke="white" stroke-width="2"/>`;
        } else {
            if (shape === 'circle') {
                shapeSvg = `<circle cx="15" cy="15" r="8" fill="${color}" stroke="white" stroke-width="2"/>`;
            } else if (shape === 'triangle') {
                shapeSvg = `<path d="M15 5 L5 25 L25 25 Z" fill="${color}" stroke="white" stroke-width="2"/>`;
            } else if (shape === 'square') {
                shapeSvg = `<rect x="7" y="7" width="16" height="16" fill="${color}" stroke="white" stroke-width="2"/>`;
            } else if (shape === 'star') {
                shapeSvg = `<path d="M15 2 L18 11 L28 11 L20 17 L23 26 L15 20 L7 26 L10 17 L2 11 L12 11 Z" fill="${color}" stroke="white" stroke-width="2"/>`;
            }
        }

        const html = `
            <div class="relative w-[30px] h-[40px]">
                <svg viewBox="0 0 30 30" class="w-full h-full drop-shadow-md">
                    ${shapeSvg}
                </svg>
                <div class="absolute -top-4 w-full text-center text-[10px] font-bold text-white bg-slate-800/80 px-1 rounded shadow-sm whitespace-nowrap left-1/2 -translate-x-1/2">
                    ${label}
                </div>
            </div>
        `;

        return L.divIcon({
            html: html,
            className: '',
            iconSize: [30, 40],
            iconAnchor: [15, 20]
        });
    }

    // --- Legend Control ---
    function updateLegend() {
        if (legendControl) legendControl.remove();

        legendControl = L.control({ position: 'topright' });

        legendControl.onAdd = function () {
            const div = L.DomUtil.create('div', 'map-legend shadow-2xl');
            let html = `<h4 class="text-xs font-extrabold mb-3 uppercase tracking-wider text-primary border-b border-slate-700 pb-2">${chartTitleInput.value}</h4>`;

            // Depot
            html += `
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-4 h-4 bg-red-500 border border-white shadow-sm"></div>
                    <span class="text-[11px] font-medium">Kho (Depot)</span>
                </div>
            `;

            // Routes
            routes.forEach(r => {
                const settings = routeSettings[r.RouteID];
                if (!settings) return;

                const opacity = settings.visible ? 'opacity-100' : 'opacity-40';
                const labelColor = settings.visible ? 'text-white' : 'text-slate-500 line-through';

                html += `
                    <div class="flex items-center gap-3 mb-2 ${opacity}">
                        <div class="w-4 h-4 flex items-center justify-center">
                             ${getLegendShapeSvg(settings.color, settings.shape)}
                        </div>
                        <span class="text-[11px] font-medium ${labelColor}">R${r.RouteID}: ${r.Truck}</span>
                    </div>
                `;
            });

            div.innerHTML = html;
            return div;
        };

        legendControl.addTo(map);
    }

    function getLegendShapeSvg(color, shape) {
        if (shape === 'circle') return `<svg class="w-3 h-3"><circle cx="6" cy="6" r="5" fill="${color}"/></svg>`;
        if (shape === 'triangle') return `<svg class="w-3 h-3"><path d="M6 1 L1 11 L11 11 Z" fill="${color}"/></svg>`;
        if (shape === 'square') return `<svg class="w-3 h-3"><rect x="1" y="1" width="10" height="10" fill="${color}"/></svg>`;
        if (shape === 'star') return `<svg class="w-3 h-3" viewBox="0 0 24 24"><path d="M12 2 L15 9 L23 9 L17 14 L19 22 L12 17 L5 22 L7 14 L1 9 L9 9 Z" fill="${color}"/></svg>`;
        return '';
    }

    // --- Main Update Logic ---
    function updateMap() {
        if (!coordinates.length) return;
        initMap();
        emptyState.classList.add('opacity-0');
        setTimeout(() => emptyState.classList.add('hidden'), 300);

        markersLayer.clearLayers();
        routesLayer.clearLayers();

        const latLngsList = [];

        // 1. Draw Markers
        coordinates.forEach(node => {
            const lat = parseFloat(node.Latitude);
            const lng = parseFloat(node.Longitude);
            if (isNaN(lat) || isNaN(lng)) return;

            const isDepot = node.Type.toLowerCase() === 'depot';
            let shape = 'circle';
            let color = '#137fec';
            let isVisible = true;

            if (!isDepot) {
                const route = routes.find(r => r.Nodes.slice(1, -1).some(id => id.toString() === node.ID.toString()));
                if (route) {
                    shape = routeSettings[route.RouteID].shape;
                    color = routeSettings[route.RouteID].color;
                    isVisible = routeSettings[route.RouteID].visible;
                } else {
                    // Node exists but not in any route? Default to visible
                    isVisible = true;
                }
            }

            if (!isVisible) return;

            const marker = L.marker([lat, lng], {
                icon: getSvgIcon(color, shape, node.ID, isDepot),
                title: node.Name || node.ID
            });

            marker.bindPopup(`<b>${node.Type.toUpperCase()}</b><br>ID: ${node.ID}<br>Name: ${node.Name || '-'}`);
            markersLayer.addLayer(marker);
            latLngsList.push([lat, lng]);
        });

        // 2. Draw Routes
        routes.forEach(route => {
            const settings = routeSettings[route.RouteID];
            if (!settings.visible) return;

            const routeLatLngs = [];

            route.Nodes.forEach(nodeId => {
                const node = coordinates.find(c => c.ID.toString() === nodeId.toString());
                if (node) {
                    routeLatLngs.push([parseFloat(node.Latitude), parseFloat(node.Longitude)]);
                }
            });

            if (routeLatLngs.length > 1) {
                const polyline = L.polyline(routeLatLngs, {
                    color: settings.color,
                    weight: 4,
                    opacity: 0.8,
                    lineJoin: 'round'
                });

                polyline.bindPopup(`<b>Route ${route.RouteID}</b><br>Truck: ${route.Truck}`);
                routesLayer.addLayer(polyline);
            }
        });

        if (latLngsList.length) {
            map.invalidateSize();
            // Only auto-fit if we have visible data
            if (latLngsList.length > 0) {
                map.fitBounds(L.latLngBounds(latLngsList), { padding: [50, 50] });
            }
        }

        updateLegend();
    }

    // --- Color & Shape Management ---
    function updateColorPanel() {
        routeColorsList.innerHTML = '';
        if (routes.length > 0) {
            routeColorsContainer.classList.remove('hidden');
            routes.forEach((route, index) => {
                const current = routeSettings[route.RouteID] || {
                    color: defaultColors[index % defaultColors.length],
                    shape: 'circle',
                    visible: true
                };
                routeSettings[route.RouteID] = current;

                const div = document.createElement('div');
                div.className = `p-3 bg-slate-800/50 rounded-lg border transition-all duration-200 ${current.visible ? 'border-slate-700' : 'border-slate-800 opacity-60'}`;
                div.innerHTML = `
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                            <input type="checkbox" ${current.visible ? 'checked' : ''} class="w-4 h-4 rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary focus:ring-offset-slate-800">
                            <span class="text-xs font-bold ${current.visible ? 'text-slate-300' : 'text-slate-500'}">Route ${route.RouteID}</span>
                        </div>
                        <input type="color" value="${current.color}" class="w-8 h-6 bg-transparent border-0 cursor-pointer ${!current.visible ? 'pointer-events-none grayscale' : ''}">
                    </div>
                    <div class="flex items-center gap-2 ${!current.visible ? 'pointer-events-none' : ''}">
                        <label class="text-[10px] text-slate-500 uppercase font-bold">Icon:</label>
                        <select class="ie-input flex-1 text-[10px] py-1 bg-slate-900 border-slate-700">
                            ${shapes.map(s => `<option value="${s.id}" ${current.shape === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                    </div>
                `;

                div.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
                    routeSettings[route.RouteID].visible = e.target.checked;
                    updateColorPanel(); // Refresh UI styles
                    updateMap();
                });

                div.querySelector('input[type="color"]').addEventListener('input', (e) => {
                    routeSettings[route.RouteID].color = e.target.value;
                    updateMap();
                });

                div.querySelector('select').addEventListener('change', (e) => {
                    routeSettings[route.RouteID].shape = e.target.value;
                    updateMap();
                });

                routeColorsList.appendChild(div);
            });
        }
    }

    // --- Buttons & Events ---
    drawBtn.addEventListener('click', async () => {
        if (coordsInput.files.length) {
            const text = await readFile(coordsInput.files[0]);
            coordinates = parseCSV(text);
        }

        if (routesInput.files.length) {
            const text = await readFile(routesInput.files[0]);
            const rawRoutes = parseCSV(text);
            routes = rawRoutes.map(r => {
                try {
                    return {
                        RouteID: r.RouteID,
                        Truck: r.Truck,
                        Nodes: JSON.parse(r.Route.replace(/'/g, '"')).map(n => n.toString())
                    };
                } catch (e) {
                    return null;
                }
            }).filter(r => r !== null);
            updateColorPanel();
        }

        if (coordinates.length) updateMap();
        else alert("Vui lòng tải lên file tọa độ (Lat/Lng) trước!");
    });

    chartTitleInput.addEventListener('input', () => {
        if (map) updateLegend();
    });

    // --- Template Downloads ---
    downloadTemplateCoords.addEventListener('click', () => {
        const content = "ID,Type,Name,Latitude,Longitude\n0,depot,Kho_Trung_Tam,10.7937,106.6661\n1,customer,Diem_A,10.7812,106.6823\n2,customer,Diem_B,10.7626,106.6601\n3,customer,Diem_C,10.8015,106.6450\n4,customer,Diem_D,10.7720,106.6980";
        downloadCSV("template_map_coordinates.csv", content);
    });

    downloadTemplateRoutes.addEventListener('click', () => {
        const content = "RouteID,Route,Truck\n1,\"[0,1,2,0]\",Van_Truck_A\n2,\"[0,3,4,0]\",Van_Truck_B";
        downloadCSV("template_routes.csv", content);
    });

    function downloadCSV(name, content) {
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', name);
        link.click();
    }
});
