// 1. CONFIGURATION & INITIALISATION
const CONFIG = {
    MAX_WIDTH: 2048,
    QUALITY: 0.85,
    MAX_PHOTOS: 4,
    IMGBB_KEY: 'a80c5c589d5cee1d3589f36a1c9bcfea',
    ADMIN_EMAIL: "drip.line.qc@gmail.com"
};

const firebaseConfig = {
    apiKey: "AIzaSyAbY3NTtzDjIlMKdS-NHZSlEVcf_oQPRQ0",
    authDomain: "dlqc-8866c.firebaseapp.com",
    projectId: "dlqc-8866c",
    storageBucket: "dlqc-8866c.firebasestorage.app",
    messagingSenderId: "521467918771",
    appId: "1:521467918771:web:ea6d450298e8c4dded73c6"
};

const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
const db = app.firestore();
const auth = app.auth();

const AppState = {
    currentFilter: 'all',
    searchQuery: '',
    cachedAlbums: [],
    selectedFiles: [] 
};

// 2. SERVICES
const StorageService = {
    async upload(blob) {
        const formData = new FormData();
        formData.append("image", blob, "image.webp"); 
        
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_KEY}`, {
            method: "POST",
            body: formData
        });
        
        const result = await res.json();
        if (!result.success) throw new Error(result.error?.message || "Échec de l'envoi sur ImgBB");
        return result.data.url;
    },

    applySharpenFilter(ctx, imageData) {
        const w = imageData.width;
        const h = imageData.height;
        const input = imageData.data;
        const outputObj = ctx.createImageData(w, h);
        const output = outputObj.data;

        const weights = [
             0, -1,  0,
            -1,  5, -1,
             0, -1,  0
        ];
        const side = 3;
        const halfSide = 1;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const dstOff = (y * w + x) * 4;
                let r = 0, g = 0, b = 0;

                for (let cy = 0; cy < side; cy++) {
                    for (let cx = 0; cx < side; cx++) {
                        const scy = Math.min(h - 1, Math.max(0, y + cy - halfSide));
                        const scx = Math.min(w - 1, Math.max(0, x + cx - halfSide));
                        const srcOff = (scy * w + scx) * 4;
                        const wt = weights[cy * side + cx];

                        r += input[srcOff] * wt;
                        g += input[srcOff + 1] * wt;
                        b += input[srcOff + 2] * wt;
                    }
                }

                output[dstOff] = Math.min(255, Math.max(0, r));
                output[dstOff + 1] = Math.min(255, Math.max(0, g));
                output[dstOff + 2] = Math.min(255, Math.max(0, b));
                output[dstOff + 3] = input[dstOff + 3];
            }
        }
        return outputObj;
    }
};

async function compressImage(file, shouldEnhance = true) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                if (width > CONFIG.MAX_WIDTH) {
                    height = Math.round((height * CONFIG.MAX_WIDTH) / width);
                    width = CONFIG.MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                ctx.drawImage(img, 0, 0, width, height);
                
                if (shouldEnhance) {
                    try {
                        const imgData = ctx.getImageData(0, 0, width, height);
                        const sharpenedData = StorageService.applySharpenFilter(ctx, imgData);
                        ctx.putImageData(sharpenedData, 0, 0);
                    } catch (err) {
                        console.warn(err);
                    }
                }
                
                canvas.toBlob(blob => resolve(blob), 'image/webp', CONFIG.QUALITY);
            };
        };
        reader.onerror = reject;
    });
}

const BadgeManager = {
    translations: {
        'noir': 'black', 'blanc': 'white', 'rouge': 'red', 'bleu': 'blue',
        'vert': 'green', 'jaune': 'yellow', 'rose': 'pink', 'marron': 'brown',
        'gris': 'gray', 'violet': 'purple', 'orange': 'orange'
    },
    getStyle(value) {
        const val = value.trim().toLowerCase();
        if (['medium', 'supérieur', 'superieur'].includes(val)) {
            return 'background-color: #444; color: #eee;';
        }
        const color = this.translations[val] || val;
        const lightColors = ['white', 'blanc', 'yellow', 'jaune', 'pink', 'rose'];
        const textColor = lightColors.includes(color) ? '#111' : '#fff';
        return `background-color: ${color}; color: ${textColor}; border: none;`;
    },
    render(text) {
        const label = text.trim();
        return `<span class="badge" style="${this.getStyle(label)}">${label}</span>`;
    }
};

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    
    if ((AppState.selectedFiles.length + files.length) > CONFIG.MAX_PHOTOS) {
        alert(`Vous pouvez ajouter un maximum de ${CONFIG.MAX_PHOTOS} photos au total.`);
        event.target.value = ""; 
        return;
    }

    files.forEach(file => {
        file.uid = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        AppState.selectedFiles.push(file);
    });

    renderPreviews();
    event.target.value = "";
}

function removeSelectedFile(uid) {
    AppState.selectedFiles = AppState.selectedFiles.filter(file => file.uid !== uid);
    renderPreviews();
}

function renderPreviews() {
    const previewZone = document.getElementById('publish-preview-zone');
    if (!previewZone) return;
    
    previewZone.innerHTML = "";

    AppState.selectedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const container = document.createElement("div");
            container.className = "preview-item-container";
            container.innerHTML = `
                <img src="${e.target.result}" alt="Prévisualisation">
                <button type="button" class="btn-remove-preview" onclick="removeSelectedFile('${file.uid}')" aria-label="Supprimer cette image">&times;</button>
            `;
            previewZone.appendChild(container);
        };
        reader.readAsDataURL(file);
    });
}

function initLiveData() {
    const gallery = document.getElementById('gallery');
    const inventory = document.getElementById('admin-inventory-list');

    db.collection("albums").orderBy("date", "desc").onSnapshot(snap => {
        AppState.cachedAlbums = [];
        
        snap.forEach(doc => {
            AppState.cachedAlbums.push({
                id: doc.id,
                ...doc.data()
            });
        });

        renderGallery();
    }, error => console.error("Erreur Firestore:", error));
}

function renderGallery() {
    const gallery = document.getElementById('gallery');
    const inventory = document.getElementById('admin-inventory-list');
    
    let htmlGallery = "";
    let htmlInventory = "";
    let hasContent = false;

    const query = (AppState.searchQuery || '').toLowerCase().trim();

    AppState.cachedAlbums.forEach(album => {
        const matchesCategory = (AppState.currentFilter === 'all' || album.category === AppState.currentFilter);
        const matchesSearch = album.name.toLowerCase().includes(query) || 
                              (album.description && album.description.toLowerCase().includes(query)) ||
                              (album.colors && album.colors.toLowerCase().includes(query));

        if (gallery && matchesCategory && matchesSearch) {
            hasContent = true;
            htmlGallery += `
                <article class="album-card" onclick="navigateToAlbum('${album.id}')" role="button" tabIndex="0">
                    <div class="album-image-wrapper">
                        <img src="${album.cover}" loading="lazy" alt="${album.name}"> 
                        <div class="photo-count-badge">${album.images?.length || 0} PICS</div>
                    </div>
                    <div class="album-info">
                        <h3 class="album-title">${album.name}</h3>
                        <p class="album-meta">${album.category.toUpperCase()}</p>
                    </div>
                </article>`;
        }

        if (inventory) {
            htmlInventory += `
                <div class="inventory-item">
                    <span><strong>${album.name}</strong> (${album.category.toUpperCase()})</span>
                    <button class="btn-delete" onclick="deleteAlbum('${album.id}')">Supprimer</button>
                </div>`;
        }
    });

    if (gallery) {
        if (hasContent) {
            gallery.innerHTML = htmlGallery;
        } else {
            if (query.length > 0) {
                gallery.innerHTML = `<div class="nothing-msg">Aucun résultat pour "${AppState.searchQuery}"</div>`;
            } else {
                gallery.innerHTML = `<div class="nothing-msg">Aucun résultat</div>`;
            }
        }
    }
    
    if (inventory) {
        inventory.innerHTML = htmlInventory || "<p>Aucun article.</p>";
    }
}

async function handlePublish() {
    const ui = {
        name: document.getElementById('album-name'),
        cat: document.querySelector('input[name="category"]:checked'),
        desc: document.getElementById('album-desc'),
        colors: document.getElementById('album-colors'),
        qualities: Array.from(document.querySelectorAll('.quality-selector input:checked')).map(el => el.value),
        input: document.getElementById('photo-input'),
        btn: document.getElementById('publish-btn'),
        enhance: document.getElementById('enhance-toggle')
    };
    
    const files = AppState.selectedFiles;
    const nameVal = ui.name.value.trim();

    if (!nameVal || files.length === 0) return alert("Données manquantes.");
    
    ui.btn.disabled = true;
    ui.btn.innerText = "Traitement...";

    const shouldEnhance = ui.enhance ? ui.enhance.checked : true;

    try {
        const urls = await Promise.all(files.map(async file => {

            const blob = await compressImage(file, shouldEnhance);
            return await StorageService.upload(blob);
        }));

        await db.collection("albums").add({
            name: nameVal,
            category: ui.cat.value,
            quality: ui.qualities,
            colors: ui.colors.value.trim(),
            description: ui.desc.value,
            images: urls,
            cover: urls[0],
            date: new Date().toISOString()
        });

        location.reload();
    } catch (err) {
        alert(`Échec : ${err.message}`);
        ui.btn.disabled = false;
    }
}

async function deleteAlbum(id) {
    if (confirm("Supprimer définitivement cet album ?")) {
        try {
            await db.collection("albums").doc(id).delete();
        } catch (e) {
            alert("Erreur lors de la suppression.");
        }
    }
}

function navigateToAlbum(id) {
    if (id) {
        history.pushState({ albumId: id }, "", `?album=${id}`);
        openAlbum(id);
    } else {
        history.pushState({}, "", window.location.pathname);
        closeAlbum();
    }
}

function checkUrlRoute() {
    const params = new URLSearchParams(window.location.search);
    const albumId = params.get('album');
    if (albumId) {
        openAlbum(albumId);
    } else {
        closeAlbum();
    }
}

async function openAlbum(id) {
    try {
        const doc = await db.collection("albums").doc(id).get();
        if (!doc.exists) return;
        const a = doc.data();
        
        const ui = {
            title: document.getElementById('modal-title'),
            desc: document.getElementById('modal-desc'),
            badges: document.getElementById('modal-badges'),
            images: document.getElementById('modal-images-list'),
            modal: document.getElementById('album-modal')
        };

        if (!ui.modal) return;

        const allBadgesData = [...(a.quality || []), ...(a.colors ? a.colors.split(',') : [])];
        ui.badges.innerHTML = allBadgesData.filter(Boolean).map(item => BadgeManager.render(item)).join('');

        ui.title.textContent = a.name;
        ui.desc.textContent = a.description || "Aucun détail additionnel.";
        ui.images.innerHTML = (a.images || []).map(imgUrl => `
            <div class="zoom-img-container">
                <img src="${imgUrl}" alt="Détail de ${a.name}" loading="lazy" onclick="window.open('${imgUrl}', '_blank')">
            </div>
        `).join('');

        ui.modal.style.display = "block";
        document.body.style.overflow = "hidden";
    } catch (err) {
        console.error("Erreur de chargement de l'album :", err);
    }
}

function closeAlbum() { 
    const modal = document.getElementById('album-modal');
    if (modal) {
        modal.style.display = "none"; 
        document.body.style.overflow = "auto";
    }
}

function filterCat(cat) {
    AppState.currentFilter = cat;
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeBtn = document.getElementById('cat-' + cat);
    if (activeBtn) activeBtn.classList.add('active');
    
    renderGallery();
}

async function checkAdmin() {
    const pass = document.getElementById('admin-pass').value;
    try {
        await auth.signInWithEmailAndPassword(CONFIG.ADMIN_EMAIL, pass);
    } catch (e) {
        alert("Code ou accès refusé.");
    }
}

async function logout() {
    await auth.signOut();
    location.reload();
}

auth.onAuthStateChanged(user => {
    const isLogged = !!user;
    const views = {
        'login-zone': isLogged ? 'none' : 'flex',
        'admin-content': isLogged ? 'block' : 'none',
        'logout-btn': isLogged ? 'flex' : 'none'
    };
    Object.entries(views).forEach(([id, display]) => {
        const el = document.getElementById(id);
        if (el) el.style.display = display;
    });
    if (isLogged) initLiveData();
});

window.addEventListener('popstate', checkUrlRoute);

document.addEventListener('DOMContentLoaded', () => {
    initLiveData();
    if (typeof checkUrlRoute === 'function') checkUrlRoute();

    const searchBar = document.getElementById('search-bar');
    if (searchBar) {
        searchBar.addEventListener('input', (e) => {
            AppState.searchQuery = e.target.value;
            renderGallery();
        });
    }
    
    const photoInput = document.getElementById('photo-input');
    if (photoInput) {
        photoInput.addEventListener('change', handleFileSelect);
    }
});