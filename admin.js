// file: admin.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, get, set, remove, onValue } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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

// Global state
let currentBanners = [];
let allProducts = [];
let allOrders = [];
let allCustomers = [];

// ============================================
// SHARED UTILITIES
// ============================================
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    if (isError) toast.classList.add('error');
    else toast.classList.remove('error');

    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Re-using the excellent Image Compression logic
function compressImage(file, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            callback(dataUrl);
        };
        img.onerror = () => { showToast("Lỗi phân tích hình ảnh.", true); callback(null); };
    };
    reader.onerror = () => { showToast("Lỗi đọc file ảnh.", true); callback(null); };
}

// Generate unique ID
function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

const CATEGORY_MAP = {
    'milktea': 'Trà Sữa Tuyệt Đỉnh',
    'combo': 'Combo Khuyến Mãi',
    'fruit': 'Trà Trái Cây Tươi',
    'topping': 'Topping Thêm'
};

const STATUS_MAP = {
    'pending': '<span class="status-badge status-pending">Chờ Xử Lý</span>',
    'completed': '<span class="status-badge status-completed">Đã Xong</span>'
};

// ============================================
// TAB: ORDERS MANAGEMENT
// ============================================
const ordersTableBody = document.getElementById('ordersTableBody');

function loadOrders() {
    const ordersRef = ref(db, 'orders');
    // Listen for realtime update
    onValue(ordersRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Convert to array and reverse (newest first)
            allOrders = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else {
            allOrders = [];
        }
        renderOrders();
    });
}

function renderOrders() {
    ordersTableBody.innerHTML = '';
    if (allOrders.length === 0) {
        ordersTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:2rem;">Chưa có đơn hàng nào.</td></tr>';
        return;
    }

    allOrders.forEach(order => {
        const tr = document.createElement('tr');

        // Format date
        const dateObj = new Date(order.createdAt);
        const dateStr = `${dateObj.getHours()}:${String(dateObj.getMinutes()).padStart(2, '0')} - ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

        // Format items array into html
        let itemsHtml = '<ul style="padding-left:1rem;margin:0;font-size:0.9rem;color:#64748b;">';
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(i => {
                itemsHtml += `<li>${i.quantity}x ${i.name}</li>`;
            });
        }
        itemsHtml += '</ul>';

        // Format total
        const totalFmt = (order.totalAmount || 0).toLocaleString('vi-VN') + 'đ';

        // Format customer info
        const custInfo = `
            <strong>${order.customerName || 'Vô danh'}</strong><br>
            <small style="color:#64748b;">${order.customerPhone || 'Không có SĐT'}</small><br>
            <small style="color:#64748b;display:block;max-width:200px;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;" title="${order.deliveryAddress}">${order.deliveryAddress}</small>
        `;

        // Buttons
        let actionBtn = '';
        if (order.status === 'pending') {
            actionBtn = `<button class="btn btn-success" onclick="window.markOrderComplete('${order.id}')" style="padding:0.4rem 0.8rem;font-size:0.85rem;">Xong Đơn</button>`;
        } else {
            actionBtn = `<button class="btn btn-outline" style="border-color:#e2e8f0;padding:0.4rem 0.8rem;font-size:0.85rem;" disabled>Đã Giao</button>`;
        }

        tr.innerHTML = `
            <td style="font-weight:600;">${dateStr}</td>
            <td>${custInfo}</td>
            <td>${itemsHtml}</td>
            <td style="font-weight:700;color:#f59e0b;">${totalFmt}</td>
            <td>${STATUS_MAP[order.status] || order.status}</td>
            <td>${actionBtn}</td>
        `;
        ordersTableBody.appendChild(tr);
    });
}

// Global scope for onclick bindings
window.markOrderComplete = async function (orderId) {
    if (!confirm("Bạn xác nhận đã hoàn thành và giao đơn này?")) return;
    try {
        await set(ref(db, `orders/${orderId}/status`), 'completed');
        showToast("Đã cập nhật trạng thái đơn hàng!");
    } catch (e) {
        console.error(e);
        showToast("Lỗi khi cập nhật trạng thái.", true);
    }
}


// ============================================
// TAB: MENU MANAGEMENT
// ============================================
const productsTableBody = document.getElementById('productsTableBody');
const productForm = document.getElementById('productForm');

function loadProducts() {
    const productsRef = ref(db, 'products');
    onValue(productsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            allProducts = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));
        } else {
            allProducts = [];
        }
        renderProducts();
    });
}

function renderProducts() {
    productsTableBody.innerHTML = '';
    if (allProducts.length === 0) {
        productsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:2rem;">Chưa có món nào trong thực đơn. Cần thêm mới.</td></tr>';
        return;
    }

    allProducts.forEach(product => {
        const tr = document.createElement('tr');

        const priceFmt = (parseInt(product.price) || 0).toLocaleString('vi-VN') + 'đ';
        const imgUrl = product.imageUrl || 'https://via.placeholder.com/50';
        const catName = CATEGORY_MAP[product.category] || product.category;

        tr.innerHTML = `
            <td>
                <div class="product-cell">
                    <img src="${imgUrl}" alt="${product.name}">
                    <span style="font-weight:600;">${product.name}</span>
                </div>
            </td>
            <td><span style="background:#f1f5f9;padding:0.2rem 0.6rem;border-radius:4px;font-size:0.85rem;">${catName}</span></td>
            <td style="font-weight:700;">${priceFmt}</td>
            <td style="text-align:right;">
                <button class="btn btn-outline" style="padding:0.4rem 0.8rem;font-size:0.85rem;margin-right:0.5rem;" onclick="window.editProduct('${product.id}')">Sửa</button>
                <button class="btn btn-danger" style="padding:0.4rem 0.8rem;font-size:0.85rem;" onclick="window.deleteProduct('${product.id}')">Xóa</button>
            </td>
        `;
        productsTableBody.appendChild(tr);
    });
}

// Product Form Submission
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Disable button to prevent double submit
    const btn = document.getElementById('btnSaveProduct');
    btn.textContent = 'ĐANG LƯU...';
    btn.disabled = true;

    const id = document.getElementById('prodId').value || generateId();
    const name = document.getElementById('prodName').value.trim();
    const price = document.getElementById('prodPrice').value;
    const category = document.getElementById('prodCategory').value;
    const imageUrl = document.getElementById('prodImageUrl').value; // from hidden input

    if (!imageUrl) {
        showToast("Vui lòng tải ảnh món ăn lên trước khi lưu!", true);
        btn.textContent = 'LƯU SẢN PHẨM';
        btn.disabled = false;
        return;
    }

    try {
        await set(ref(db, `products/${id}`), {
            name: name,
            price: price,
            category: category,
            imageUrl: imageUrl,
            updatedAt: new Date().toISOString()
        });
        showToast("Lưu món ăn thành công!");
        document.getElementById('productModal').classList.remove('active');
    } catch (error) {
        console.error("Save product error:", error);
        showToast("Lỗi khi lưu dữ liệu. Thử lại sau!", true);
    } finally {
        btn.textContent = 'LƯU SẢN PHẨM';
        btn.disabled = false;
    }
});

// Delete Product
window.deleteProduct = async function (id) {
    if (!confirm("Bạn có chắc muốn XÓA món này khỏi thực đơn không? (Không thể hoàn tác!)")) return;
    try {
        await remove(ref(db, `products/${id}`));
        showToast("Đã xóa sản phẩm.");
    } catch (e) {
        showToast("Lỗi khi xóa.", true);
    }
};

// Edit Product (populate modal)
window.editProduct = function (id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    // Populate Fields
    document.getElementById('modalTitle').textContent = 'Sửa Thông Tin Món';
    document.getElementById('prodId').value = product.id;
    document.getElementById('prodName').value = product.name;
    document.getElementById('prodPrice').value = product.price;
    document.getElementById('prodCategory').value = product.category;

    // Image
    document.getElementById('prodImageUrl').value = product.imageUrl || '';
    if (product.imageUrl) {
        const preview = document.getElementById('prodImagePreview');
        preview.src = product.imageUrl;
        preview.style.display = 'block';
        document.getElementById('uploadText').textContent = 'Đã tải ảnh lên (Nhấn để thay đổi)';
    }

    // Show Modal
    document.getElementById('productModal').classList.add('active');
};

// Image Upload handler for Product Modal
document.getElementById('prodImageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('uploadText').textContent = 'Đang nén ảnh...';
        compressImage(file, (base64String) => {
            if (base64String) {
                document.getElementById('prodImageUrl').value = base64String;
                const preview = document.getElementById('prodImagePreview');
                preview.src = base64String;
                preview.style.display = 'block';
                document.getElementById('uploadText').textContent = 'Ảnh đã sẵn sàng! (Nhấn đổi)';
                showToast("Tải ảnh và nén thành công!");
            } else {
                document.getElementById('uploadText').textContent = 'Lỗi ảnh. Thử lại.';
            }
        });
    }
});


// ============================================
// TAB: BANNERS MANAGEMENT (Existing logic preserved)
// ============================================
const bannerListEl = document.getElementById('bannerList');
const loadingElBanner = document.getElementById('loading');
const saveAllBannersBtn = document.getElementById('saveAllBtn');
const addBannerForm = document.getElementById('addBannerForm');

function loadBanners() {
    onValue(ref(db, 'config/banners'), (snapshot) => {
        if (snapshot.exists()) {
            currentBanners = snapshot.val() || [];
        } else {
            currentBanners = [];
        }
        renderBanners();
        loadingElBanner.style.display = 'none';
        bannerListEl.style.display = 'block';
        if (currentBanners.length > 0) saveAllBannersBtn.style.display = 'block';
    });
}

function renderBanners() {
    bannerListEl.innerHTML = '';

    // Ensure save button visibility based on banners
    saveAllBannersBtn.style.display = currentBanners.length > 0 ? 'inline-block' : 'none';

    if (currentBanners.length === 0) {
        bannerListEl.innerHTML = '<p class="loading-text">Chưa có banner nào.</p>';
        return;
    }

    currentBanners.forEach((b, index) => {
        const item = document.createElement('div');
        item.className = 'banner-item';

        const safeHeadline = (b.headline || '').replace(/"/g, '&quot;');
        const safeSub = (b.subheadline || '').replace(/"/g, '&quot;');

        item.innerHTML = `
            <img src="${b.imageUrl}" alt="Banner Preview" class="banner-img-preview" onerror="this.src='https://via.placeholder.com/150x80?text=Lỗi+Ảnh'">
            <div class="banner-info" data-index="${index}">
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: flex-end;">
                    <div style="flex:1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <small>Link Ảnh (Bắt buộc)</small>
                            <label class="btn btn-outline" style="padding: 0.2rem 0.6rem; font-size: 0.75rem; cursor: pointer;">
                                Đổi Ảnh Lên
                                <input type="file" class="upload-existing-img" data-index="${index}" accept="image/*" style="display: none;">
                            </label>
                        </div>
                        <input type="text" class="edit-img" value="${b.imageUrl}" style="margin-bottom: 0;">
                    </div>
                    <div style="width: 150px;">
                        <small style="display: block; margin-bottom: 0.5rem;">Nút bấm</small>
                        <input type="text" class="edit-btn" value="${b.buttonText}" style="margin-bottom: 0;">
                    </div>
                </div>
                <div><small>Tiêu đề (Cho phép HTML)</small><input type="text" class="edit-headline" value="${safeHeadline}"></div>
                <div><small>Mô tả nhỏ</small><input type="text" class="edit-sub" value="${safeSub}"></div>
                
                <div class="banner-actions">
                    <button type="button" class="btn btn-danger btn-delete" data-index="${index}">Xóa</button>
                    ${index > 0 ? `<button type="button" class="btn btn-outline btn-move-up" data-index="${index}" style="padding: 0.4rem 0.8rem;">Lên ↑</button>` : ''}
                    ${index < currentBanners.length - 1 ? `<button type="button" class="btn btn-outline btn-move-down" data-index="${index}" style="padding: 0.4rem 0.8rem;">Xuống ↓</button>` : ''}
                </div>
            </div>
        `;
        bannerListEl.appendChild(item);
    });

    attachBannerListEvents();
}

function attachBannerListEvents() {
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!confirm("Xóa banner này?")) return;
            const index = parseInt(e.target.getAttribute('data-index'));
            currentBanners.splice(index, 1);
            saveBannersToFirebase("Đã xóa banner", true);
        });
    });

    document.querySelectorAll('.btn-move-up').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            if (idx > 0) {
                syncCurrentValues();
                const temp = currentBanners[idx];
                currentBanners[idx] = currentBanners[idx - 1];
                currentBanners[idx - 1] = temp;
                renderBanners();
            }
        });
    });

    document.querySelectorAll('.btn-move-down').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            if (idx < currentBanners.length - 1) {
                syncCurrentValues();
                const temp = currentBanners[idx];
                currentBanners[idx] = currentBanners[idx + 1];
                currentBanners[idx + 1] = temp;
                renderBanners();
            }
        });
    });

    document.querySelectorAll('.upload-existing-img').forEach(input => {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const idx = parseInt(e.target.getAttribute('data-index'));
            if (file) {
                e.target.parentElement.innerHTML = 'Đang nén...';
                compressImage(file, (base64String) => {
                    if (base64String) {
                        currentBanners[idx].imageUrl = base64String;
                        renderBanners();
                        showToast("Đã tải ảnh lên thành công. Nhớ bấm LƯU TẤT CẢ!");
                    } else {
                        showToast("Lỗi nén ảnh.", true);
                    }
                });
            }
        });
    });
}

function syncCurrentValues() {
    const items = document.querySelectorAll('.banner-info');
    items.forEach(item => {
        const idx = parseInt(item.getAttribute('data-index'));
        currentBanners[idx].imageUrl = item.querySelector('.edit-img').value;
        currentBanners[idx].headline = item.querySelector('.edit-headline').value;
        currentBanners[idx].subheadline = item.querySelector('.edit-sub').value;
        currentBanners[idx].buttonText = item.querySelector('.edit-btn').value;
    });
}

async function saveBannersToFirebase(successMsg = "Đã lưu tất cả thay đổi!", isDelete = false) {
    if (!isDelete) syncCurrentValues();
    try {
        await set(ref(db, 'config/banners'), currentBanners);
        showToast(successMsg);
    } catch (e) {
        showToast("Lỗi khi lưu dữ liệu.", true);
    }
}

saveAllBannersBtn.addEventListener('click', () => {
    saveBannersToFirebase();
});

addBannerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newBanner = {
        imageUrl: document.getElementById('newImgUrl').value.trim(),
        headline: document.getElementById('newHeadline').value.trim(),
        subheadline: document.getElementById('newSubheadline').value.trim(),
        buttonText: document.getElementById('newBtnText').value.trim()
    };

    currentBanners.push(newBanner);
    syncCurrentValues(); // Sync before re-rendering
    saveBannersToFirebase("Đã thêm banner mới!");
    addBannerForm.reset();
});

// New Banner Image Upload
document.getElementById('imageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        e.target.parentElement.innerHTML = 'Đang tải và nén...';
        compressImage(file, (base64String) => {
            if (base64String) {
                document.getElementById('newImgUrl').value = base64String;
                document.querySelector('.btn-outline').innerHTML = `
                    Tải Xong!
                    <input type="file" id="imageUpload" accept="image/*" style="display: none;">
                `;
                // reattach listener since we modified innerHTML
                document.getElementById('imageUpload').addEventListener('change', arguments.callee);
                showToast("Nén ảnh thành công!");
            } else {
                showToast("Lỗi tải ảnh.", true);
            }
        });
    }
});


// ============================================
// TAB: CUSTOMERS MANAGEMENT
// ============================================
const customersTableBody = document.getElementById('customersTableBody');

function loadCustomers() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            allCustomers = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            })).sort((a, b) => (b.points || 0) - (a.points || 0)); // Sort by points descending
        } else {
            allCustomers = [];
        }
        renderCustomers();
    });
}

function renderCustomers() {
    if (!customersTableBody) return; // Guard clause in case HTML isn't loaded yet

    customersTableBody.innerHTML = '';
    if (allCustomers.length === 0) {
        customersTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#64748b;padding:2rem;">Chưa có hội viên nào.</td></tr>';
        return;
    }

    allCustomers.forEach(customer => {
        const tr = document.createElement('tr');

        // Format points
        const pointsFmt = (customer.points || 0).toLocaleString('vi-VN');

        const custInfo = `
            <strong>${customer.name || 'Khách Vô Danh'}</strong>
        `;

        const contactInfo = `
            ${customer.phone || 'Chưa cập nhật SĐT'}<br>
            <small style="color:#64748b;">${customer.email || 'Chưa cập nhật Email'}</small>
        `;

        tr.innerHTML = `
            <td>${custInfo}</td>
            <td>${contactInfo}</td>
            <td style="text-align: right; font-weight: 700; color: #f59e0b;">${pointsFmt} điểm</td>
        `;
        customersTableBody.appendChild(tr);
    });
}

// ============================================
// INITIALIZATION
// ============================================
// Start listening to the DB immediately
loadOrders();
loadProducts();
loadBanners();
loadCustomers();
