// calculator.js - EOQ Tool

// Biến toàn cục để lưu chart instance (tránh tạo nhiều chart chồng)
let eoqChartInstance = null;

function calculateEOQ() {
    const D = parseFloat(document.getElementById('demand').value);
    const S = parseFloat(document.getElementById('orderCost').value);
    const H = parseFloat(document.getElementById('holdingCost').value);
    const period = document.getElementById('period').value;

    const resultEl = document.getElementById('result');
    const detailedEl = document.getElementById('detailed-results');

    if (isNaN(D) || isNaN(S) || isNaN(H) || D <= 0 || S <= 0 || H <= 0) {
        resultEl.innerHTML = 'Vui lòng nhập đầy đủ các giá trị > 0';
        resultEl.classList.add('text-red-600');
        detailedEl.innerHTML = '';
        if (eoqChartInstance) eoqChartInstance.destroy(); // xóa chart cũ nếu có
        return;
    }

    const eoq = Math.sqrt((2 * D * S) / H);
    const eoqRounded = Math.round(eoq);

    // Các chỉ số bổ sung
    const cycleInventory = eoq / 2;
    const numOrders      = D / eoq;
    const totalOrderingCost = numOrders * S;
    const totalHoldingCost  = cycleInventory * H;
    const totalCost      = totalOrderingCost + totalHoldingCost;
    const turnover       = D / cycleInventory;          // = 2D / EOQ
    const avgFlowTime    = 1 / turnover;

    resultEl.innerHTML = `
        EOQ ≈ ${eoq.toFixed(2)} đơn vị<br>
        <span class="text-base">→ Khuyến nghị đặt khoảng <strong>${eoqRounded}</strong> đơn vị mỗi lần</span>
    `;
    resultEl.classList.remove('text-red-600');

    // Hiển thị chi tiết các chỉ số + biểu đồ
    detailedEl.innerHTML = `
        <div class="ie-card">
            <h3 class="ie-section-title">Kết quả chi tiết</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 text-sm">
                <div>
                    <p class="font-semibold">Cycle Inventory (Tồn kho trung bình)</p>
                    <p class="text-primary text-lg">${cycleInventory.toFixed(2)} đơn vị</p>
                    <p class="text-xs mt-1 opacity-80">Công thức: <span class="font-mono">EOQ / 2</span></p>
                </div>
                <div>
                    <p class="font-semibold">Số lần đặt hàng trong kỳ</p>
                    <p class="text-primary text-lg">${numOrders.toFixed(2)} lần</p>
                    <p class="text-xs mt-1 opacity-80">Công thức: <span class="font-mono">D / EOQ</span></p>
                </div>
                <div>
                    <p class="font-semibold">Tổng chi phí đặt hàng</p>
                    <p class="text-primary text-lg">${totalOrderingCost.toLocaleString('vi-VN')} VNĐ</p>
                    <p class="text-xs mt-1 opacity-80">Công thức: <span class="font-mono">(D / EOQ) × S</span></p>
                </div>
                <div>
                    <p class="font-semibold">Tổng chi phí lưu kho</p>
                    <p class="text-primary text-lg">${totalHoldingCost.toLocaleString('vi-VN')} VNĐ</p>
                    <p class="text-xs mt-1 opacity-80">Công thức: <span class="font-mono">(EOQ / 2) × H</span></p>
                </div>
                <div>
                    <p class="font-semibold">Tổng chi phí liên quan (Ordering + Holding)</p>
                    <p class="text-primary text-xl font-bold">${totalCost.toLocaleString('vi-VN')} VNĐ</p>
                    <p class="text-xs mt-1 opacity-80">Công thức: <span class="font-mono">(D / EOQ)×S + (EOQ/2)×H</span></p>
                </div>
                <div>
                    <p class="font-semibold">Vòng quay tồn kho (Inventory Turnover)</p>
                    <p class="text-primary text-lg">${turnover.toFixed(2)} lần/kỳ</p>
                    <p class="text-xs mt-1 opacity-80">Công thức: <span class="font-mono">D / (EOQ/2) = 2D / EOQ</span></p>
                </div>
                <div class="md:col-span-2">
                    <p class="font-semibold">Thời gian lưu kho trung bình (Average Flow Time)</p>
                    <p class="text-primary text-lg">${avgFlowTime.toFixed(2)} ${period}</p>
                    <p class="text-xs mt-1 opacity-80">Công thức: <span class="font-mono">1 / Turnover</span></p>
                </div>
            </div>

        </div>
    `;

    

    // Re-render MathJax nếu cần (vì có thể có công thức trong detailed)
    if (typeof MathJax !== 'undefined') {
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, detailedEl]);
    }

}