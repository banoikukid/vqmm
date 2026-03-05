// file: vongquay.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, get, set, runTransaction, onValue, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAwwtUtwGqXCyvgM4DVRQUsabwrgzjfDyc",
    authDomain: "vqmm-8a365.firebaseapp.com",
    projectId: "vqmm-8a365",
    storageBucket: "vqmm-8a365.firebasestorage.app",
    messagingSenderId: "124482176297",
    appId: "1:124482176297:web:35ae88be0af51c76516338",
    measurementId: "G-QD5NKBYHZV",
    databaseURL: "https://vqmm-8a365-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// DOM Elements
const authLoader = document.getElementById('authLoader');
const btnSpin = document.getElementById('btnSpin');
const btnResetTest = document.getElementById('btnResetTest');
const statusBox = document.getElementById('statusBox');
const statusText = document.getElementById('statusText');
const wheelCanvas = document.getElementById('wheelCanvas');
const wheel = document.getElementById('wheel');
const specialPoolCountEl = document.getElementById('specialPoolCount');
const normalPoolCountEl = document.getElementById('normalPoolCount');
const winnersListEl = document.getElementById('winnersList');

let currentUserId = null;
let currentUserInfo = null;
let currentRotation = 0;
let isSpinning = false;

// Wheel Segments Config
const segments = [
    { label: "Giảm 100%", type: "special", color: "#fef08a", stroke: "#fbbf24" },
    { label: "Chúc ML", type: "empty", color: "#ffffff", stroke: "#fbbf24" },
    { label: "Giảm 10K", type: "normal", color: "#fed7aa", stroke: "#fbbf24" },
    { label: "Chúc ML", type: "empty", color: "#ffffff", stroke: "#fbbf24" },
    { label: "Giảm 10K", type: "normal", color: "#fed7aa", stroke: "#fbbf24" },
    { label: "Chúc ML", type: "empty", color: "#ffffff", stroke: "#fbbf24" },
    { label: "Giảm 10K", type: "normal", color: "#fed7aa", stroke: "#fbbf24" },
    { label: "Chúc ML", type: "empty", color: "#ffffff", stroke: "#fbbf24" }
];

function drawWheel() {
    const ctx = wheelCanvas.getContext('2d');
    const width = wheelCanvas.width;
    const height = wheelCanvas.height;
    const radius = width / 2;
    const centerX = width / 2;
    const centerY = height / 2;
    const arc = Math.PI * 2 / segments.length;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < segments.length; i++) {
        const angle = i * arc;
        ctx.beginPath();
        ctx.fillStyle = segments[i].color;
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, angle, angle + arc, false);
        ctx.lineTo(centerX, centerY);
        ctx.fill();

        // Stroke
        ctx.lineWidth = 1;
        ctx.strokeStyle = segments[i].stroke;
        ctx.stroke();

        // Draw Text
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle + arc / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = (segments[i].type === 'special' || segments[i].type === 'normal') ? '#ef4444' : '#6b7280';
        ctx.font = 'bold 16px Outfit, sans-serif';
        // Adjust depending on text length so it fits near edge
        ctx.fillText(segments[i].label, radius - 20, 5);
        ctx.restore();
    }
}

drawWheel();

// Format Date string as YYYY-MM-DD to track daily limits
function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Update UI Connection Status
function updateConnectionStatus(msg, type = 'info') {
    statusText.innerHTML = `<strong>${msg}</strong>`;
    statusBox.className = 'status-box';
    if (type === 'error') statusBox.classList.add('error');
    if (type === 'warning') statusBox.classList.add('warning');
}

// 1. Auth Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        try {
            const snap = await get(ref(database, `users/${user.uid}`));
            currentUserInfo = snap.exists() ? snap.val() : { name: 'Vô Danh', email: user.email };

            // Generate pool if missing
            await ensurePoolExists();

            // Listen to Pool live
            setupLiveListeners();

            // Check if user has spun today
            await checkDailyLimit();

            authLoader.style.display = 'none';

        } catch (error) {
            console.error(error);
            updateConnectionStatus("Lỗi kết nối máy chủ.", "error");
            authLoader.style.display = 'none';
        }
    } else {
        window.location.href = "login.html";
    }
});

// 2. Ensure Pool or Auto-Reset if new day
async function ensurePoolExists() {
    const poolRef = ref(database, 'lucky_wheel/pool');
    const today = getTodayString();
    await runTransaction(poolRef, (currentData) => {
        if (currentData === null || currentData.last_reset_date !== today) {
            // First time ever, or new day started -> refill pool
            return {
                special: 1, // 1 voucher giam 100%
                normal: 10,  // 10 voucher giam 10k
                last_reset_date: today
            };
        }
        return currentData; // abort transaction, already exist for today
    });
}

// 3. Listeners
function setupLiveListeners() {
    // Listen to Pool counts
    onValue(ref(database, 'lucky_wheel/pool'), (snap) => {
        if (snap.exists()) {
            const data = snap.val();
            specialPoolCountEl.textContent = data.special || 0;
            normalPoolCountEl.textContent = data.normal || 0;

            // Limit completely if pool is 0
            if (data.special === 0 && data.normal === 0) {
                btnSpin.disabled = true;
                btnSpin.textContent = "HẾT VOUCHER";
                updateConnectionStatus("Voucher trong hệ thống đã được phát hết. Hẹn gặp lại dịp khác!", "error");
            }
        }
    });

    // Listen to Winners
    onValue(ref(database, 'lucky_wheel/winners'), (snap) => {
        winnersListEl.innerHTML = '';
        if (snap.exists()) {
            const data = snap.val();
            // Object to array, sort by timestamp new to old
            const arr = Object.keys(data).map(k => data[k]).sort((a, b) => b.timestamp - a.timestamp);

            arr.slice(0, 15).forEach(winner => {
                const li = document.createElement('li');
                li.className = 'winner-item';

                const isSpecial = winner.prizeType === 'special';
                const prizeCls = isSpecial ? 'winner-prize special' : 'winner-prize';
                const initial = (winner.name || 'U')[0].toUpperCase();

                const d = new Date(winner.timestamp);
                const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

                li.innerHTML = `
                    <div class="winner-info">
                        <div class="winner-avatar" style="${isSpecial ? 'background: #8b5cf6;' : ''}">${initial}</div>
                        <div class="winner-details">
                            <strong>${winner.name}</strong>
                            <small>${timeStr}</small>
                        </div>
                    </div>
                    <div class="${prizeCls}">${winner.prizeLabel}</div>
                `;
                winnersListEl.appendChild(li);
            });
        } else {
            winnersListEl.innerHTML = '<p style="text-align: center; color: #9ca3af; padding: 1rem;">Chưa có người trúng thưởng.</p>';
        }
    });
}

// 4. Check Daily (Tạm thời không giới hạn để Test)
async function checkDailyLimit() {
    updateConnectionStatus("Bạn được quay không giới hạn (Mở để người quản trị test)!");
    btnSpin.disabled = false;
    btnSpin.textContent = "QUAY";
}

// 5. Spin Logic
btnSpin.addEventListener('click', async () => {
    if (isSpinning || !currentUserId) return;
    isSpinning = true;
    btnSpin.disabled = true;
    btnSpin.style.background = '#e4e4e7';

    updateConnectionStatus("Đang xem xét kết quả...");

    // Probabilities (Điều chỉnh để Test)
    // 30% special, 30% normal, 40% empty
    const rand = Math.random();
    let intendedPrize = 'empty';
    if (rand <= 0.30) intendedPrize = 'special';
    else if (rand <= 0.60) intendedPrize = 'normal';

    const today = getTodayString();

    try {
        // Run transaction on Pool AND History at the same time to prevent race conditions
        // BUT firebase database requires transactions on a single node path.
        // We will lock the result by just verifying against history first quickly.

        // BỎ GIỚI HẠN: Kiểm tra history để test
        // const historyRef = ref(database, `lucky_wheel/history/${today}/${currentUserId}`);
        // const hisSnap = await get(historyRef);
        // if(hisSnap.exists()) {
        //     throw new Error("ALREADY_SPUN");
        // }

        let actualPrize = 'empty';
        let prizeLabel = '';
        let discountType = '';
        let discountValue = 0;

        const poolRef = ref(database, 'lucky_wheel/pool');
        const transResult = await runTransaction(poolRef, (currentData) => {
            if (currentData === null) return currentData;

            if (intendedPrize === 'special' && currentData.special > 0) {
                currentData.special--;
                return currentData;
            }
            if (intendedPrize === 'normal' && currentData.normal > 0) {
                currentData.normal--;
                return currentData;
            }

            // If we get here, the intendedPrize ran out of stock or we rolled 'empty'
            intendedPrize = 'empty';
            return; // abort transaction (write nothing, user gets empty)
        });

        if (transResult.committed || intendedPrize === 'empty') {
            actualPrize = intendedPrize;
            if (actualPrize === 'special') {
                prizeLabel = 'Giảm 100%';
                discountType = 'percent';
                discountValue = 100;
            } else if (actualPrize === 'normal') {
                prizeLabel = 'Giảm 10K';
                discountType = 'fixed';
                discountValue = 10000;
            }
        }

        // Save history to prevent double spin (Ghi đè - Bypass for unlimited)
        const historyRef = ref(database, `lucky_wheel/history/${today}/${currentUserId}`);
        await set(historyRef, {
            timestamp: serverTimestamp(),
            prize: actualPrize
        });

        // Generate Voucher ID first
        const voucherId = 'VQMM_' + Date.now().toString(36).toUpperCase();

        // Add to winners if won
        if (actualPrize !== 'empty') {
            await push(ref(database, 'lucky_wheel/winners'), {
                uid: currentUserId,
                name: currentUserInfo.name || 'Khách',
                prizeType: actualPrize,
                prizeLabel: prizeLabel,
                voucherId: voucherId,
                timestamp: Date.now()
            });

            // Grant Voucher to User Profile (Expires end of today)
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            await set(ref(database, `users/${currentUserId}/vouchers/${voucherId}`), {
                code: voucherId,
                discount_type: discountType,
                discount_value: discountValue,
                label: `Voucher ${prizeLabel} (Vòng Quay)`,
                origin: 'lucky_wheel',
                expiresAt: endOfDay.toISOString(),
                status: 'active',
                createdAt: new Date().toISOString()
            });
        }

        // Animate Wheel
        animateWheelTarget(actualPrize, prizeLabel, actualPrize !== 'empty' ? voucherId : null);

    } catch (e) {
        if (e.message === 'ALREADY_SPUN') {
            updateConnectionStatus("Bạn đã quay vòng xoay hôm nay rồi!", "error");
        } else {
            console.error(e);
            updateConnectionStatus("Lỗi hệ thống. Không thể quay lúc này.", "error");
            isSpinning = false;
            btnSpin.disabled = false;
        }
    }
});

function animateWheelTarget(actualPrize, prizeLabel, voucherId) {
    // Determine which segment to stop on based on prize
    // Special index: 0
    // Normal indexes: 2, 4, 6
    // Empty indexes: 1, 3, 5, 7

    let targetIndexes = [];
    if (actualPrize === 'special') targetIndexes = [0];
    else if (actualPrize === 'normal') targetIndexes = [2, 4, 6];
    else targetIndexes = [1, 3, 5, 7];

    // Pick random target index among available
    const targetIdx = targetIndexes[Math.floor(Math.random() * targetIndexes.length)];

    // Calculate angle to land on targetIdx
    // The top pointer is at 270 degrees (upwards).
    // The segments are drawn starting from 0 (right/east).
    // Segment size is 360 / 8 = 45 deg.
    // Segment 0 center is at 22.5 deg.
    // To make segment 0 point up, we need to rotate it so it aligns with 270 deg (modulo 360).
    // Instead of complex math, just use an offset.

    const sliceAngle = 360 / segments.length;
    // Magic offset to align the slice directly to the top pointer
    const targetAngle = targetIdx * sliceAngle;

    // Instead of adding a complex delta, we calculate the absolute next angle
    // based on our current base (currentRotation rounded down to nearest 360)
    const currentBase = Math.floor(currentRotation / 360) * 360;

    // We want to do 5 full spins PLUS the angle required to land on targetIdx
    // To land on targetIdx (which is at `targetAngle`), we need the wheel rotated by:
    // 360 - targetAngle - (sliceAngle / 2) + 270 (pointer is at top 270deg)

    let requiredRotation = 360 - targetAngle - (sliceAngle / 2) + 270;

    // Normalize to 0-360
    requiredRotation = requiredRotation % 360;

    // The absolute rotation to apply:
    const absoluteRotation = currentBase + (360 * 5) + requiredRotation;

    // Make sure we always spin forward by ensuring absoluteRotation is > currentRotation
    currentRotation = absoluteRotation > currentRotation ? absoluteRotation : absoluteRotation + 360;

    wheel.style.transform = `rotate(${currentRotation}deg)`;

    // Wait for css transition to finish (5s)
    setTimeout(() => {
        isSpinning = false;
        showPrizeResult(actualPrize, prizeLabel, voucherId);

        // Allow playing again for testing
        btnSpin.disabled = false;
        btnSpin.textContent = "TIẾP TỤC QUAY";
        btnSpin.style.background = '';
        updateConnectionStatus("Bạn có thể quay tiếp!", "info");
    }, 5100);
}

function showPrizeResult(type, label, voucherId) {
    if (type === 'empty') {
        document.getElementById('noPrizeModal').classList.remove('hidden');
    } else {
        document.getElementById('prizeTitle').textContent = type === 'special' ? "Giải Đặc Biệt!" : "Chúc Mừng Bạn!";
        document.getElementById('prizeTitle').style.color = type === 'special' ? "#8b5cf6" : "#ef4444";
        document.getElementById('prizeDesc').textContent = `Bạn đã trúng 1 Voucher ${label}.`;

        const btnUseNow = document.getElementById('btnUseNow');
        if (btnUseNow && voucherId) {
            btnUseNow.href = `order.html?voucher=${voucherId}`;
        }

        document.getElementById('prizeModal').classList.remove('hidden');

        // Confetti
        try {
            if (window.confetti) {
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 }
                });
            }
        } catch (e) { }
    }
}

window.closePrizeModal = function () {
    document.getElementById('prizeModal').classList.add('hidden');
};

// Reset feature for testing
btnResetTest.addEventListener('click', async () => {
    if (!currentUserId) return;
    if (!confirm("Hệ thống sẽ xóa TẤT CẢ danh sách trúng thưởng, lịch sử của bạn, và khôi phục mốc Voucher (1 Đặc Biệt, 10 Thường) để test lại từ đầu. Đồng ý?")) return;
    try {
        const today = getTodayString();
        // Xóa lịch sử quay của bản thân
        await set(ref(database, `lucky_wheel/history/${today}/${currentUserId}`), null);

        // Xóa danh sách trúng thưởng public
        await set(ref(database, 'lucky_wheel/winners'), null);

        // Khôi phục lại Kho Thưởng ban đầu
        await set(ref(database, 'lucky_wheel/pool'), {
            special: 1,
            normal: 10,
            last_reset_date: today
        });

        updateConnectionStatus("Đã reset! Đang làm mới hệ thống...");
        setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
        updateConnectionStatus("Lỗi khi reset", "error");
    }
});
