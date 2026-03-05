// file: vongquay.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, get, set, update, runTransaction, onValue, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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
window.isPoolEmpty = false; // Track if pool is completely exhausted

// Wheel Segments Config
const segments = [
    { label: "Voucher 30K", type: "special", color: "#fef08a", stroke: "#fbbf24", val: 30000 },
    { label: "Chúc May Mắn", type: "empty", color: "#ffffff", stroke: "#fbbf24" },
    { label: "Voucher 10K", type: "normal", color: "#fed7aa", stroke: "#fbbf24", val: 10000 },
    { label: "Cộng 5 Điểm", type: "points_5", color: "#bbf7d0", stroke: "#22c55e", val: 5 },
    { label: "Chúc May Mắn", type: "empty", color: "#ffffff", stroke: "#fbbf24" },
    { label: "Cộng 10 Điểm", type: "points_10", color: "#86efac", stroke: "#22c55e", val: 10 },
    { label: "Voucher 10K", type: "normal", color: "#fed7aa", stroke: "#fbbf24", val: 10000 },
    { label: "Cộng 20 Điểm", type: "points_20", color: "#4ade80", stroke: "#22c55e", val: 20 }
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
                special: 1, // 1 voucher giam 30k
                normal_morning: 3,  // 3 voucher giam 10k sang (0h-12h)
                normal_afternoon: 4, // 4 voucher giam 10k trua (12h-18h)
                normal_evening: 3,   // 3 voucher giam 10k toi (18h-24h)
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
            const totalNormal = (data.normal_morning || 0) + (data.normal_afternoon || 0) + (data.normal_evening || 0);

            specialPoolCountEl.textContent = data.special || 0;
            normalPoolCountEl.textContent = totalNormal;

            // Limit completely if pool is 0
            if (data.special <= 0 && totalNormal <= 0) {
                window.isPoolEmpty = true;
                btnSpin.disabled = true;
                btnSpin.textContent = "HẾT VOUCHER";
                btnSpin.style.background = '#e4e4e7';
                updateConnectionStatus("Voucher trong hệ thống đã được phát hết. Hẹn gặp lại dịp khác!", "error");
            } else {
                window.isPoolEmpty = false;
                // We rely on checkDailyLimit to re-enable the button if they have spins
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

// 4. Check Daily
async function checkDailyLimit() {
    if (!currentUserId) return;
    const today = getTodayString();
    const historyRef = ref(database, `lucky_wheel/history/${today}/${currentUserId}`);

    onValue(historyRef, (snap) => {
        let freeSpins = 1;
        let bonusSpins = 0;
        let usedSpins = 0;

        if (snap.exists()) {
            const data = snap.val();
            if (data.bonusClaimed) {
                bonusSpins = 3; // claimed chatbot code = 3 extra spins
            }
            if (data.spinCount) {
                usedSpins = data.spinCount;
            }
        }

        const totalSpins = freeSpins + bonusSpins;
        const remainingSpins = totalSpins - usedSpins;

        if (window.isPoolEmpty) {
            btnSpin.disabled = true;
            btnSpin.textContent = "HẾT VOUCHER";
            btnSpin.style.background = '#e4e4e7';
            updateConnectionStatus("Voucher trong hệ thống đã được phát hết. Hẹn gặp lại dịp khác!", "error");
            return;
        }

        if (remainingSpins > 0) {
            btnSpin.disabled = false;
            btnSpin.textContent = `QUAY (Còn ${remainingSpins} Lượt)`;
            btnSpin.style.background = '';

            updateConnectionStatus("Nhấn QUAY để thử vận may hôm nay!", "info");
        } else {
            btnSpin.disabled = false; // still allow clicking to trigger popup
            btnSpin.textContent = "QUAY (HẾT LƯỢT)";
            btnSpin.style.background = '#e4e4e7';
            updateConnectionStatus("Bạn đã hết lượt quay ngày hôm nay.", "error");
        }
    });
}

// Hunt Spins Banner Handle
const btnHuntSpins = document.getElementById('btnHuntSpins');
if (btnHuntSpins) {
    btnHuntSpins.addEventListener('click', () => {
        showOutOfSpinsModal();
    });
}

function showOutOfSpinsModal() {
    const codeEl = document.getElementById('fbShareCode');
    const randomCode = 'TEARUS-' + Math.floor(100 + Math.random() * 900);
    if (codeEl) codeEl.textContent = randomCode;
    document.getElementById('outOfSpinsModal').classList.remove('hidden');
    document.getElementById('chatbotVerifyMsg').style.display = 'none';
    document.getElementById('chatbotCodeInput').value = '';
}

// Copy Code Button
const btnCopyFbCode = document.getElementById('btnCopyFbCode');
if (btnCopyFbCode) {
    btnCopyFbCode.addEventListener('click', () => {
        const code = document.getElementById('fbShareCode').textContent;

        // Fallback backward compatibility for older iOS
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(code).then(() => {
                alert("Đã copy mã thành công!");
                window.open('https://www.facebook.com/trasuatearus', '_blank');
            }).catch(err => {
                alert("Bạn vui lòng tự bôi đen copy đoạn mã trên nhé!");
                window.open('https://www.facebook.com/trasuatearus', '_blank');
            });
        } else {
            // Older browser fallback
            let textArea = document.createElement("textarea");
            textArea.value = code;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                alert("Đã copy mã thành công!");
            } catch (err) {
                alert("Bạn vui lòng tự bôi đen copy đoạn mã trên nhé!");
            }
            textArea.remove();
            window.open('https://www.facebook.com/trasuatearus', '_blank');
        }
    });
}

// Verify Chatbot Code
const btnVerifyChatbotCode = document.getElementById('btnVerifyChatbotCode');
if (btnVerifyChatbotCode) {
    btnVerifyChatbotCode.addEventListener('click', async () => {
        if (!currentUserId) return;
        const inputCode = document.getElementById('chatbotCodeInput').value.trim().toUpperCase();
        const msgEl = document.getElementById('chatbotVerifyMsg');

        if (!inputCode) {
            msgEl.textContent = "Vui lòng nhập mã từ Chatbot!";
            msgEl.style.color = "#ef4444";
            msgEl.style.display = "block";
            return;
        }

        try {
            const configSnap = await get(ref(database, 'config/chatbot_code'));
            const secretCode = configSnap.exists() ? configSnap.val() : '';

            if (inputCode === secretCode && secretCode !== '') {
                const today = getTodayString();
                const historyRef = ref(database, `lucky_wheel/history/${today}/${currentUserId}`);
                const hisSnap = await get(historyRef);

                if (hisSnap.exists() && hisSnap.val().bonusClaimed) {
                    msgEl.textContent = "Bạn đã dùng mã này trong hôm nay rồi!";
                    msgEl.style.color = "#ef4444";
                    msgEl.style.display = "block";
                    return;
                }

                // Claim bonus!
                await update(historyRef, {
                    bonusClaimed: true,
                    bonusTimestamp: serverTimestamp()
                });

                msgEl.textContent = "Chúc mừng! Bạn được cộng thêm 3 lượt quay!";
                msgEl.style.color = "#10b981";
                msgEl.style.display = "block";

                setTimeout(() => {
                    document.getElementById('outOfSpinsModal').classList.add('hidden');
                }, 1500);

            } else {
                msgEl.textContent = "Mã Chatbot không chính xác!";
                msgEl.style.color = "#ef4444";
                msgEl.style.display = "block";
            }
        } catch (e) {
            console.error("Lỗi verify mã", e);
            msgEl.textContent = "Lỗi: " + e.message;
            msgEl.style.color = "#ef4444";
            msgEl.style.display = "block";
        }
    });


    // 5. Spin Logic
    btnSpin.addEventListener('click', async () => {
        if (isSpinning || !currentUserId) return;

        // ----- Check Spin Limits First ------
        const today = getTodayString();
        const historyRef = ref(database, `lucky_wheel/history/${today}/${currentUserId}`);
        const hisSnap = await get(historyRef);

        let freeSpins = 1;
        let bonusSpins = 0;
        let usedSpins = 0;

        if (hisSnap.exists()) {
            const data = hisSnap.val();
            if (data.bonusClaimed) bonusSpins = 6;
            if (data.spinCount) usedSpins = data.spinCount;
        }

        const totalSpins = freeSpins + bonusSpins;
        const remainingSpins = totalSpins - usedSpins;

        if (remainingSpins <= 0) {
            showOutOfSpinsModal();
            return;
        }
        // ------------------------------------

        isSpinning = true;
        btnSpin.disabled = true;
        btnSpin.style.background = '#e4e4e7';

        updateConnectionStatus("Đang quay...");

        // --- NEW STRATEGIC PROBABILITY ENGINE ---
        const currentHour = new Date().getHours();

        let targetProbSpecial = 0; // 30k
        let targetProbNormal = 0;  // 10k
        let targetProbPoints = 0;  // 5, 10, 20
        // The rest is 'empty'

        if (usedSpins === 0) {
            // Lượt 1 (Bait): Kéo qua Fanpage
            targetProbSpecial = 0.001; // 0.1%
            targetProbNormal = 0.004;  // 0.4%
            targetProbPoints = 0.05;   // 5% 
        } else {
            // Lượt VIP (Đã lấy code Fanpage)
            targetProbSpecial = 0.005; // 0.5%
            targetProbNormal = 0.080;  // 8.0%
            targetProbPoints = 0.300;  // 30%

            // Cơ chế chạy chốt cuối ngày: Sau 20:00 buff tỷ lệ xả x2
            const poolRefTest = ref(database, 'lucky_wheel/pool');
            const snapPool = await get(poolRefTest);
            if (snapPool.exists() && currentHour >= 20) {
                const poolT = snapPool.val();
                const remaining = (poolT.special || 0) + (poolT.normal_morning || 0) + (poolT.normal_afternoon || 0) + (poolT.normal_evening || 0);
                if (remaining >= 5) {
                    targetProbNormal = 0.20; // 20%
                }
            }
        }

        // Tắt giải 30k nếu chưa đến 18:00
        if (currentHour < 18) {
            targetProbSpecial = 0;
        }

        // Roll the dice
        const rand = Math.random();
        let intendedPrize = 'empty';

        if (rand <= targetProbSpecial) {
            intendedPrize = 'special';
        } else if (rand <= (targetProbSpecial + targetProbNormal)) {
            intendedPrize = 'normal';
        } else if (rand <= (targetProbSpecial + targetProbNormal + targetProbPoints)) {
            // Pick a point tier randomly [5, 10, 20] -> Approx weights: 5(50%), 10(35%), 20(15%)
            const ptRand = Math.random();
            if (ptRand <= 0.50) intendedPrize = 'points_5';
            else if (ptRand <= 0.85) intendedPrize = 'points_10';
            else intendedPrize = 'points_20';
        } else {
            intendedPrize = 'empty';
        }

        try {
            let actualPrize = 'empty';
            let prizeLabel = '';
            let discountType = '';
            let discountValue = 0;

            const poolRef = ref(database, 'lucky_wheel/pool');
            const transResult = await runTransaction(poolRef, (currentData) => {
                if (currentData === null) return currentData;

                // Time gate logic for 10K
                let targetNormalPool = 'normal_morning';
                if (currentHour >= 12 && currentHour < 18) targetNormalPool = 'normal_afternoon';
                else if (currentHour >= 18) targetNormalPool = 'normal_evening';

                // Handle out of stock constraints
                if (intendedPrize === 'special' && currentData.special <= 0) {
                    intendedPrize = 'empty'; // fallback
                }

                if (intendedPrize === 'normal' && (currentData[targetNormalPool] || 0) <= 0) {
                    intendedPrize = 'empty'; // fallback
                }

                // Final Update in DB
                if (intendedPrize === 'special' && currentData.special > 0) {
                    currentData.special--;
                } else if (intendedPrize === 'normal' && currentData[targetNormalPool] > 0) {
                    currentData[targetNormalPool]--;
                }

                return currentData;
            });

            let earnedPointsVal = 0;
            if (transResult.committed || intendedPrize === 'empty' || intendedPrize.startsWith('points_')) {
                actualPrize = intendedPrize;
                if (actualPrize === 'special') {
                    prizeLabel = 'Voucher 30K';
                    discountType = 'fixed';
                    discountValue = 30000;
                } else if (actualPrize === 'normal') {
                    prizeLabel = 'Voucher 10K';
                    discountType = 'fixed';
                    discountValue = 10000;
                } else if (actualPrize.startsWith('points_')) {
                    earnedPointsVal = parseInt(actualPrize.split('_')[1]);
                    prizeLabel = `Cộng ${earnedPointsVal} Điểm`;
                }
            }

            // Save history (increment spins)
            let currentSpinHistory = hisSnap.exists() ? hisSnap.val() : {};
            if (!currentSpinHistory.spinCount) currentSpinHistory.spinCount = 0;
            currentSpinHistory.spinCount += 1;
            currentSpinHistory.lastSpinTimestamp = serverTimestamp();

            await update(historyRef, currentSpinHistory);

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

                if (earnedPointsVal > 0) {
                    // Grant Points directly
                    const userRef = ref(database, `users/${currentUserId}/points`);
                    await runTransaction(userRef, (currentPoints) => {
                        return (currentPoints || 0) + earnedPointsVal;
                    });
                } else {
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
            }

            // Animate Wheel
            animateWheelTarget(actualPrize, prizeLabel, actualPrize !== 'empty' ? voucherId : null);

        } catch (e) {
            console.error(e);
            if (e.message === 'ALREADY_SPUN') {
                updateConnectionStatus("Bạn đã quay vòng xoay hôm nay rồi!", "error");
            } else {
                updateConnectionStatus("Lỗi HH: " + (e.message || "Unknown error"), "error");
                isSpinning = false;
                btnSpin.disabled = false;
                btnSpin.style.background = '';
                btnSpin.textContent = "THỬ LẠI";
            }
        }
    });
}

function animateWheelTarget(actualPrize, prizeLabel, voucherId) {
    // Determine which segment to stop on based on prize
    // Special index: 0
    // Normal indexes: 2, 4, 6
    // Empty indexes: 1, 3, 5, 7

    let targetIndexes = [];
    if (actualPrize === 'special') targetIndexes = [0]; // Voucher 30K
    else if (actualPrize === 'normal') targetIndexes = [2, 6]; // Voucher 10K (slot 2, 6)
    else if (actualPrize === 'points_5') targetIndexes = [3]; // Cộng 5 Điểm (slot 3)
    else if (actualPrize === 'points_10') targetIndexes = [5]; // Cộng 10 Điểm (slot 5)
    else if (actualPrize === 'points_20') targetIndexes = [7]; // Cộng 20 Điểm (slot 7)
    else targetIndexes = [1, 4]; // Chúc May Mắn (slot 1, 4)

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
        // Do not auto re-enable, wait for listener to check limit naturally
    }, 5100);
}

function showPrizeResult(type, label, voucherId) {
    if (type === 'empty') {
        document.getElementById('noPrizeModal').classList.remove('hidden');
    } else {
        if (type.startsWith('points_')) {
            document.getElementById('prizeTitle').textContent = "Tích Điểm Thành Đạt!";
            document.getElementById('prizeTitle').style.color = "#22c55e";
            document.getElementById('prizeDesc').textContent = `Bạn đã quay trúng ${label} vào tài khoản thẻ thành viên.`;

            const btnUseNow = document.getElementById('btnUseNow');
            if (btnUseNow) btnUseNow.style.display = 'none'; // No voucher to use
        } else {
            document.getElementById('prizeTitle').textContent = type === 'special' ? "Giải Đặc Biệt!" : "Chúc Mừng Bạn!";
            document.getElementById('prizeTitle').style.color = type === 'special' ? "#8b5cf6" : "#ef4444";
            document.getElementById('prizeDesc').textContent = `Bạn đã trúng 1 Voucher ${label}.`;

            const btnUseNow = document.getElementById('btnUseNow');
            if (btnUseNow && voucherId) {
                btnUseNow.style.display = 'inline-block';
                btnUseNow.href = `order.html?voucher=${voucherId}`;
            }
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
    if (!confirm("Hệ thống sẽ xóa TẤT CẢ danh sách trúng thưởng, lịch sử quay của TẤT CẢ TÀI KHOẢN, và khôi phục mốc Voucher (1 Đặc Biệt, 10 Thường) để test lại từ đầu. Đồng ý?")) return;
    try {
        const today = getTodayString();
        // Xóa lịch sử quay của TẤT CẢ mọi thành viên trong hôm nay
        await set(ref(database, `lucky_wheel/history/${today}`), null);

        // Xóa danh sách trúng thưởng public
        await set(ref(database, 'lucky_wheel/winners'), null);

        // Reset lượng voucher trong pool về lại phễu 200 lượt/ngày
        await set(ref(database, 'lucky_wheel/pool'), {
            special: 1,
            normal_morning: 3,
            normal_afternoon: 4,
            normal_evening: 3,
            last_reset_date: today
        });

        updateConnectionStatus("Đã reset! Đang làm mới hệ thống...");
        setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
        updateConnectionStatus("Lỗi khi reset", "error");
    }
});
