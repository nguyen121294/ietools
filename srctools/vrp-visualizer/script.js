/**
 * VRP Route Visualizer Logic - Refined Version
 */

document.addEventListener("DOMContentLoaded", () => {
    // --- Elements ---
    const canvas = document.getElementById('vrp-canvas');
    const coordsInput = document.getElementById('csv-coordinates');
    const routesInput = document.getElementById('csv-routes');
    const drawBtn = document.getElementById('draw-btn');
    const downloadImgBtn = document.getElementById('download-img');
    const chartTitleInput = document.getElementById('chart-title');
    const routeColorsList = document.getElementById('route-colors-list');
    const routeColorsContainer = document.getElementById('route-colors-container');
    const emptyState = document.getElementById('empty-state');
    const vrpStats = document.getElementById('vrp-stats');

    // Stats elements
    const statNodes = document.getElementById('stat-nodes');
    const statRoutes = document.getElementById('stat-routes');
    const statTrucks = document.getElementById('stat-trucks');
    const statBounds = document.getElementById('stat-bounds');

    // Templates
    const downloadTemplateCoords = document.getElementById('download-template-coords');
    const downloadTemplateRoutes = document.getElementById('download-template-routes');

    // --- State ---
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

    // --- Drawing Logic ---
    function draw(targetCanvas = canvas, isExport = false) {
        if (!coordinates.length) return;

        const targetCtx = targetCanvas.getContext('2d');
        const w = targetCanvas.width;
        const h = targetCanvas.height;

        // Constants based on mode
        const bg = isExport ? '#ffffff' : '#020617';
        const textColor = isExport ? '#000000' : '#ffffff';
        const axisColor = isExport ? '#475569' : '#94a3b8';

        // Clear & Background
        targetCtx.fillStyle = bg;
        targetCtx.fillRect(0, 0, w, h);

        if (!isExport) {
            emptyState.classList.add('hidden');
            vrpStats.classList.remove('hidden');
        }

        // Setup Bounds & Padding
        const padding = 80;
        const xCoords = coordinates.map(c => parseFloat(c['X-coord']));
        const yCoords = coordinates.map(c => parseFloat(c['Y-coord']));

        const minX = Math.min(...xCoords);
        const maxX = Math.max(...xCoords);
        const minY = Math.min(...yCoords);
        const maxY = Math.max(...yCoords);

        // Add buffer to bounds for better visualization
        const marginX = (maxX - minX) * 0.1 || 5;
        const marginY = (maxY - minY) * 0.1 || 5;

        const bMinX = minX - marginX;
        const bMaxX = maxX + marginX;
        const bMinY = minY - marginY;
        const bMaxY = maxY + marginY;

        const rangeX = bMaxX - bMinX;
        const rangeY = bMaxY - bMinY;

        const scaleX = (w - padding * 2) / rangeX;
        const scaleY = (h - padding * 2) / rangeY;

        const getCanvasCoord = (x, y) => ({
            x: padding + (x - bMinX) * scaleX,
            y: h - (padding + (y - bMinY) * scaleY)
        });

        // 1. Draw Axes
        drawAxes(targetCtx, w, h, padding, bMinX, bMaxX, bMinY, bMaxY, getCanvasCoord, axisColor, textColor);

        // 2. Draw Title
        targetCtx.fillStyle = textColor;
        targetCtx.font = `bold ${isExport ? '24px' : '20px'} "Space Grotesk"`;
        targetCtx.textAlign = 'center';
        targetCtx.fillText(chartTitleInput.value, w / 2, 40);

        // 3. Update Visual Stats (only on screen)
        if (!isExport) {
            statNodes.textContent = coordinates.length;
            statRoutes.textContent = routes.length;
            statTrucks.textContent = new Set(routes.map(r => r.Truck)).size;
            statBounds.textContent = `${Math.round(maxX)},${Math.round(maxY)}`;
        }

        // 4. Draw Routes
        routes.forEach(route => {
            const settings = routeSettings[route.RouteID];
            const color = settings ? settings.color : '#ffffff';
            targetCtx.strokeStyle = color;
            targetCtx.lineWidth = isExport ? 3 : 2;

            for (let i = 0; i < route.Nodes.length - 1; i++) {
                const fromNode = coordinates.find(c => c.ID == route.Nodes[i]);
                const toNode = coordinates.find(c => c.ID == route.Nodes[i + 1]);

                if (fromNode && toNode) {
                    const start = getCanvasCoord(parseFloat(fromNode['X-coord']), parseFloat(fromNode['Y-coord']));
                    const end = getCanvasCoord(parseFloat(toNode['X-coord']), parseFloat(toNode['Y-coord']));

                    targetCtx.beginPath();
                    targetCtx.moveTo(start.x, start.y);
                    targetCtx.lineTo(end.x, end.y);
                    targetCtx.stroke();

                    drawArrowhead(targetCtx, start.x, start.y, end.x, end.y, isExport ? 12 : 10, color);
                }
            }
        });

        // 5. Draw Nodes
        coordinates.forEach(node => {
            const pos = getCanvasCoord(parseFloat(node['X-coord']), parseFloat(node['Y-coord']));
            const isDepot = node.Type.toLowerCase() === 'depot';

            // Find which route this node belongs to for shape (except depot)
            let shape = 'circle';
            if (!isDepot) {
                const route = routes.find(r => r.Nodes.slice(1, -1).some(id => id.toString() === node.ID.toString()));
                if (route) shape = routeSettings[route.RouteID].shape;
            }

            targetCtx.fillStyle = isDepot ? '#ef4444' : '#137fec';
            targetCtx.strokeStyle = isExport ? '#000000' : '#ffffff';
            targetCtx.lineWidth = 1;

            drawShape(targetCtx, pos.x, pos.y, isDepot ? 10 : 6, isDepot ? 'rect' : shape);

            // Label
            targetCtx.fillStyle = isExport ? '#475569' : '#94a3b8';
            targetCtx.font = 'bold 10px monospace';
            targetCtx.textAlign = 'center';
            targetCtx.fillText(node.ID, pos.x, pos.y - (isDepot ? 18 : 15));
        });

        // 6. Draw Legend
        drawLegend(targetCtx, w, h, isExport, textColor);
    }

    function drawAxes(ctx, w, h, p, minX, maxX, minY, maxY, getCoord, axisColor, textColor) {
        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1;

        // Axes Lines
        ctx.beginPath();
        ctx.moveTo(p, p - 20); // Y extension
        ctx.lineTo(p, h - p); // Y axis
        ctx.lineTo(w - p + 20, h - p); // X axis
        ctx.stroke();

        // Labels
        ctx.fillStyle = textColor;
        ctx.font = '11px monospace';

        // Y Labels
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 5; i++) {
            const val = minY + (maxY - minY) * (i / 5);
            const pos = getCoord(minX, val);
            ctx.fillText(Math.round(val), pos.x - 10, pos.y);
            ctx.beginPath();
            ctx.moveTo(pos.x - 5, pos.y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        }

        // X Labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i <= 5; i++) {
            const val = minX + (maxX - minX) * (i / 5);
            const pos = getCoord(val, minY);
            ctx.fillText(Math.round(val), pos.x, pos.y + 10);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(pos.x, pos.y + 5);
            ctx.stroke();
        }
    }

    function drawLegend(ctx, w, h, isExport, textColor) {
        const legendX = w - 160;
        const legendY = 60;
        const itemHeight = 25;

        // Background Box
        ctx.fillStyle = isExport ? 'rgba(255,255,255,0.9)' : 'rgba(15, 23, 42, 0.8)';
        ctx.strokeStyle = isExport ? '#cbd5e1' : '#334155';
        ctx.lineWidth = 1;
        const legendH = 30 + (routes.length + 1) * itemHeight;

        ctx.fillRect(legendX, legendY, 150, legendH);
        ctx.strokeRect(legendX, legendY, 150, legendH);

        ctx.fillStyle = textColor;
        ctx.font = 'bold 12px "Space Grotesk"';
        ctx.textAlign = 'left';
        ctx.fillText('CHÚ THÍCH', legendX + 10, legendY + 20);

        // Depot entry
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(legendX + 10, legendY + 40, 10, 10);
        ctx.fillStyle = textColor;
        ctx.font = '10px "Space Grotesk"';
        ctx.fillText('Kho (Depot)', legendX + 30, legendY + 48);

        // Route entries
        routes.forEach((r, i) => {
            const y = legendY + 40 + (i + 1) * itemHeight;
            const settings = routeSettings[r.RouteID];
            if (!settings) return;

            ctx.fillStyle = settings.color;
            ctx.strokeStyle = isExport ? '#000000' : '#ffffff';
            ctx.lineWidth = 0.5;
            drawShape(ctx, legendX + 15, y + 5, 5, settings.shape);

            ctx.fillStyle = textColor;
            ctx.fillText(`R${r.RouteID}: ${r.Truck}`, legendX + 30, y + 10);
        });
    }

    function drawArrowhead(ctx, fromX, fromY, toX, toY, size, color) {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const offset = 8; // Don't draw exactly into the node center
        const arrowX = toX - offset * Math.cos(angle);
        const arrowY = toY - offset * Math.sin(angle);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - size * Math.cos(angle - Math.PI / 6), arrowY - size * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(arrowX - size * Math.cos(angle + Math.PI / 6), arrowY - size * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
    }

    function drawShape(ctx, x, y, size, shape) {
        ctx.beginPath();
        if (shape === 'circle') ctx.arc(x, y, size, 0, Math.PI * 2);
        else if (shape === 'rect' || shape === 'square') ctx.rect(x - size, y - size, size * 2, size * 2);
        else if (shape === 'triangle') {
            ctx.moveTo(x, y - size);
            ctx.lineTo(x - size, y + size);
            ctx.lineTo(x + size, y + size);
            ctx.closePath();
        } else if (shape === 'star') {
            for (let i = 0; i < 5; i++) {
                ctx.lineTo(Math.cos((18 + i * 72) / 180 * Math.PI) * size + x,
                    -Math.sin((18 + i * 72) / 180 * Math.PI) * size + y);
                ctx.lineTo(Math.cos((54 + i * 72) / 180 * Math.PI) * (size / 2) + x,
                    -Math.sin((54 + i * 72) / 180 * Math.PI) * (size / 2) + y);
            }
            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
    }

    // --- Color & Shape Management ---
    function updateColorPanel() {
        routeColorsList.innerHTML = '';
        if (routes.length > 0) {
            routeColorsContainer.classList.remove('hidden');
            routes.forEach((route, index) => {
                const current = routeSettings[route.RouteID] || {
                    color: defaultColors[index % defaultColors.length],
                    shape: 'circle'
                };
                routeSettings[route.RouteID] = current;

                const div = document.createElement('div');
                div.className = 'p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3';
                div.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-300">Route ${route.RouteID} (${route.Truck})</span>
                        <input type="color" value="${current.color}" class="w-8 h-6 bg-transparent border-0 cursor-pointer">
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-[10px] text-slate-500 uppercase font-bold">Hình dạng:</label>
                        <select class="ie-input flex-1 text-[10px] py-1 bg-slate-900 border-slate-700">
                            ${shapes.map(s => `<option value="${s.id}" ${current.shape === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                    </div>
                `;

                div.querySelector('input').addEventListener('input', (e) => {
                    routeSettings[route.RouteID].color = e.target.value;
                    draw();
                });

                div.querySelector('select').addEventListener('change', (e) => {
                    routeSettings[route.RouteID].shape = e.target.value;
                    draw();
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

        if (coordinates.length) draw();
        else alert("Vui lòng tải lên file tọa độ trước!");
    });

    chartTitleInput.addEventListener('input', () => draw());

    downloadImgBtn.addEventListener('click', () => {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 1200;
        exportCanvas.height = 900;

        draw(exportCanvas, true);

        const link = document.createElement('a');
        link.download = `${chartTitleInput.value.replace(/\s+/g, '_')}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    });

    // --- Template Downloads ---
    downloadTemplateCoords.addEventListener('click', () => {
        const content = "ID,Type,Name,X-coord,Y-coord\n0,depot,Kho_Chinh,3,2\n1,customer,Khach_A,4,5\n2,customer,Khach_B,10,3\n3,customer,Khach_C,8,8\n4,customer,Khach_D,1,10";
        downloadCSV("template_coordinates.csv", content);
    });

    downloadTemplateRoutes.addEventListener('click', () => {
        const content = "RouteID,Route,Truck\n1,\"[0,1,2,0]\",Xe_Tai_1\n2,\"[0,3,4,0]\",Xe_Tai_2";
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
