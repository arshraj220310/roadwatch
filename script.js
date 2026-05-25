// Navigation Setup
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(nav => nav.classList.remove('active'));
        contentSections.forEach(section => section.classList.remove('active'));
        item.classList.add('active');
        const sectionId = item.getAttribute('data-section');
        document.getElementById(sectionId).classList.add('active');
    });
});

// World Map Canvas
const canvas = document.getElementById('worldMap');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    drawMap();
}

let mapZoom = 1;
let mapOffsetX = 0;
let mapOffsetY = 0;

function drawMap() {
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, width, height);
    
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a2332');
    gradient.addColorStop(1, '#141c28');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    ctx.save();
    ctx.translate(width / 2 + mapOffsetX, height / 2 + mapOffsetY);
    ctx.scale(mapZoom, mapZoom);
    ctx.translate(-width / 2, -height / 2);
    
    drawContinents();
    drawRoadNetworks();
    
    ctx.restore();
}

function drawContinents() {
    ctx.strokeStyle = 'rgba(253, 185, 19, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 80, 120, 100);
    ctx.strokeRect(100, 190, 60, 100);
    ctx.strokeRect(280, 60, 80, 60);
    ctx.strokeRect(300, 130, 80, 120);
    ctx.strokeRect(380, 50, 150, 130);
    ctx.strokeRect(520, 240, 50, 60);
}

function drawRoadNetworks() {
    const roads = [
        { x1: 100, y1: 130, x2: 150, y2: 140, status: 'operational' },
        { x1: 150, y1: 140, x2: 180, y2: 150, status: 'operational' },
        { x1: 300, y1: 100, x2: 350, y2: 110, status: 'maintenance' },
        { x1: 350, y1: 110, x2: 380, y2: 120, status: 'operational' },
        { x1: 400, y1: 80, x2: 450, y2: 90, status: 'operational' },
        { x1: 450, y1: 90, x2: 500, y2: 100, status: 'operational' },
        { x1: 480, y1: 130, x2: 530, y2: 140, status: 'operational' },
        { x1: 530, y1: 140, x2: 550, y2: 170, status: 'issue' },
        { x1: 320, y1: 180, x2: 360, y2: 200, status: 'operational' },
        { x1: 360, y1: 200, x2: 380, y2: 230, status: 'maintenance' },
        { x1: 150, y1: 240, x2: 200, y2: 260, status: 'operational' },
        { x1: 200, y1: 260, x2: 240, y2: 280, status: 'operational' },
    ];
    
    roads.forEach(road => {
        if (road.status === 'operational') {
            ctx.strokeStyle = '#4ade80';
        } else if (road.status === 'maintenance') {
            ctx.strokeStyle = '#f59e0b';
        } else {
            ctx.strokeStyle = '#ef4444';
        }
        
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(road.x1, road.y1);
        ctx.lineTo(road.x2, road.y2);
        ctx.stroke();
        
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(road.x1, road.y1, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(road.x2, road.y2, 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

document.getElementById('zoomIn').addEventListener('click', () => {
    mapZoom = Math.min(mapZoom + 0.2, 3);
    drawMap();
});

document.getElementById('zoomOut').addEventListener('click', () => {
    mapZoom = Math.max(mapZoom - 0.2, 0.5);
    drawMap();
});

document.getElementById('resetMap').addEventListener('click', () => {
    mapZoom = 1;
    mapOffsetX = 0;
    mapOffsetY = 0;
    drawMap();
});

window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

// Table Row Interactions
const tableRows = document.querySelectorAll('.routes-table tbody tr');

tableRows.forEach(row => {
    row.addEventListener('click', () => {
        const routeName = row.cells[0].textContent;
        console.log('Clicked route:', routeName);
    });
});

// Button Interactions
const exportBtn = document.querySelector('.export-btn');
exportBtn.addEventListener('click', () => {
    alert('Report exported successfully!');
});

// User Profile
const userProfile = document.querySelector('.user-profile');
userProfile.addEventListener('click', () => {
    alert('User profile menu would open here');
});

// Stat Card Animations
const statCards = document.querySelectorAll('.stat-card');

statCards.forEach((card, index) => {
    card.style.animation = `slideUp 0.5s ease-out ${index * 0.1}s backwards`;
});

const bottomStatCards = document.querySelectorAll('.bottom-stat-card');

bottomStatCards.forEach((card, index) => {
    card.style.animation = `slideUp 0.5s ease-out ${(statCards.length + index) * 0.1}s backwards`;
});

const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);

// Notification Bell
const notificationBell = document.querySelector('.notification-bell');
notificationBell.addEventListener('click', () => {
    alert('You have 3 new notifications!');
});

// Country Selector
const countrySelector = document.querySelector('.country-selector');
countrySelector.addEventListener('change', (e) => {
    console.log('Selected country:', e.target.value);
});

// Initialize Dashboard
console.log('Roadwatch Dashboard initialized successfully!');