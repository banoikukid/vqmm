import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, get, update, push, set, remove, serverTimestamp, runTransaction, onValue, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const database = getDatabase(app);

// VIP Wheel Segments (Sum of degrees = 360)
// Enhanced Premium Colors & Styling
const vipSegments = [
    { label: "10 Ly Trà Sữa", type: "first", degrees: 18, color: '#fee171', stroke: '#eab308', textColor: '#c82027' },
    { label: "Voucher 5K", type: "third", degrees: 63, color: '#ffffff', stroke: '#cbd5e1', textColor: '#64748b' },
    { label: "Combo 3 Ly", type: "second", degrees: 36, color: '#bce3ff', stroke: '#cbd5e1', textColor: '#0d47a1' },
    { label: "Voucher 5K", type: "third", degrees: 63, color: '#fdeeec', stroke: '#f472b6', textColor: '#64748b' },
    { label: "10 Ly Trà Sữa", type: "first", degrees: 18, color: '#fee171', stroke: '#eab308', textColor: '#c82027' },
    { label: "Voucher 5K", type: "third", degrees: 63, color: '#ffffff', stroke: '#cbd5e1', textColor: '#64748b' },
    { label: "Combo 3 Ly", type: "second", degrees: 36, color: '#bce3ff', stroke: '#cbd5e1', textColor: '#0d47a1' },
    { label: "Voucher 5K", type: "third", degrees: 63, color: '#fdeeec', stroke: '#f472b6', textColor: '#64748b' }
];

let wheelRotation = 0;
let isSpinning = false;
let currentUserId = null;
let currentUserName = "Khách";

const btnVipSpin = document.getElementById('btnVipSpin');
const vipSpinStatus = document.getElementById('vipSpinStatus');
const vipWheelCanvas = document.getElementById('vipWheelCanvas');
const vipCtx = vipWheelCanvas ? vipWheelCanvas.getContext('2d') : null;

// Draw Wheel with premium aesthetics
function drawVipWheel() {
    if (!vipCtx) return;
    const width = vipWheelCanvas.width;
    const height = vipWheelCanvas.height;
    const radius = width / 2;
    const centerX = width / 2;
    const centerY = height / 2;

    vipCtx.clearRect(0, 0, width, height);

    // Initial orientation: first segment starts at top offset
    let startAngle = -112.5 * Math.PI / 180;

    for (let i = 0; i < vipSegments.length; i++) {
        const seg = vipSegments[i];
        const sliceAngle = (seg.degrees * Math.PI) / 180;

        vipCtx.beginPath();
        vipCtx.moveTo(centerX, centerY);
        vipCtx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle, false);
        vipCtx.lineTo(centerX, centerY);

        vipCtx.fillStyle = seg.color;
        vipCtx.fill();

        // Divider
        vipCtx.lineWidth = 1;
        vipCtx.strokeStyle = seg.stroke;
        vipCtx.stroke();

        // Draw Text
        vipCtx.save();
        vipCtx.translate(centerX, centerY);
        vipCtx.rotate(startAngle + sliceAngle / 2);
        vipCtx.textAlign = 'right';
        vipCtx.textBaseline = 'middle';

        vipCtx.fillStyle = seg.textColor;
        vipCtx.font = '900 16px Outfit, sans-serif';

        // Add text
        vipCtx.fillText(seg.label, radius - 20, 0);

        vipCtx.restore();

        startAngle += sliceAngle;
    }
}

if (vipWheelCanvas) {
    drawVipWheel();
}

// Auth Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        try {
            const snap = await get(ref(database, `users/${user.uid}`));
            if (snap.exists()) {
                currentUserName = snap.val().name || "Khách";
            }
        } catch (e) {
            console.error(e);
        }
    } else {
        currentUserId = null;
    }
});

// Calculate Max First Prizes based on time distribution (Week 1: 1, Week 2: 2, Week 3: 3, Week 4+: 5)
function getMaxFirstPrizes() {
    const day = new Date().getDate();
    if (day <= 7) return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    return 5;
}

// Calculate Max Second Prizes based on time distribution (Week 1: 2, Week 2: 5, Week 3: 7, Week 4+: 10)
function getMaxSecondPrizes() {
    const day = new Date().getDate();
    if (day <= 7) return 2;
    if (day <= 14) return 5;
    if (day <= 21) return 7;
    return 10;
}

function getMonthString() {
    const d = new Date();
    return `${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function handleVipSpin() {
    if (!currentUserId) {
        window.location.href = "login.html";
        return;
    }

    if (isSpinning) return;

    vipSpinStatus.textContent = "Đang kiểm tra điểm...";
    btnVipSpin.disabled = true;

    try {
        const userRef = ref(database, `users/${currentUserId}`);
        const userSnap = await get(userRef);

        if (!userSnap.exists()) {
            vipSpinStatus.textContent = "Không tìm thấy dữ liệu người dùng.";
            btnVipSpin.disabled = false;
            return;
        }

        const userData = userSnap.val();
        let currentPoints = parseInt(userData.points) || 0;

        if (currentPoints < 50) {
            vipSpinStatus.textContent = `Bạn chỉ có ${currentPoints}đ. Cần 50đ để tham gia!`;
            btnVipSpin.disabled = false;
            return;
        }

        // Deduct points safely
        await update(userRef, { points: currentPoints - 50 });

        // Log Point History
        await push(ref(database, `users/${currentUserId}/point_history`), {
            amount: 50,
            reason: `Quay Vòng Quay Siêu Cấp`,
            type: "spend",
            timestamp: serverTimestamp()
        });

        // Determine Prize Logic
        vipSpinStatus.textContent = "Đang quay...";
        isSpinning = true;
        const monthStr = getMonthString();
        const configRef = ref(database, `campaign_configs/${monthStr}`);

        let requestedType = 'third';
        const rand = Math.random() * 100;

        if (rand < 2.5) {
            requestedType = 'first';
        } else if (rand < 7.5) {
            requestedType = 'second';
        }

        const maxFirst = getMaxFirstPrizes();
        const maxSecond = getMaxSecondPrizes();
        let finalWonType = 'third'; // Fallback

        const txResult = await runTransaction(configRef, (currentData) => {
            if (currentData === null) currentData = { first_prizes_won: 0, second_prizes_won: 0, total_spins: 0, lucky_prizes_won: 0 };

            if (requestedType === 'first' && (currentData.first_prizes_won || 0) < maxFirst) {
                currentData.first_prizes_won = (currentData.first_prizes_won || 0) + 1;
                finalWonType = 'first';
            } else if (requestedType === 'second' && (currentData.second_prizes_won || 0) < maxSecond) {
                currentData.second_prizes_won = (currentData.second_prizes_won || 0) + 1;
                finalWonType = 'second';
            } else {
                currentData.lucky_prizes_won = (currentData.lucky_prizes_won || 0) + 1;
                finalWonType = 'third';
            }

            currentData.total_spins = (currentData.total_spins || 0) + 1;
            return currentData;
        });

        const wonType = finalWonType; // Pass resolved wonType to animation

        animateWheelAndResolve(wonType);

    } catch (e) {
        console.error("Spin error:", e);
        vipSpinStatus.textContent = "Lỗi hệ thống. Vui lòng thử lại.";
        btnVipSpin.disabled = false;
        isSpinning = false;
    }
}

function animateWheelAndResolve(wonType) {
    // Find matching segments for wonType
    const matchingSegments = [];
    let startAngle = -112.5;

    for (let i = 0; i < vipSegments.length; i++) {
        const deg = vipSegments[i].degrees;
        if (vipSegments[i].type === wonType) {
            matchingSegments.push({
                index: i,
                midAngle: startAngle + (deg / 2)
            });
        }
        startAngle += deg;
    }

    // Pick a random matching segment
    const targetSeg = matchingSegments[Math.floor(Math.random() * matchingSegments.length)];

    const targetDeg = targetSeg.midAngle;
    const currentDeg = wheelRotation % 360;

    // Calculate rotation to stop at pointer (pointer is at top = 270 degrees in canvas coords)
    // Canvas 0 is right (3 o'clock). Top is 270 deg / -90 deg.
    // So if target is at targetDeg, to align it to top:
    let rotateToTop = 270 - targetDeg;
    if (rotateToTop < 0) rotateToTop += 360;

    const spins = 5 * 360; // 5 full spins
    const totalRotation = spins + rotateToTop - currentDeg;

    const duration = 5000;
    const startTime = performance.now();
    const easeOutCirc = (x) => Math.sqrt(1 - Math.pow(x - 1, 2));

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        let progress = elapsed / duration;
        if (progress > 1) progress = 1;

        const easedProgress = easeOutCirc(progress);
        wheelRotation = currentDeg + (totalRotation * easedProgress);

        vipWheelCanvas.style.transform = `rotate(${wheelRotation}deg)`;

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            wheelRotation = wheelRotation % 360;
            processWin(wonType);
        }
    }
    requestAnimationFrame(step);
}

function anonymizeData(name, phone) {
    const parts = name.split(' ');
    let shortName = "Khách Hàng";
    if (parts.length > 0) {
        shortName = parts[parts.length - 1]; // Get last name
    }
    const safePhone = phone ? phone.substring(0, 4) + 'xxx' + phone.substring(phone.length - 3) : '-------';
    return { shortName: shortName + '***', safePhone };
}

async function processWin(wonType) {
    let giftName, discountType, discountValue;

    if (wonType === 'first') {
        giftName = "Thẻ VIP 10 Ly Trà Sữa MIỄN PHÍ";
        discountType = 'fixed';
        discountValue = 200000; // Valued loosely for orders 
    } else if (wonType === 'second') {
        giftName = "Combo 3 Ly Trà Sữa MIỄN PHÍ";
        discountType = 'fixed';
        discountValue = 60000;
    } else {
        giftName = "Voucher Giảm 5K";
        discountType = 'fixed';
        discountValue = 5000;
    }

    // Generate Voucher
    const voucherId = 'VIP_' + Date.now().toString(36).toUpperCase();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days expiry for VIP Spin
    expiryDate.setHours(23, 59, 59, 999);

    try {
        await set(ref(database, `users/${currentUserId}/vouchers/${voucherId}`), {
            code: voucherId,
            discount_type: discountType,
            discount_value: discountValue,
            label: `[Quà Siêu Cấp] ${giftName}`,
            origin: 'vip_spin',
            expiresAt: expiryDate.toISOString(),
            status: 'active',
            createdAt: new Date().toISOString()
        });

        // Record ALL wins to monthly history
        const userSnap2 = await get(ref(database, `users/${currentUserId}`));
        const phone2 = userSnap2.exists() ? userSnap2.val().phone : '';
        const { shortName: sName, safePhone: sPhone } = anonymizeData(currentUserName, phone2);

        const monthStr = getMonthString();

        const winnerData = {
            uid: currentUserId,
            name: sName,
            phone: sPhone,
            prize_id: wonType,
            prize_name: giftName,
            timestamp: Date.now()
        };

        // All spins go to history (for ticker)
        await push(ref(database, `vip_spin_history/${monthStr}`), winnerData);

        // First & Second prizes also go to vip_winners
        if (wonType === 'first' || wonType === 'second') {
            await push(ref(database, `vip_winners/${monthStr}`), winnerData);
        }

        handleJackpotEffects(wonType);
        showWinModal(wonType, giftName, voucherId);

    } catch (e) {
        console.error(e);
    }

    isSpinning = false;
    btnVipSpin.disabled = false;
    vipSpinStatus.textContent = "";

    // Stats will update via onValue listener
}

function handleJackpotEffects(type) {
    const leds = document.getElementById('vipWheelOuter');
    if (!leds) return;
    if (type === 'first' || type === 'second') {
        leds.classList.add('jackpot-glow');
        setTimeout(() => {
            leds.classList.remove('jackpot-glow');
        }, 8000); // Effect duration 8 seconds for maximum hype
    }
}

function showWinModal(type, title, voucherCode) {
    const modal = document.getElementById('vipResultModal');
    const msgEl = document.getElementById('vipResultMsg');
    const codeEl = document.getElementById('vipResultCode');
    const iconEl = document.getElementById('vipResultIcon');
    const fbShare = document.getElementById('vipFbShare');

    msgEl.textContent = `Chúc mừng bạn đã trúng ${title}!`;
    codeEl.textContent = voucherCode;

    if (type === 'first') {
        iconEl.textContent = '👑';
        fbShare.style.display = 'block';
        launchConfetti();
    } else if (type === 'second') {
        iconEl.textContent = '🍹';
        fbShare.style.display = 'block';
        launchConfetti();
    } else {
        iconEl.textContent = '🎉';
        fbShare.style.display = 'none';
    }

    modal.style.display = 'flex';

    document.getElementById('btnVipUseNow').onclick = () => {
        window.location.href = `order.html?voucher=${voucherCode}`;
    };
}

function launchConfetti() {
    const canvas = document.getElementById('vipConfetti');
    canvas.style.opacity = 1;
    const myConfetti = confetti.create(canvas, { resize: true, useWorker: true });
    myConfetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    setTimeout(() => { canvas.style.opacity = 0; }, 4000);
}

if (btnVipSpin) {
    btnVipSpin.addEventListener('click', handleVipSpin);
}

// ------------------------------------
// TOAST NOTIFICATION LOGIC
// ------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const monthStr = getMonthString();
    // We will listen for new entries in this month's history
    const winnersRef = query(ref(database, `vip_spin_history/${monthStr}`), limitToLast(5));

    // We don't want to show notifications for old data on load, so we use a timestamp baseline
    const loadTime = Date.now();
    let initialLoad = true;

    onValue(winnersRef, (snapshot) => {
        if (!snapshot.exists()) return;

        let newWinners = [];
        snapshot.forEach(child => {
            newWinners.push(child.val());
        });

        if (initialLoad) {
            initialLoad = false;
            return;
        }

        // Display the most recent winner if it was added AFTER load time
        const latestWinner = newWinners[newWinners.length - 1];
        if (latestWinner && latestWinner.timestamp > loadTime) {
            // Mapping back to the fields Expected by showToast
            const toastData = {
                name: latestWinner.name,
                phone: latestWinner.phone,
                prize: latestWinner.prize_name,
                type: latestWinner.prize_id,
                timestamp: latestWinner.timestamp
            };
            showToast(toastData);
        }
    });
});

const toastQueue = [];
let isToastShowing = false;

function showToast(winnerData) {
    toastQueue.push(winnerData);
    processToastQueue();
}

function processToastQueue() {
    if (isToastShowing || toastQueue.length === 0) return;
    isToastShowing = true;

    const data = toastQueue.shift();
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const emoji = data.type === 'first' ? '👑' : '🍹';

    const card = document.createElement('div');
    card.className = 'toast-card';
    card.innerHTML = `
        <div class="toast-img">${emoji}</div>
        <div class="toast-content">
            <div class="toast-title">🔔 Ai đó vừa trúng thật!</div>
            <div class="toast-desc">Bạn <strong>${data.name}</strong> (${data.phone}) vừa ẵm trọn <span>${data.prize}</span>!</div>
        </div>
    `;

    container.appendChild(card);

    // Animate In
    setTimeout(() => { card.classList.add('show'); }, 100);

    // Animate Out & Remove
    setTimeout(() => {
        card.classList.remove('show');
        setTimeout(() => {
            card.remove();
            isToastShowing = false;
            processToastQueue();
        }, 500);
    }, 5000);
}

// ------------------------------------
// WINNERS MODAL LOGIC
// ------------------------------------
const btnViewVipWinners = document.getElementById('btnViewVipWinners');
const vipWinnersModal = document.getElementById('vipWinnersModal');
const vipWinnersList = document.getElementById('vipWinnersList');
const btnViewAllVipWinners = document.getElementById('btnViewAllVipWinners');

let loadedWinnersHTML = [];

if (btnViewVipWinners) {
    btnViewVipWinners.addEventListener('click', async () => {
        vipWinnersModal.style.display = 'flex';
        if (btnViewAllVipWinners) btnViewAllVipWinners.style.display = 'none';
        vipWinnersList.innerHTML = '<p style="text-align: center; color: #94a3b8;">Đang tải danh sách...</p>';

        const monthStr = getMonthString();
        const q = query(ref(database, `vip_winners/${monthStr}`), limitToLast(500));
        try {
            const snap = await get(q);
            if (!snap.exists()) {
                vipWinnersList.innerHTML = '<p style="text-align: center; color: #94a3b8;">Tháng này chưa có ai rinh giải độc đắc. Bạn sẽ người đầu tiên chứ?</p>';
                return;
            }

            const winners = [];
            snap.forEach(child => {
                const w = child.val();
                winners.push({
                    name: w.name,
                    phone: w.phone,
                    prize: w.prize_name,
                    type: w.prize_id,
                    timestamp: w.timestamp
                });
            });

            // Filter to ONLY Giải Nhất & Nhì
            const premiumOnly = winners.sort((a, b) => {
                const rankMap = { 'first': 2, 'second': 1 };
                if ((rankMap[a.type] || 0) !== (rankMap[b.type] || 0)) return (rankMap[b.type] || 0) - (rankMap[a.type] || 0);
                return b.timestamp - a.timestamp;
            });
            if (premiumOnly.length === 0) {
                vipWinnersList.innerHTML = '<p style="text-align: center; color: #94a3b8;">Tháng này chưa có ai trúng Giải Nhất/Nhì. Bạn sẻ là người đầu tiên chứ?</p>';
                return;
            }

            // Header note
            const note = `<div style="background: linear-gradient(135deg,#fef08a,#fde68a); border: 2px solid #d97706; border-radius: 10px; padding: 0.6rem 1rem; margin-bottom: 1rem; text-align: center; font-weight: 700; font-size: 0.85rem; color: #92400e;">
                &#x1F451; Tổng cộng: ${premiumOnly.filter(w => w.type === 'first').length} Giải Nhất &nbsp;|&nbsp; &#x1F31F; ${premiumOnly.filter(w => w.type === 'second').length} Giải Nhì
            </div>`;

            loadedWinnersHTML = premiumOnly.map((w, index) => {
                const dateOpts = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
                const dateStr = w.timestamp ? new Date(w.timestamp).toLocaleString('vi-VN', dateOpts) : '';

                let emoji = w.type === 'first' ? '&#x1F451;' : '&#x1F31F;';
                let styleType = w.type === 'first'
                    ? 'background: linear-gradient(135deg,#fef08a,#fde68a); border: 2px solid #d97706;'
                    : 'background: linear-gradient(135deg,#ccfbf1,#a7f3d0); border: 2px solid #0d9488;';
                const textColor = w.type === 'first' ? '#92400e' : '#134e4a';

                let rankBadge = '';
                if (index < 3) {
                    const badgeColors = ['#d97706', '#0d9488', '#f97316'];
                    rankBadge = `<div style="position: absolute; top: -10px; left: -10px; width: 24px; height: 24px; background: ${badgeColors[index]}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 5;">${index + 1}</div>`;
                }

                return `
                    <div class="winner-row" style="position: relative; display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-radius: 12px; ${styleType} margin-bottom: 0.5rem; transition: all 0.3s ease;">
                        ${rankBadge}
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <div style="font-size: 1.5rem; background: rgba(255,255,255,0.8); width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">${emoji}</div>
                            <div>
                                <div style="font-weight: 800; color: #1e293b;">${w.name || "Khách"} <span style="font-weight: 500; font-size: 0.85rem; color: #64748b;">(${w.phone || "---"})</span></div>
                                <div style="font-size: 0.85rem; color: #64748b;">${dateStr}</div>
                            </div>
                        </div>
                        <div style="font-weight: 900; color: ${textColor}; text-align: right; max-width: 120px;">${w.prize || "Quà Ẩn"}</div>
                    </div>
                `;
            });

            vipWinnersList.innerHTML = note + loadedWinnersHTML.join('');
            if (btnViewAllVipWinners) btnViewAllVipWinners.style.display = 'none';

        } catch (e) {
            vipWinnersList.innerHTML = '<p style="text-align: center; color: #ef4444;">Lỗi tải dữ liệu.</p>';
        }
    });
}

function renderWinners(limit) {
    vipWinnersList.innerHTML = loadedWinnersHTML.slice(0, limit).join('');

    if (loadedWinnersHTML.length > limit) {
        if (btnViewAllVipWinners) {
            btnViewAllVipWinners.style.display = 'block';
            btnViewAllVipWinners.onclick = () => renderWinners(loadedWinnersHTML.length);
        }
    } else {
        if (btnViewAllVipWinners) btnViewAllVipWinners.style.display = 'none';
    }
}

// ------------------------------------
// HOMEPAGE INIT: TOP WINNERS & MARQUEE
// ------------------------------------
async function loadHomepageWinners() {
    const vipTop3List = document.getElementById('vipTop3List');
    const vipMiniTicker = document.getElementById('vipMiniTicker');

    const prizeConfig = {
        first: { emoji: '👑', icon: '🏆', bgStyle: 'background: linear-gradient(135deg, #fefce8, #fef08a); border: 2px solid #eab308; box-shadow: 0 4px 15px rgba(234, 179, 8, 0.2);', textColor: '#854d0e', badgeColor: '#eab308' },
        second: { emoji: '🌟', icon: '🥈', bgStyle: 'background: linear-gradient(135deg, #ecfeff, #a5f3fc); border: 2px solid #0891b2; box-shadow: 0 4px 15px rgba(8, 145, 178, 0.1);', textColor: '#164e63', badgeColor: '#0891b2' },
        third: { emoji: '🍀', icon: '🥤', bgStyle: 'background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #22c55e; box-shadow: 0 4px 10px rgba(34, 197, 94, 0.05);', textColor: '#14532d', badgeColor: '#22c55e' }
    };

    const monthStr = getMonthString();

    try {
        // 1. Load Premium Winners (Bảng Vàng)
        if (vipTop3List) {
            onValue(query(ref(database, `vip_winners/${monthStr}`), limitToLast(500)), (snap) => {
                if (!snap.exists()) {
                    vipTop3List.innerHTML = `<div style="text-align: center; padding: 0.5rem 0.75rem; background: linear-gradient(135deg,#fef08a,#fde68a); border: 2px solid #d97706; border-radius: 10px; font-weight: 700; font-size: 0.85rem; color: #92400e;">👑 Giải Nhất & Nhì chưa ai trúng tháng này! Hãy là Đầu Tiên win!</div>`;
                    return;
                }

                const winners = [];
                snap.forEach(child => { winners.push(child.val()); });

                // Sort by rank then timestamp desc
                winners.sort((a, b) => {
                    const rankMap = { first: 2, second: 1 };
                    if ((rankMap[a.prize_id] || 0) !== (rankMap[b.prize_id] || 0)) return (rankMap[b.prize_id] || 0) - (rankMap[a.prize_id] || 0);
                    return b.timestamp - a.timestamp;
                });

                vipTop3List.innerHTML = winners.map((w, index) => {
                    const cfg = prizeConfig[w.prize_id] || prizeConfig.second;
                    const dateOpts = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
                    const dateStr = w.timestamp ? new Date(w.timestamp).toLocaleString('vi-VN', dateOpts) : '';
                    const rankBadge = `<div style="position: absolute; top: -8px; left: -8px; width: 22px; height: 22px; background: ${cfg.badgeColor}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; border: 2px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.15); z-index: 5;">${index + 1}</div>`;
                    const prizeText = w.prize_name ? w.prize_name.replace('MIỄN PHÍ', '<br><small style="font-size: 0.65rem; opacity: 0.8; font-weight: 700;">MIỄN PHÍ</small>') : "Quà Ẩn";
                    return `
                        <div style="position: relative; display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; border-radius: 16px; ${cfg.bgStyle} margin-bottom: 0.5rem; transition: transform 0.2s;">
                            ${rankBadge}
                            <div style="display: flex; gap: 0.85rem; align-items: center;">
                                <div style="font-size: 1.5rem; background: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(0,0,0,0.05);">${cfg.icon}</div>
                                <div>
                                    <div style="font-weight: 800; color: #1e293b; font-size: 0.95rem;">${w.name || "Khách"} <span style="font-weight:500; font-size: 0.75rem; color: #64748b;">(${w.phone || "---"})</span></div>
                                    <div style="font-size: 0.7rem; color: #64748b; font-weight: 600;">${dateStr}</div>
                                </div>
                            </div>
                            <div style="font-weight: 900; color: ${cfg.textColor}; font-size: 0.85rem; text-align: right; line-height: 1.1;">${prizeText}</div>
                        </div>`;
                }).join('');
            });
        }

        // 2. Load Marquee Data (Top 30 Recent)
        if (vipMiniTicker) {
            onValue(query(ref(database, `vip_spin_history/${monthStr}`), limitToLast(30)), (snap) => {
                if (!snap.exists()) {
                    vipMiniTicker.parentElement.style.display = 'none';
                    return;
                }

                const recentWinners = [];
                snap.forEach(child => { recentWinners.push(child.val()); });
                recentWinners.sort((a, b) => b.timestamp - a.timestamp);

                vipMiniTicker.parentElement.style.display = 'block';
                const marqueeStrings = recentWinners.map(w => {
                    const cfg = prizeConfig[w.prize_id] || prizeConfig.third;
                    return `${cfg.emoji} Chúc mừng <b>${w.name}</b> (${w.phone}) trúng <b>${w.prize_name || "Voucher Giảm 5K"}</b>! &nbsp;`;
                });

                // Duplicate for smooth loop
                const fullText = marqueeStrings.join(' • ') + ' • ' + marqueeStrings.join(' • ');
                vipMiniTicker.innerHTML = fullText;

                // Dynamically adjust speed: more text = longer duration
                const duration = Math.max(25, fullText.length * 0.08); // 0.08s per character roughly
                vipMiniTicker.style.animationDuration = `${duration}s`;
            });
        }

    } catch (e) {
        console.error("Error loading homepage winners:", e);
    }
}

// Call on load
document.addEventListener('DOMContentLoaded', () => {
    loadHomepageWinners();
    loadVipMonthlyStats();
});

// ------------------------------------
// MONTHLY STATS PANEL
// ------------------------------------
async function loadVipMonthlyStats() {
    const statsEl = document.getElementById('vipMonthlyStats');
    const monthLabelEl = document.getElementById('vipStatsMonthLabel');
    if (!statsEl) return;

    const now = new Date();
    const monthStr = getMonthString();
    const day = now.getDate();
    const monthName = now.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

    if (monthLabelEl) monthLabelEl.textContent = monthName;

    // Calculate current max first prize based on week
    const maxFirst = getMaxFirstPrizes();
    const maxSecond = getMaxSecondPrizes();

    try {
        // Campaign stats listener
        onValue(ref(database, `campaign_configs/${monthStr}`), (snap) => {
            const data = snap.exists() ? snap.val() : {};
            const usedFirst = data.first_prizes_won || 0;
            const usedSecond = data.second_prizes_won || 0;
            const totalSpins = data.total_spins || 0;
            const thirdCount = data.lucky_prizes_won || Math.max(0, totalSpins - usedFirst - usedSecond);

            const maxFirst = getMaxFirstPrizes();
            const remainFirst = Math.max(0, maxFirst - usedFirst);
            const remainSecond = Math.max(0, maxSecond - usedSecond);

            function progressBar(used, max, color) {
                const pct = max > 0 ? Math.round((used / max) * 100) : 100;
                const remainColor = pct >= 100 ? '#ef4444' : color;
                return `
            <div style="height: 6px; background: #e2e8f0; border-radius: 10px; overflow: hidden; margin-top: 4px;">
                <div style="height: 100%; width: ${Math.min(100, pct)}%; background: ${remainColor}; border-radius: 10px; transition: width 0.5s;"></div>
            </div>`;
            }

            function statRow(emoji, label, used, max, color, badge) {
                const remain = Math.max(0, max - used);
                const isFull = used >= max;
                return `
            <div style="background: ${isFull ? '#fef2f2' : 'linear-gradient(to right, #ffffff, #f8fafc)'}; border: 1px solid ${isFull ? '#fca5a5' : '#e2e8f0'}; border-radius: 12px; padding: 0.6rem 0.8rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <div style="font-size: 0.85rem; font-weight: 800; color: #334155;">${emoji} ${label}</div>
                    <span style="font-size: 0.65rem; font-weight: 900; background: ${isFull ? '#ef4444' : color}; color: white; padding: 3px 8px; border-radius: 50px; text-transform: uppercase; letter-spacing: 0.5px;">${isFull ? 'HẾT GIẢI' : `CÒN ${remain}/${max}`}</span>
                </div>
                ${progressBar(used, max, color)}
            </div>`;
            }

            statsEl.innerHTML = `
                ${statRow('👑', 'Giải Nhất', usedFirst, 5, '#d97706', '5/tháng')}
                ${statRow('🌟', 'Giải Nhì', usedSecond, 10, '#0d9488', '10/tháng')}
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem;">
                    <div style="font-size: 0.8rem; font-weight: 700; color: #475569;">🎰 Tổng lượt quay tháng này</div>
                    <span style="font-size: 1rem; font-weight: 900; color: #0ea5e9;">${totalSpins}</span>
                </div>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 0.8rem; font-weight: 700; color: #475569;">🍀 May Mắn đã phát</div>
                    <span style="font-size: 1rem; font-weight: 900; color: #f97316;">${thirdCount}</span>
                </div>
            `;

            // Also update the lucky count in the left prize structure panel
            const luckyCountEl = document.getElementById('vipLuckyCount');
            if (luckyCountEl) luckyCountEl.textContent = thirdCount;
        }); // end campaign listener

    } catch (e) {
        console.error('Error loading vip stats:', e);
        statsEl.innerHTML = '<p style="font-size: 0.85rem; color: #94a3b8; text-align: center;">Không thể tải thống kê.</p>';
    }
}

async function resetVipData() {
    if (!confirm("⚠️ BẠN CÓ CHẮC CHẮN MUỐN RESET DỮ LIỆU THÁNG NÀY?\nHành động này sẽ xóa dữ liệu Giải Nhất/Nhì/May Mắn của CHỈ THÁNG HIỆN TẠI (giữ lại các tháng trước).")) return;

    try {
        const monthStr = getMonthString();
        // 1. Erase Campaign stats for this month
        await remove(ref(database, `campaign_configs/${monthStr}`));

        // 2. Erase History for this month
        await remove(ref(database, `vip_spin_history/${monthStr}`));

        // 3. Erase Winners for this month
        await remove(ref(database, `vip_winners/${monthStr}`));

        alert("✅ Đã reset dữ liệu tháng này thành công!");
        location.reload();
    } catch (e) {
        alert("❌ Lỗi: " + e.message);
    }
}

// Global exposure for the reset button
window.resetVipData = resetVipData;
