// file: global-nav.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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
const db = getDatabase(app);

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        const navLinksContext = document.getElementById('nav-links'); // For index, vongquay
        const navActionsContext = document.querySelector('.nav-actions'); // For order, profile

        // 1. DYNAMIC NAVIGATION
        if (user) {
            try {
                // Fetch user data
                const userSnap = await get(ref(db, `users/${user.uid}`));
                let userName = "Khách";
                if (userSnap.exists() && userSnap.val().name) {
                    userName = userSnap.val().name.split(' ').pop(); // Lấy tên cuối
                }

                // If on Desktop Nav (index.html or vongquay.html)
                if (navLinksContext) {
                    // Hide the "ĐĂNG KÝ THÀNH VIÊN" and Login cart icon
                    const loginLinks = navLinksContext.querySelectorAll('a[href="login.html"]');
                    loginLinks.forEach(link => {
                        // If it's a list item, hide parent
                        if (link.parentElement.tagName === 'LI') {
                            link.parentElement.style.display = 'none';
                        } else {
                            link.style.display = 'none';
                        }
                    });

                    // Avoid duplicate injection
                    let existingUserLi = document.getElementById('globalUserLi');
                    if (!existingUserLi) {
                        const userLi = document.createElement('li');
                        userLi.id = 'globalUserLi';
                        userLi.innerHTML = `
                            <a href="profile.html" style="color: #0ea5e9; font-weight: 800; display: flex; align-items: center; gap: 4px;">
                                Xin chào, ${userName}
                                <span id="globalVoucherBadge" style="display: none; background: #ef4444; color: white; border-radius: 999px; padding: 2px 6px; font-size: 0.7rem;">0</span>
                            </a>
                        `;
                        navLinksContext.appendChild(userLi);
                    }
                }

                // Listen to Vouchers to update global badges
                onValue(ref(db, `users/${user.uid}/vouchers`), (snapshot) => {
                    let activeCount = 0;
                    const now = new Date();
                    if (snapshot.exists()) {
                        const vouchers = snapshot.val();
                        for (let key in vouchers) {
                            if (vouchers[key].status === 'active' && now <= new Date(vouchers[key].expiresAt)) {
                                activeCount++;
                            }
                        }
                    }

                    // Update Top Menus
                    const globalBadge = document.getElementById('globalVoucherBadge');
                    if (globalBadge) {
                        globalBadge.style.display = activeCount > 0 ? 'inline-block' : 'none';
                        globalBadge.textContent = activeCount;
                    }
                });

            } catch (e) {
                console.error("Error in global nav user processing", e);
            }
        } else {
            // User not logged in, ensure global items are removed if somehow present
            const globalUserLi = document.getElementById('globalUserLi');
            if (globalUserLi) globalUserLi.remove();
        }

        // 2. ADMIN TICKER (PENDING ORDERS)
        if (user) {
            const adminSnap = await get(ref(db, `admins/${user.uid}`));
            if (adminSnap.exists()) {
                // Is an admin string
                onValue(ref(db, 'orders'), (snapshot) => {
                    let pendingCount = 0;
                    if (snapshot.exists()) {
                        const allOrders = snapshot.val();
                        Object.values(allOrders).forEach(ord => {
                            if (ord.status === 'pending') pendingCount++;
                        });
                    }

                    let adminTicker = document.getElementById('adminGlobalTicker');
                    if (pendingCount > 0) {
                        if (!adminTicker) {
                            adminTicker = document.createElement('a');
                            adminTicker.id = 'adminGlobalTicker';
                            adminTicker.href = 'admin.html';
                            adminTicker.style.cssText = `
                                position: fixed;
                                bottom: 20px;
                                left: 20px;
                                background-color: #ef4444;
                                color: white;
                                padding: 12px 20px;
                                border-radius: 999px;
                                text-decoration: none;
                                font-weight: bold;
                                font-size: 1rem;
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                                z-index: 10000;
                                transition: all 0.3s ease;
                                animation: bounceAdmin 2s infinite;
                            `;
                            document.body.appendChild(adminTicker);

                            // Ad keyframes
                            const style = document.createElement('style');
                            style.innerHTML = `
                                @keyframes bounceAdmin {
                                    0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
                                    40% {transform: translateY(-10px);}
                                    60% {transform: translateY(-5px);}
                                }
                                #adminGlobalTicker:hover {
                                    background-color: #dc2626;
                                    transform: scale(1.05);
                                }
                            `;
                            document.head.appendChild(style);
                        }
                        adminTicker.innerHTML = `<span style="font-size: 1.2rem;">🚨</span> ${pendingCount} Đơn Chờ Xử Lý`;
                    } else {
                        if (adminTicker) adminTicker.remove();
                    }
                });
            }
        }

    });
});
