import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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

// Helper function to compress and convert image to Base64
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

            // Compress to JPEG 80%
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            callback(dataUrl);
        };
        img.onerror = () => {
            alert("Lỗi phân tích hình ảnh.");
            callback(null);
        }
    };
    reader.onerror = () => {
        alert("Lỗi đọc file ảnh.");
        callback(null);
    };
}

let currentBanners = [];

const bannerListEl = document.getElementById('bannerList');
const loadingEl = document.getElementById('loading');
const saveAllBtn = document.getElementById('saveAllBtn');
const addBannerForm = document.getElementById('addBannerForm');
const imageUpload = document.getElementById('imageUpload');
const imgUrlInput = document.getElementById('newImgUrl');

async function loadBanners() {
    try {
        const snapshot = await get(ref(db, 'config/banners'));
        if (snapshot.exists()) {
            currentBanners = snapshot.val() || [];
        } else {
            currentBanners = [];
        }
        renderBanners();
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
        alert("Lỗi kết nối Firebase. Vui lòng kiểm tra lại quyền truy cập.");
    } finally {
        loadingEl.classList.add('hidden');
        bannerListEl.classList.remove('hidden');
        saveAllBtn.style.display = 'block';
    }
}

function renderBanners() {
    bannerListEl.innerHTML = '';

    if (currentBanners.length === 0) {
        bannerListEl.innerHTML = '<p style="text-align:center; color:#64748b;">Chưa có banner nào.</p>';
        return;
    }

    currentBanners.forEach((b, index) => {
        const item = document.createElement('div');
        item.className = 'banner-item';
        // HTML encode to prevent breaking inputs
        const safeHeadline = b.headline.replace(/"/g, '&quot;');
        const safeSub = b.subheadline.replace(/"/g, '&quot;');

        item.innerHTML = `
            <img src="${b.imageUrl}" alt="Banner Preview" class="banner-img-preview" onerror="this.src='https://via.placeholder.com/150x80?text=Lỗi+Ảnh'">
            <div class="banner-info" data-index="${index}">
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: flex-end;">
                    <div style="flex:1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <small>Link Ảnh (Bắt buộc)</small>
                            <label class="btn btn-outline" style="padding: 0.2rem 0.6rem; font-size: 0.75rem; cursor: pointer; white-space: nowrap; margin-bottom: 0;">
                                Tải Ảnh Lên
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
                <div><small>Tiêu đề lớn (Cho phép HTML)</small><input type="text" class="edit-headline" value="${safeHeadline}"></div>
                <div><small>Mô tả nhỏ</small><input type="text" class="edit-sub" value="${safeSub}"></div>
                
                <div class="actions">
                    <button class="btn btn-danger btn-delete" data-index="${index}">Xóa</button>
                    ${index > 0 ? `<button class="btn btn-outline btn-move-up" data-index="${index}" style="padding: 0.5rem;">Lên ↑</button>` : ''}
                    ${index < currentBanners.length - 1 ? `<button class="btn btn-outline btn-move-down" data-index="${index}" style="padding: 0.5rem;">Xuống ↓</button>` : ''}
                </div>
            </div>
        `;
        bannerListEl.appendChild(item);
    });

    attachListEvents();
}

function attachListEvents() {
    // Collect data into array on blur of any input to keep currentBanners in sync
    document.querySelectorAll('.edit-img, .edit-headline, .edit-sub, .edit-btn').forEach(input => {
        input.addEventListener('change', (e) => {
            const index = e.target.closest('.banner-info').getAttribute('data-index');
            const fieldClass = e.target.className;

            if (fieldClass.includes('edit-img')) currentBanners[index].imageUrl = e.target.value;
            if (fieldClass.includes('edit-headline')) currentBanners[index].headline = e.target.value;
            if (fieldClass.includes('edit-sub')) currentBanners[index].subheadline = e.target.value;
            if (fieldClass.includes('edit-btn')) currentBanners[index].buttonText = e.target.value;
        });
    });

    document.querySelectorAll('.upload-existing-img').forEach(input => {
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const index = e.target.getAttribute('data-index');
            const infoDiv = e.target.closest('.banner-info');
            const imgInput = infoDiv.querySelector('.edit-img');
            const previewImg = e.target.closest('.banner-item').querySelector('.banner-img-preview');

            imgInput.value = "Đang tải ảnh lên (thông qua ImgBB)...";
            imgInput.disabled = true;

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Image = reader.result.split(',')[1];
                const formData = new FormData();
                formData.append('image', base64Image);

                try {
                    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                        method: 'POST',
                        body: formData
                    });

                    const data = await response.json();

                    if (data.success) {
                        const downloadURL = data.data.url;
                        imgInput.value = downloadURL;
                        previewImg.src = downloadURL;
                        currentBanners[index].imageUrl = downloadURL;
                        saveAllBtn.style.display = 'block'; // Ensure save button is visible to prompt save
                    } else {
                        throw new Error(data.error?.message || "Lỗi tải ảnh lên ImgBB");
                    }
                } catch (error) {
                    console.error("Upload failed", error);
                    alert("Lỗi tải ảnh lên. Vui lòng thử lại sau.");
                    imgInput.value = currentBanners[index].imageUrl;
                } finally {
                    imgInput.disabled = false;
                }
            };
            reader.onerror = () => {
                alert("Lỗi đọc file ảnh trên máy của bạn.");
                imgInput.disabled = false;
                imgInput.value = currentBanners[index].imageUrl;
            };
        });
    });

    // Delete
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            if (confirm('Bạn có chắc muốn xóa banner này?')) {
                currentBanners.splice(index, 1);
                renderBanners();
            }
        });
    });

    // Move Up
    document.querySelectorAll('.btn-move-up').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            [currentBanners[index - 1], currentBanners[index]] = [currentBanners[index], currentBanners[index - 1]];
            renderBanners();
        });
    });

    // Move Down
    document.querySelectorAll('.btn-move-down').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            [currentBanners[index + 1], currentBanners[index]] = [currentBanners[index], currentBanners[index + 1]];
            renderBanners();
        });
    });
}

// Gather all inputs and save to Firebase
saveAllBtn.addEventListener('click', async () => {
    saveAllBtn.textContent = "Đang lưu...";
    saveAllBtn.disabled = true;

    const newBanners = [];
    document.querySelectorAll('.banner-info').forEach(infoDiv => {
        newBanners.push({
            imageUrl: infoDiv.querySelector('.edit-img').value.trim(),
            headline: infoDiv.querySelector('.edit-headline').value.trim(),
            subheadline: infoDiv.querySelector('.edit-sub').value.trim(),
            buttonText: infoDiv.querySelector('.edit-btn').value.trim()
        });
    });

    try {
        await set(ref(db, 'config/banners'), newBanners);
        currentBanners = newBanners;
        showToast();
    } catch (e) {
        alert("Lỗi lưu dữ liệu: " + e.message);
    } finally {
        saveAllBtn.textContent = "LƯU TẤT CẢ THAY ĐỔI";
        saveAllBtn.disabled = false;
        renderBanners();
    }
});

// Add New Form
addBannerForm.addEventListener('submit', (e) => {
    e.preventDefault();

    currentBanners.push({
        imageUrl: document.getElementById('newImgUrl').value.trim(),
        headline: document.getElementById('newHeadline').value.trim(),
        subheadline: document.getElementById('newSubheadline').value.trim(),
        buttonText: document.getElementById('newBtnText').value.trim()
    });

    renderBanners();
    addBannerForm.reset();

    // Automatically trigger save and scroll up
    saveAllBtn.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Image Upload Logic (ImgBB) for Add New Banner Form
imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    imgUrlInput.value = "Đang xử lý ảnh (Tối ưu hóa)...";
    imgUrlInput.disabled = true;

    compressImage(file, (dataUrl) => {
        if (dataUrl) {
            imgUrlInput.value = dataUrl;
        } else {
            imgUrlInput.value = "";
        }
        imgUrlInput.disabled = false;
    });
});

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Initial load
loadBanners();
