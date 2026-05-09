const firebaseConfig = {
  apiKey: "AIzaSyAbY3NTtzDjIlMKdS-NHZSlEVcf_oQPRQ0",
  authDomain: "dlqc-8866c.firebaseapp.com",
  projectId: "dlqc-8866c",
  storageBucket: "dlqc-8866c.firebasestorage.app",
  messagingSenderId: "521467918771",
  appId: "1:521467918771:web:ea6d450298e8c4dded73c6",
  measurementId: "G-RP2K0F6E81"
};

const IMGBB_API_KEY = 'a80c5c589d5cee1d3589f36a1c9bcfea';

const CONFIG = {
    MAX_WIDTH: 1200,
    QUALITY: 0.7,
    MAX_PHOTOS: 4,
    IMGBB_API: `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();
let currentFilter = 'all';

async function checkAdmin() {
    const email = "drip.line.qc@gmail.com"
    const pass = document.getElementById('admin-pass').value;
    
    if(!pass) return alert("Veuillez entrer le code.");

    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, pass);

        const expirationDate = new Date().getTime() + (7 * 24 * 60 * 60 * 1000);
        localStorage.setItem('adminSession', JSON.stringify({
            token: "AUTHORIZED",
            uid: userCredential.user.uid,
            expires: expirationDate
        }));

        showAdminPanel();
        
    } catch (error) {
        console.error(error);
        alert("Accès refusé : Code invalide.");
    }
}

function showAdminPanel() {
    const loginZone = document.getElementById('login-zone');
    const adminContent = document.getElementById('admin-content');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginZone) loginZone.style.display = 'none';
    if (adminContent) adminContent.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'flex';

    if (typeof loadAlbums === "function") {
        loadAlbums();
    }
}

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
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', CONFIG.QUALITY);
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

function checkSession() {
    const sessionData = localStorage.getItem('adminSession');
    if (sessionData) {
        const session = JSON.parse(sessionData);
        const now = new Date().getTime();
        if (session.token === "AUTHORIZED" && now < session.expires) {
            showAdminPanel();
        } else {
            localStorage.removeItem('adminSession');
        }
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

    document.getElementById('modal-title').innerHTML = `<div class="modal-title-header"><h2>${a.name}</h2></div>`;
    document.getElementById('modal-desc').innerText = a.description || "Aucun détail additionnel pour cet article.";

    const container = document.getElementById('modal-images-list');
    container.innerHTML = a.images.map(imgUrl => `
        <div class="zoom-img-container">
            <img src="${imgUrl}" alt="QC Detail" onclick="window.open('${imgUrl}', '_blank')">
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
        cat: document.getElementById('album-category'),
        desc: document.getElementById('album-desc'),
        input: document.getElementById('photo-input'),
        btn: document.getElementById('publish-btn')
    };

const files = Array.from(ui.input.files);
    const nameVal = ui.name.value.trim();

    if (!nameVal || files.length === 0) return alert("Données manquantes.");
    
    ui.btn.disabled = true;
    ui.btn.innerText = "Traitement...";

    try {
        const snap = await db.collection("albums").where("name", "==", nameVal).limit(1).get();
        if (!snap.empty) throw new Error("Cet article existe déjà.");

        const uploadPromises = files.map(async (file) => {
            const compressed = await compressImage(file);
            return await uploadToImgBB(compressed);
        });

        const urls = await Promise.all(uploadPromises);

        await db.collection("albums").add({
            name: nameVal,
            category: ui.cat.value,
            description: ui.desc.value,
            images: urls,
            cover: urls[0],
            date: new Date().toISOString()
        });

        alert("Succès !");
        location.reload();

    } catch (err) {
        alert(`Erreur : ${err.message}`);
        ui.btn.disabled = false;
        ui.btn.innerText = "PUBLIER SUR DLQC";
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

window.onload = loadAlbums;
document.addEventListener('DOMContentLoaded', checkSession);