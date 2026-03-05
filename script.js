import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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
const db = getDatabase(app);

const defaultBanners = [
    {
        imageUrl: "https://images.unsplash.com/photo-1558160074-4d7d8bdf4256?q=80&w=2070&auto=format&fit=crop",
        headline: "<span class='highlight-blue'>FUN FRESH</span><br>FRIENDLY",
        subheadline: "Thưởng thức trà sữa Matcha tươi mát siêu cuốn, mang đến niềm vui và năng lượng tích cực cho cả ngày dài!",
        buttonText: "Đặt Món Ngay",
        linkUrl: "order.html"
    },
    {
        imageUrl: "https://images.unsplash.com/photo-1576092762791-dd9e22205948?q=80&w=2070&auto=format&fit=crop",
        headline: "<span class='highlight-blue'>HƯƠNG VỊ</span><br>NGUYÊN BẢN",
        subheadline: "Sự kết hợp hoàn hảo giữa trà xanh nguyên lá thượng hạng và trân châu dai giòn sần sật.",
        buttonText: "Xem Menu",
        linkUrl: "order.html"
    },
    {
        imageUrl: "https://images.unsplash.com/photo-1598515089851-dceb2929de28?q=80&w=2070&auto=format&fit=crop",
        headline: "<span class='highlight-blue'>FREE ƯU ĐÃI</span><br>CHO THÀNH VIÊN",
        subheadline: "Trở thành hội viên TeaRus ngay hôm nay để nhận được hàng ngàn voucher và dễ dàng đổi điểm lấy quà siêu to.",
        buttonText: "Đăng Ký Khách Hàng",
        linkUrl: "login.html"
    }
];

// Initialize
async function init() {
    await initBanners();
    await fetchHotProducts();
}

async function initBanners() {
    const bannerRef = ref(db, 'config/banners');
    try {
        const snapshot = await get(bannerRef);
        let banners = [];
        if (snapshot.exists()) {
            banners = snapshot.val();
        } else {
            // Seed DB with defaults if emptiness
            await set(bannerRef, defaultBanners);
            banners = defaultBanners;
        }
        renderBanners(banners);
    } catch (e) {
        console.error("Failed to load banners from DB, falling back to default.", e);
        renderBanners(defaultBanners);
    }
}

function renderBanners(banners) {
    const bannerWrapper = document.getElementById('bannerWrapper');
    if (!bannerWrapper) return;
    bannerWrapper.innerHTML = '';

    banners.forEach(b => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = `
            <div class="slide-bg" style="background-image: url('${b.imageUrl}');"></div>
            <div class="slide-overlay split-overlay"></div>
            <div class="slide-content split-layout">
                <div class="slide-text">
                    <h2 class="slide-headline dark-text">${b.headline}</h2>
                    <p class="slide-subheadline dark-text">${b.subheadline}</p>
                    <a href="${b.linkUrl || '#'}" class="slide-btn glow-btn" style="text-decoration: none; display: inline-block;">${b.buttonText}</a>
                </div>
            </div>
        `;
        bannerWrapper.appendChild(slide);
    });

    // Start Swiper AFTER rendering
    new Swiper('.hero-swiper', {
        loop: true,
        autoplay: { delay: 5000, disableOnInteraction: false },
        pagination: { el: '.swiper-pagination', clickable: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        effect: 'fade',
        fadeEffect: { crossFade: true }
    });
}

async function fetchHotProducts() {
    const grid = document.getElementById('hotItemsGrid');
    if (!grid) return;

    try {
        const snapshot = await get(ref(db, 'products'));
        if (snapshot.exists()) {
            const data = snapshot.val();
            let products = Object.keys(data).map(key => ({ id: key, ...data[key] }));

            // Take the first 4 products
            const hotProducts = products.slice(0, 4);

            grid.innerHTML = '';
            hotProducts.forEach((p, index) => {
                const imgUrl = p.imageUrl || "https://images.unsplash.com/photo-1556881286-fc6915169721?q=80&w=1974&auto=format&fit=crop";
                grid.innerHTML += `
                    <div class="hot-card">
                        <div class="hot-badge">Hot 🔥</div>
                        <img src="${imgUrl}" alt="${p.name}">
                        <div class="hot-info">
                            <h3>${p.name}</h3>
                            <p class="hot-desc">Món uống được yêu thích tại TeaRus.</p>
                            <div class="hot-price-row">
                                <span class="hot-price">${parseInt(p.price).toLocaleString('vi-VN')}đ</span>
                                <a href="order.html" class="hot-btn">Mua ngay</a>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            grid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1; color: var(--text-muted);">Hiện chưa có Món nào để hiển thị.</p>';
        }
    } catch (e) {
        console.error("Error fetching hot products:", e);
        grid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1; color: red;">Lỗi tải dữ liệu Món.</p>';
    }
}

// Init
init();
