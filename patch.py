import codecs

path = 'c:/Users/hoang/Documents/Sa/vipspin.js'
with codecs.open(path, 'r', 'utf-8') as f:
    lines = f.readlines()

# Chunk 1: 183-224
c1 = """        const monthStr = getMonthString();
        const campaignRef = ref(database, `vip_campaigns/${monthStr}`);

        let wonType = 'third'; // Default Voucher 5k
        const rand = Math.random() * 100;

        if (rand < 2.5) {
            wonType = 'first';
        } else if (rand < 7.5) {
            wonType = 'second';
        }

        if (wonType === 'first' || wonType === 'second') {
            const txResult = await runTransaction(campaignRef, (currentData) => {
                if (currentData === null) currentData = { first_prizes_won: 0, second_prizes_won: 0, total_spins: 0 };

                if (wonType === 'first') {
                    if ((currentData.first_prizes_won || 0) >= getMaxFirstPrizes()) return; // abort
                    currentData.first_prizes_won = (currentData.first_prizes_won || 0) + 1;
                } else {
                    if ((currentData.second_prizes_won || 0) >= getMaxSecondPrizes()) return; // abort
                    currentData.second_prizes_won = (currentData.second_prizes_won || 0) + 1;
                }
                currentData.total_spins = (currentData.total_spins || 0) + 1;
                return currentData;
            });

            if (!txResult.committed) {
                wonType = 'third'; // Fallback if someone else snatched it
                await runTransaction(campaignRef, (currentData) => {
                    if (currentData === null) currentData = { first_prizes_won: 0, second_prizes_won: 0, total_spins: 0 };
                    currentData.total_spins = (currentData.total_spins || 0) + 1;
                    return currentData;
                });
            }
        } else {
            await runTransaction(campaignRef, (currentData) => {
                if (currentData === null) currentData = { first_prizes_won: 0, second_prizes_won: 0, total_spins: 0 };
                currentData.total_spins = (currentData.total_spins || 0) + 1;
                return currentData;
            });
        }

        animateWheelAndResolve(wonType);
"""

# Chunk 2: 334-360
c2 = """        // Record ALL wins to monthly history
        const userSnap2 = await get(ref(database, `users/${currentUserId}`));
        const phone2 = userSnap2.exists() ? userSnap2.val().phone : '';
        const { shortName: sName, safePhone: sPhone } = anonymizeData(currentUserName, phone2);

        const monthStr = getMonthString();
        await push(ref(database, `vip_spin_history/${monthStr}`), {
            uid: currentUserId,
            name: sName,
            phone: sPhone,
            prize_id: wonType,
            prize_name: giftName,
            timestamp: Date.now() // Use client timestamp for simple numeric sorting
        });

        showWinModal(wonType, giftName, voucherId);

    } catch (e) {
        console.error(e);
    }

    isSpinning = false;
    btnVipSpin.disabled = false;
    vipSpinStatus.textContent = "";

    // Stats will update via onValue listener
}
"""

# Chunk 3: 407-431
c3 = """    const monthStr = getMonthString();
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
"""

# Chunk 4: 496-515
c4 = """        const monthStr = getMonthString();
        const q = query(ref(database, `vip_spin_history/${monthStr}`), limitToLast(2000));
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
            const premiumOnly = winners.filter(w => w.type === 'first' || w.type === 'second')
                .sort((a, b) => {
                    const rankMap = { 'first': 2, 'second': 1 };
                    if ((rankMap[a.type] || 0) !== (rankMap[b.type] || 0)) return (rankMap[b.type] || 0) - (rankMap[a.type] || 0);
                    return b.timestamp - a.timestamp;
                });
"""

# Chunk 5: 614-630
c5 = """    try {
        const monthStr = getMonthString();
        const q = query(ref(database, `vip_spin_history/${monthStr}`), limitToLast(500)); // Marquee + recent top

        onValue(q, (snap) => {
            if (!snap.exists()) {
                vipTop3List.innerHTML = '<p style="text-align: center; color: #94a3b8; font-size: 0.9rem;">🍀 Chưa có người trúng giải. Hãy là người đầu tiên!</p>';
                if (vipMiniTicker) vipMiniTicker.parentElement.style.display = 'none';
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

            // --- MARQUEE: 10 most recent UNIQUE players (includes ALL, even 5K) ---
            if (vipMiniTicker) {
                const sortedAll = [...winners].sort((a, b) => b.timestamp - a.timestamp);
                const uniqueRecent = [];
                const seenPhones = new Set();
"""

# Chunk 6: 650-653
c6 = """            // --- PREMIUM WINNERS (first + second) - NO LIMIT ---
            const premiumWinners = [...winners]
                .filter(w => w.type === 'first' || w.type === 'second')
"""

# Chunk 7: 716-782
c7 = """        // Campaign stats listener
        onValue(ref(database, `vip_campaigns/${monthStr}`), (snap) => {
            const data = snap.exists() ? snap.val() : {};
            const usedFirst = data.first_prizes_won || 0;
            const usedSecond = data.second_prizes_won || 0;
            const totalSpins = data.total_spins || 0;
            const thirdCount = Math.max(0, totalSpins - usedFirst - usedSecond);

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
"""

# Chunk 8: 795-814
c8 = """        // 1. Erase Campaign stats for this month
        await remove(ref(database, `vip_campaigns/${monthStr}`));

        // 2. Erase History for this month
        await remove(ref(database, `vip_spin_history/${monthStr}`));
"""

new_lines = []
for i, l in enumerate(lines):
    l_idx = i + 1
    if l_idx == 183: new_lines.append(c1)
    if 183 <= l_idx <= 224: continue
    
    if l_idx == 334: new_lines.append(c2)
    if 334 <= l_idx <= 359: continue # Corrected slightly, previous was 360 but `}` was on 360 which I included in c2 anyway; wait, original end was line 359 because 360 is `}`
    
    if l_idx == 407: new_lines.append(c3)
    if 407 <= l_idx <= 431: continue
    
    if l_idx == 496: new_lines.append(c4)
    if 496 <= l_idx <= 515: continue
    
    if l_idx == 614: new_lines.append(c5)
    if 614 <= l_idx <= 630: continue
    
    if l_idx == 650: new_lines.append(c6)
    if 650 <= l_idx <= 653: continue
    
    if l_idx == 716: new_lines.append(c7)
    if 716 <= l_idx <= 782: continue
    
    if l_idx == 795: new_lines.append(c8)
    if 795 <= l_idx <= 814: continue
    
    new_lines.append(l)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(''.join(new_lines))

print('Done')
