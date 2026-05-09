const CONFIG = {
    MAX_WIDTH: 1200,
    QUALITY: 0.7,
    MAX_PHOTOS: 4,
    IMGBB_KEY: 'a80c5c589d5cee1d3589f36a1c9bcfea'
};

const firebaseConfig = {
  apiKey: "AIzaSyAbY3NTtzDjIlMKdS-NHZSlEVcf_oQPRQ0",
  authDomain: "dlqc-8866c.firebaseapp.com",
  projectId: "dlqc-8866c",
  storageBucket: "dlqc-8866c.firebasestorage.app",
  messagingSenderId: "521467918771",
  appId: "1:521467918771:web:ea6d450298e8c4dded73c6",
  measurementId: "G-RP2K0F6E81"
};

const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
const db = app.firestore();
const auth = app.auth();

let currentFilter = 'all';

const StorageService = {
    async upload(blob) {
        const formData = new FormData();
        formData.append("image", blob);
        
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_KEY}`, {
            method: "POST",
            body: formData
        });
        
        const result = await res.json();
        if (!result.success) throw new Error(result.error?.message || "Erreur ImgBB");
        return result.data.url;
    }
};

const SessionManager = {
    check() {
        auth.onAuthStateChanged(user => {
            UI.toggleAdminView(!!user);
            if (user) loadAlbums();
        });
    },
    logout() {
        auth.signOut().then(() => location.reload());
    }
};

const UI = {
    toggleAdminView(isLogged) {
        const views = {
            'login-zone': isLogged ? 'none' : 'flex',
            'admin-content': isLogged ? 'block' : 'none',
            'logout-btn': isLogged ? 'flex' : 'none'
        };
        Object.entries(views).forEach(([id, display]) => {
            const el = document.getElementById(id);
            if (el) el.style.display = display;
        });
    }
}

async function checkAdmin() {
    const email = "drip.line.qc@gmail.com";
    const pass = document.getElementById('admin-pass').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        alert("Code invalide.");
    }
}

const getBadgeStyle = (value) => {
    const val = value.trim().toLowerCase();


    const grayTerms = ['medium', 'supérieur', 'superieur'];
    if (grayTerms.includes(val)) return 'background: #444; color: #eee;';

    const s = new Option().style;
    s.color = val;

    return s.color !== '' 
        ? `background: ${val}; color: ${isDarkColor(val) ? 'white' : 'black'}; border: none;`
        : 'background: #444; color: #eee;';
};

const isDarkColor = (color) => {
    if (['black', 'noir', 'navy', 'purple'].includes(color.toLowerCase())) return true;
    return false;
};

async function compressImage(file) {
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
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => resolve(blob), 'image/jpeg', CONFIG.QUALITY);
            };
        };
        reader.onerror = reject;
    });
}

function previewImages() {
    const previewZone = document.getElementById('publish-preview-zone');
    const files = document.getElementById('photo-input').files;
    
    previewZone.innerHTML = "";

    if (files.length > 4) {
        alert("4 photos maximum");
        document.getElementById('photo-input').value = "";
        return;
    }

    if (files) {
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement("img");
                img.src = e.target.result;
                previewZone.appendChild(img);
            }
            reader.readAsDataURL(file);
        });
    }
}

async function uploadToImgBB(file) {
    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch(`${CONFIG.IMGBB_API}`, {
            method: "POST",
            body: formData
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error?.message || "Erreur ImgBB");
        
        return result.data.url;
    } catch (error) {
        console.error("Échec de l'upload:", error);
        throw error;
    }
}

function filterCat(cat) {
    currentFilter = cat;
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    const activeBtn = document.getElementById('cat-' + cat);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    loadAlbums();
}

function loadAlbums() {
    const gallery = document.getElementById('gallery');
    const inventory = document.getElementById('admin-inventory-list');

    db.collection("albums").orderBy("date", "desc").onSnapshot(snap => {
        let htmlGallery = "";
        let htmlInventory = "";
        let hasContent = false;

        if (gallery) gallery.innerHTML = ""; 

        snap.forEach(doc => {
            const a = doc.data();
            const id = doc.id;

            if (currentFilter === 'all' || a.category === currentFilter) {
                hasContent = true;
                
                if (gallery) {
                    htmlGallery += `
                        <div class="album-card" onclick="openAlbum('${id}')">
                            <div class="album-image-wrapper">
                                <img src="${a.cover}" loading="lazy"> <div class="photo-count-badge">${a.images.length} PICS</div>
                            </div>
                            <div class="album-info">
                                <h3 class="album-title">${a.name}</h3>
                                <p class="album-meta">${a.category.toUpperCase()}</p>
                            </div>
                        </div>`;
                }
            }

            if (inventory) {
                htmlInventory += `
                    <div class="inventory-item">
                        <span><strong>${a.name}</strong> (${a.category})</span>
                        <button class="btn-delete" onclick="deleteAlbum('${id}')">Supprimer</button>
                    </div>`;
            }
        });

        if (gallery) {
            if (!hasContent) {
                gallery.innerHTML = `<div class="nothing-msg">Nothing yet in ${currentFilter}...</div>`;
            } else {
                gallery.innerHTML = htmlGallery;
            }
        }

        if (inventory) {
            inventory.innerHTML = htmlInventory || "<p>Aucun album en stock.</p>";
        }
    });
}

async function openAlbum(id) {
    const doc = await db.collection("albums").doc(id).get();
    const a = doc.data();

    document.getElementById('modal-title').textContent = a.name;
    document.getElementById('modal-desc').textContent = a.description || "Aucun détail additionnel.";

    const badgeContainer = document.getElementById('modal-badges');
    badgeContainer.innerHTML = '';

(a.quality || []).forEach(q => {
    badgeContainer.innerHTML += `<span class="badge" style="${getBadgeStyle(q)}">${q}</span>`;
});

if (a.colors) {
    a.colors.split(',').forEach(c => {
        const colorName = c.trim();
        const translation = { 'noir': 'black', 'rouge': 'red', 'bleu': 'blue', 'vert': 'green' };
        const cssColor = translation[colorName.toLowerCase()] || colorName;
        
        badgeContainer.innerHTML += `<span class="badge" style="${getBadgeStyle(cssColor)}">${colorName}</span>`;
    });
}

    const container = document.getElementById('modal-images-list');
    container.innerHTML = a.images.map(imgUrl => `
        <div class="zoom-img-container">
            <img src="${imgUrl}" alt="QC Detail" loading="lazy" onclick="window.open('${imgUrl}', '_blank')">
        </div>
    `).join('');

    document.getElementById('album-modal').style.display = "block";
    document.body.style.overflow = "hidden";
}

function closeAlbum() { 
    document.getElementById('album-modal').style.display = "none"; 
    document.body.style.overflow = "auto";
}

async function handlePublish() {
    
    const ui = {
        name: document.getElementById('album-name'),
        cat: document.querySelector('input[name="category"]:checked'),
        desc: document.getElementById('album-desc'),
        colors: document.getElementById('album-colors'),
        qualities: Array.from(document.querySelectorAll('.quality-selector input:checked')).map(el => el.value),
        input: document.getElementById('photo-input'),
        btn: document.getElementById('publish-btn')
    };
    
    const files = Array.from(ui.input.files);
    const nameVal = ui.name.value.trim();

    if (!nameVal || files.length === 0) return alert("Données manquantes.");
    
    ui.btn.disabled = true;
    ui.btn.innerText = "Traitement...";

    try {
        const urls = await Promise.all(files.map(async file => {
            const blob = await compressImage(file);
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
        await db.collection("albums").doc(id).delete();
    }
}

async function logout() {
    try {
        await firebase.auth().signOut();
        localStorage.removeItem('adminSession');
        location.reload();
    } catch (e) {
        localStorage.removeItem('adminSession');
        location.reload();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    SessionManager.check();
    loadAlbums();
});
