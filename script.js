const firebaseConfig = {
  apiKey: "AIzaSyAbY3NTtzDjIlMKdS-NHZSlEVcf_oQPRQ0",
  authDomain: "dlqc-8866c.firebaseapp.com",
  projectId: "dlqc-8866c",
  storageBucket: "dlqc-8866c.firebasestorage.app",
  messagingSenderId: "521467918771",
  appId: "1:521467918771:web:ea6d450298e8c4dded73c6",
  measurementId: "G-RP2K0F6E81"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const IMGBB_API_KEY = 'a6fb312de00137611e8f3eb76a5fb7d4';
let currentFilter = 'all';

async function checkAdmin() {
    const email = "drip.line.qc@gmail.com";
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
    
    if (loginZone) loginZone.style.display = 'none';
    if (adminContent) adminContent.style.display = 'block';


    if (typeof loadAlbums === "function") {
        loadAlbums();
    }
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
    const name = document.getElementById('album-name').value;
    const cat = document.getElementById('album-category').value;
    const desc = document.getElementById('album-desc').value;
    const fileInput = document.getElementById('photo-input');
    const files = document.getElementById('photo-input').files;
    const btn = document.getElementById('publish-btn');

    if (!name || files.length === 0) return alert("Minimum 1 photo");
    
    if (files.length > 4) {
        alert("maximum 4 photos.");
        return;
    }
    const check = await db.collection("albums").where("name", "==", name).get();
    if (!check.empty) return alert("Un album porte déjà ce nom !");

    btn.innerText = "Upload en cours (0/" + files.length + ")...";
    btn.disabled = true;

    try {
        let allImageUrls = [];

        for (let i = 0; i < files.length; i++) {
            btn.innerText = `Upload : ${i + 1}/${files.length}...`;
            
            let formData = new FormData();
            formData.append("image", files[i]);

            let response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });

            let result = await response.json();
            if (result.success) {
                allImageUrls.push(result.data.url);
            }
        }

        await db.collection("albums").add({
            name: name,
            category: cat,
            description: desc,
            images: allImageUrls,
            cover: allImageUrls[0],
            date: new Date().toISOString()
        });

        alert("Succès ! Votre Nike Tech est en ligne avec " + allImageUrls.length + " photos.");
        location.reload();

    } catch (error) {
        console.error(error);
        alert("Erreur lors de l'upload. Vérifiez votre connexion.");
        btn.innerText = "PUBLIER SUR DLQC";
        btn.disabled = false;
    }
}

async function deleteAlbum(id) {
    if (confirm("Supprimer définitivement cet album ?")) {
        await db.collection("albums").doc(id).delete();
    }
}

window.onload = loadAlbums;
document.addEventListener('DOMContentLoaded', checkSession);
