
/* ═══════════════════════════════════════════════════
   RoadWatch – app.js
   Full application: Map, Chatbot, Analytics, Offline
════════════════════════════════════════════════════ */

const App = {
  country: 'india',
  currentRoad: null,
  userLat: null,
  userLng: null,
  complaintRoad: null,
  charts: {},
  mapInstance: null,
  mapMarkers: [],
  markerCluster: null,
  offlineDB: null,
  voiceActive: false,
  chatState: 'IDLE',
  chatContext: {},
  roadById: new Map(),
  roadsPage: 0,
  roadsPageSize: 80,
  roadsFilterKey: '',
  roadsTypeFilter: '',
  searchDebounce: null,

  getRoads() {
    return (typeof ROADS !== 'undefined' && ROADS[this.country]) ? ROADS[this.country] : [];
  },

  buildRoadIndex() {
    this.roadById.clear();
    const roads = this.getRoads();
    roads.forEach(r => this.roadById.set(r.road_id, r));
  },

  findRoadById(id) {
    return this.roadById.get(id) || this.getRoads().find(r => r.road_id === id);
  },

  findRoadByQuery(text) {
    const roads = this.getRoads();
    const exact = roads.filter(r => this.roadMatchesQuery(r, text));
    if (!exact.length) return null;
    const t = this.normalizeSearchQuery(text);
    const nhMatch = t.match(/(?:^|\s)nh\s*(\d+[a-z]*)/) || t.match(/^(\d+[a-z]*)$/);
    if (nhMatch) {
      const num = nhMatch[1] || nhMatch[0];
      const primary = exact.find(r => {
        const nh = (r.nh_number || '').toLowerCase().replace(/\s+/g, ' ');
        return nh === 'nh ' + num || nh.startsWith('nh ' + num + ' ');
      });
      if (primary) return primary;
    }
    return exact[0];
  },

  normalizeSearchQuery(q) {
    return String(q || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  },

  roadMatchesQuery(road, rawQuery) {
    const q = this.normalizeSearchQuery(rawQuery);
    if (!q) return true;

    const hay = [road.road_id, road.road_name, road.nh_number, road.city, road.state, road.description]
      .filter(Boolean).join(' ').toLowerCase().replace(/[^\w\s]/g, ' ');

    const nhInQuery = q.match(/(?:^|\s)nh\s*(\d+[a-z]*)/) || q.match(/^(\d+[a-z]*)$/);
    if (nhInQuery) {
      const num = nhInQuery[1] || nhInQuery[0];
      const nhTag = 'nh ' + num;
      const roadNh = (road.nh_number || '').toLowerCase().replace(/\s+/g, ' ');
      if (roadNh === nhTag || roadNh.startsWith(nhTag + ' ') || roadNh.includes(nhTag)) return true;
      if (hay.includes(nhTag) || hay.includes('nh ' + num)) return true;
    }

    const tokens = q.split(' ').filter(t => t.length > 0);
    if (!tokens.length) return true;
    return tokens.every(t => hay.includes(t));
  },

  getFilteredRoads(textFilter, typeFilter) {
    const type = typeFilter || '';
    return this.getRoads().filter(r => {
      if (type && r.road_type !== type) return false;
      return this.roadMatchesQuery(r, textFilter);
    });
  },

  countryCenter() {
    const centers = {
      india: { center: [20.5937, 78.9629], zoom: 5 },
      kenya: { center: [-0.5, 37.0], zoom: 6 },
      usa: { center: [39.5, -98.5], zoom: 4 },
      uk: { center: [54.5, -2.5], zoom: 6 },
      australia: { center: [-25.5, 133.0], zoom: 4 },
    };
    return centers[this.country] || centers.india;
  },

  /* ─── INIT ─── */
  init() {
    this.buildRoadIndex();
    this.initOfflineDB();
    this.initMap();
    this.initChat();
    this.initEvents();
    this.renderRoadsList();
    this.updateStats();
    this.getLocation();
    this.monitorOnline();
    setTimeout(() => this.initCharts(), 300);
  },

  /* ─── GEOLOCATION ─── */
  getLocation() {
    if (!navigator.geolocation) {
      document.getElementById('location-text').textContent = 'GPS unavailable';
      return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
      this.userLat = pos.coords.latitude;
      this.userLng = pos.coords.longitude;
      const roads = this.getRoads();
      const nearest = this.findNearest(this.userLat, this.userLng, roads);
      document.getElementById('location-text').textContent =
        nearest ? nearest.city + ', ' + nearest.state : 'Location found';
      if (this.mapInstance) {
        L.marker([this.userLat, this.userLng], {
          icon: L.divIcon({ className: '', html: '<div style="width:14px;height:14px;background:#10b981;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px #10b981"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })
        }).addTo(this.mapInstance).bindPopup('<b>📍 Your Location</b>');
      }
    }, () => {
      document.getElementById('location-text').textContent = 'Delhi, India (demo)';
      this.userLat = 28.6139; this.userLng = 77.2090;
    });
  },

  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  findNearest(lat, lng, roads) {
    let best = null, bestDist = Infinity;
    roads.forEach(r => {
      const d = this.haversine(lat, lng, r.location.lat, r.location.lng);
      if (d < bestDist) { bestDist = d; best = r; }
    });
    return best;
  },

  /* ─── QUALITY SCORE ─── */
  calcQuality(road) {
    const days = Math.floor((Date.now() - new Date(road.last_relay_date)) / 86400000);
    const agePenalty = Math.min(days / 20, 30);
    const potholePenalty = Math.min((road.pothole_reports || 0) * 4, 24);
    const spentRatio = road.amount_spent / Math.max(road.amount_sanctioned, 1);
    const utilPenalty = spentRatio > 0.98 ? 8 : spentRatio < 0.5 ? 5 : 0;
    const utilBonus = spentRatio >= 0.65 && spentRatio <= 0.92 ? 8 : 0;
    const score = Math.max(0, Math.min(100, Math.round(100 - agePenalty - potholePenalty - utilPenalty + utilBonus)));
    return score;
  },

  qualityLabel(score) {
    if (score >= 75) return { label: '🟢 Good', cls: 'quality-good', color: '#10b981' };
    if (score >= 45) return { label: '🟡 Moderate', cls: 'quality-moderate', color: '#f59e0b' };
    return { label: '🔴 Poor', cls: 'quality-poor', color: '#ef4444' };
  },

  /* ─── FORMAT CURRENCY ─── */
  formatAmount(amount, country) {
    const c = country || this.country;
    if (c === 'usa') return '$' + (amount / 1000000).toFixed(2) + 'M';
    if (c === 'kenya') return 'KES ' + (amount / 1000000000).toFixed(2) + 'B';
    if (c === 'uk') return '£' + (amount / 1000000).toFixed(2) + 'M';
    if (c === 'australia') return 'A$' + (amount / 1000000).toFixed(2) + 'M';
    const cr = amount / 10000000;
    if (cr >= 1000) return '₹' + (cr / 1000).toFixed(2) + 'k Cr';
    if (cr >= 1) return '₹' + cr.toFixed(2) + ' Cr';
    return '₹' + (amount / 100000).toFixed(2) + ' L';
  },

  /* ─── MAP ─── */
  initMap() {
    this.mapInstance = L.map('map', { zoomControl: true, attributionControl: false }).setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '©OpenStreetMap ©CartoDB', maxZoom: 19
    }).addTo(this.mapInstance);
    this.renderMapMarkers();
  },

  renderMapMarkers() {
    if (this.markerCluster) {
      this.mapInstance.removeLayer(this.markerCluster);
      this.markerCluster = null;
    }
    this.mapMarkers = [];

    const roads = this.getRoads();
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 12,
      chunkedLoading: true,
      chunkInterval: 50,
      chunkDelay: 20,
    });

    roads.forEach(road => {
      const score = this.calcQuality(road);
      const q = this.qualityLabel(score);
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${q.color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 8px ${q.color};cursor:pointer;"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7]
      });
      const safeId = road.road_id.replace(/'/g, "\\'");
      const marker = L.marker([road.location.lat, road.location.lng], { icon })
        .bindPopup(`
          <div class="map-popup-title">${this.escapeHtml(road.road_name)}</div>
          <div class="map-popup-row">📍 ${this.escapeHtml(road.city)}, ${this.escapeHtml(road.state)}</div>
          <div class="map-popup-row">🏗️ ${road.road_type}${road.road_length_km ? ' · ' + road.road_length_km + ' km' : ''}</div>
          <div class="map-popup-row">⭐ ${q.label} (${score}/100)</div>
          <div class="map-popup-row">🚧 ${road.pothole_reports} reports</div>
          <button class="btn btn-primary map-popup-btn" onclick="App.chatAboutRoad('${safeId}')">💬 Details</button>
        `);
      cluster.addLayer(marker);
      this.mapMarkers.push(marker);
    });

    this.markerCluster = cluster;
    this.mapInstance.addLayer(cluster);

    const { center, zoom } = this.countryCenter();
    this.mapInstance.setView(center, zoom);
  },

  escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  },

  chatAboutRoad(roadId) {
    const road = this.findRoadById(roadId);
    if (!road) return;
    document.getElementById('tab-chat').click();
    this.currentRoad = road;
    this.addBotMessage(`You selected **${road.road_name}**. Here's the full report:`);
    setTimeout(() => this.showRoadCard(road), 400);
  },

  /* ─── STATS ─── */
  updateStats() {
    const roads = this.getRoads();
    const good = roads.filter(r => this.calcQuality(r) >= 75).length;
    const total = roads.reduce((s, r) => s + r.amount_sanctioned, 0);
    const avg = roads.length ? total / roads.length : 0;
    document.getElementById('stat-total').textContent = roads.length.toLocaleString();
    document.getElementById('stat-good').textContent = good.toLocaleString();
    const complaints = parseInt(localStorage.getItem('rw_complaints') || '0');
    document.getElementById('stat-complaints').textContent = complaints;
    document.getElementById('stat-budget').textContent = this.formatAmount(avg, this.country) + ' avg';
    document.getElementById('stat-budget').title = 'Network total: ' + this.formatAmount(total, this.country);
  },

  /* ─── ROADS LIST (paginated) ─── */
  renderRoadsList(filter, typeFilter, resetPage) {
    if (filter !== undefined) this.roadsFilterKey = filter;
    if (typeFilter !== undefined) this.roadsTypeFilter = typeFilter;
    if (resetPage) this.roadsPage = 0;

    const all = this.getFilteredRoads(this.roadsFilterKey, this.roadsTypeFilter);
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / this.roadsPageSize));
    if (this.roadsPage >= totalPages) this.roadsPage = totalPages - 1;
    if (this.roadsPage < 0) this.roadsPage = 0;

    const start = this.roadsPage * this.roadsPageSize;
    const page = all.slice(start, start + this.roadsPageSize);

    const badge = document.getElementById('roads-count-badge');
    if (badge) badge.textContent = total ? `${total.toLocaleString()} roads` : 'No matches';

    const list = document.getElementById('roads-list');
    if (!page.length) {
      list.innerHTML = '<div class="roads-empty">No roads match your search. Try “NH 44” or a city name.</div>';
    } else {
      list.innerHTML = page.map(road => {
        const score = this.calcQuality(road);
        const q = this.qualityLabel(score);
        const safeId = road.road_id.replace(/'/g, "\\'");
        const shortName = road.road_name.length > 72 ? road.road_name.slice(0, 72) + '…' : road.road_name;
        return `<div class="road-list-item" onclick="App.chatAboutRoad('${safeId}')">
          <div>
            <div class="road-list-name">${this.escapeHtml(shortName)}</div>
            <div class="road-list-meta">
              <span>${this.escapeHtml(road.city)}</span><span>${this.escapeHtml(road.state)}</span>
              <span>${road.road_length_km} km</span>
              <span>🚧 ${road.pothole_reports}</span>
            </div>
          </div>
          <div class="road-list-right">
            <span class="road-type-badge badge-${road.road_type}">${road.road_type}</span><br/>
            <span class="quality-badge-inline ${q.cls}" style="margin-top:5px;">${q.label} ${score}</span>
          </div>
        </div>`;
      }).join('');
    }

    const footer = document.getElementById('roads-list-footer');
    if (footer) {
      footer.innerHTML = total > this.roadsPageSize ? `
        <button class="btn btn-secondary btn-sm" ${this.roadsPage === 0 ? 'disabled' : ''} onclick="App.roadsPrevPage()">← Prev</button>
        <span>Page ${this.roadsPage + 1} of ${totalPages} · showing ${start + 1}–${Math.min(start + this.roadsPageSize, total)}</span>
        <button class="btn btn-secondary btn-sm" ${this.roadsPage >= totalPages - 1 ? 'disabled' : ''} onclick="App.roadsNextPage()">Next →</button>
      ` : (total ? `<span>Showing all ${total} roads</span>` : '');
    }
  },

  roadsPrevPage() {
    if (this.roadsPage > 0) {
      this.roadsPage--;
      this.renderRoadsList();
      document.getElementById('roads-list')?.scrollTo(0, 0);
    }
  },

  roadsNextPage() {
    const total = this.getFilteredRoads(this.roadsFilterKey, this.roadsTypeFilter).length;
    if ((this.roadsPage + 1) * this.roadsPageSize < total) {
      this.roadsPage++;
      this.renderRoadsList();
      document.getElementById('roads-list')?.scrollTo(0, 0);
    }
  },

  /* ─── CHARTS ─── */
  initCharts() {
    const roads = this.getRoads();
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Inter';

    // Budget chart
    const top8 = [...roads].sort((a, b) => b.amount_sanctioned - a.amount_sanctioned).slice(0, 8);
    const bCtx = document.getElementById('budget-chart').getContext('2d');
    if (this.charts.budget) this.charts.budget.destroy();
    this.charts.budget = new Chart(bCtx, {
      type: 'bar',
      data: {
        labels: top8.map(r => r.road_name.length > 22 ? r.road_name.substring(0, 22) + '…' : r.road_name),
        datasets: [
          { label: 'Sanctioned', data: top8.map(r => r.amount_sanctioned / 10000000), backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 4 },
          { label: 'Spent', data: top8.map(r => r.amount_spent / 10000000), backgroundColor: 'rgba(6,182,212,0.7)', borderRadius: 4 }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => '₹' + v + 'Cr' } }, x: { grid: { display: false } } } }
    });

    // Type distribution
    const typeCounts = {};
    roads.forEach(r => { typeCounts[r.road_type] = (typeCounts[r.road_type] || 0) + 1; });
    const tCtx = document.getElementById('type-chart').getContext('2d');
    if (this.charts.type) this.charts.type.destroy();
    this.charts.type = new Chart(tCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(typeCounts),
        datasets: [{ data: Object.values(typeCounts), backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(168,85,247,0.8)', 'rgba(245,158,11,0.8)', 'rgba(16,185,129,0.8)'], borderWidth: 0 }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    // Quality distribution
    const qBuckets = { Good: 0, Moderate: 0, Poor: 0 };
    roads.forEach(r => {
      const s = this.calcQuality(r);
      if (s >= 75) qBuckets.Good++; else if (s >= 45) qBuckets.Moderate++; else qBuckets.Poor++;
    });
    const qCtx = document.getElementById('quality-chart').getContext('2d');
    if (this.charts.quality) this.charts.quality.destroy();
    this.charts.quality = new Chart(qCtx, {
      type: 'doughnut',
      data: {
        labels: ['Good', 'Moderate', 'Poor'],
        datasets: [{ data: [qBuckets.Good, qBuckets.Moderate, qBuckets.Poor], backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)', 'rgba(239,68,68,0.8)'], borderWidth: 0 }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    // Pothole chart
    const top6 = [...roads].sort((a, b) => b.pothole_reports - a.pothole_reports).slice(0, 6);
    const pCtx = document.getElementById('pothole-chart').getContext('2d');
    if (this.charts.pothole) this.charts.pothole.destroy();
    this.charts.pothole = new Chart(pCtx, {
      type: 'bar',
      data: {
        labels: top6.map(r => r.road_name.length > 20 ? r.road_name.substring(0, 20) + '…' : r.road_name),
        datasets: [{ label: 'Pothole Reports', data: top6.map(r => r.pothole_reports), backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 }]
      },
      options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' } }, y: { grid: { display: false } } } }
    });
  },

  /* ─── CHAT ─── */
  initChat() {
    setTimeout(() => {
      const n = this.getRoads().length;
      this.addBotMessage(`👋 Welcome to **RoadWatch** — road transparency for India & worldwide!\n\n**${n.toLocaleString()}** highways loaded for ${this.country.charAt(0).toUpperCase() + this.country.slice(1)}.\n\n• 📍 Find nearest road (GPS)\n• 💰 Budget & spending\n• 🚧 Report potholes\n• ⭐ Quality scores\n• 🔍 Try *\"NH 44\"* or *\"Mumbai\"*\n\nAsk: *\"Find my nearest road\"*`);
    }, 500);
  },

  detectIntent(text) {
    const t = text.toLowerCase();
    if (/pothole|damage|broken|crack|report|complaint|bad road|issue/.test(t)) return 'REPORT';
    if (/budget|money|spent|spending|fund|crore|amount|sanctioned/.test(t)) return 'BUDGET';
    if (/quality|score|condition|rating|good|bad|status/.test(t)) return 'QUALITY';
    if (/officer|contact|responsible|who is|engineer|authority/.test(t)) return 'OFFICER';
    if (/contractor|built|construct|company|builder/.test(t)) return 'CONTRACTOR';
    if (/near|my road|current|location|where|find|detect/.test(t)) return 'FIND_ROAD';
    if (/help|what can|feature|how|guide/.test(t)) return 'HELP';
    if (/list|all road|show road|roads in/.test(t)) return 'LIST_ROADS';
    if (/offline|cache|sync|saved/.test(t)) return 'OFFLINE';
    const matched = this.findRoadByQuery(text);
    if (matched) return 'ROAD_NAME:' + matched.road_id;
    return 'UNKNOWN';
  },

  handleMessage(text) {
    if (!text.trim()) return;
    this.addUserMessage(text);
    this.showTyping();

    // Handle complaint flow states
    if (this.chatState === 'AWAIT_COMPLAINT_LOCATION') {
      this.chatContext.location = text;
      this.chatState = 'AWAIT_COMPLAINT_CONFIRM';
      setTimeout(() => {
        this.hideTyping();
        const road = this.chatContext.road;
        this.addBotMessage(`📋 Got it. I'll route your complaint about **${road.road_name}** at *"${text}"* to:\n\n**${road.responsible_officer}**\n📞 ${road.officer_contact}\n📧 ${road.officer_email}\n🏛️ ${road.department}`);
        setTimeout(() => {
          this.hideTyping();
          this.showComplaintRoutingCard(road, text);
        }, 300);
      }, 900);
      return;
    }

    setTimeout(() => {
      this.hideTyping();
      const intent = this.detectIntent(text);
      this.dispatchIntent(intent, text);
    }, 900);
  },

  dispatchIntent(intent, text) {
    const roads = this.getRoads();

    if (intent === 'FIND_ROAD') {
      if (this.userLat && this.userLng) {
        const nearest = this.findNearest(this.userLat, this.userLng, roads);
        this.currentRoad = nearest;
        this.addBotMessage(`📍 Based on your GPS location, the nearest tracked road is:`);
        setTimeout(() => this.showRoadCard(nearest), 300);
      } else {
        const r = roads[0];
        this.currentRoad = r;
        this.addBotMessage(`📍 GPS not available — showing **${r.city}** demo road:`);
        setTimeout(() => this.showRoadCard(r), 300);
      }
      return;
    }

    if (intent === 'BUDGET') {
      const road = this.currentRoad || roads[0];
      this.addBotMessage(`💰 Here's the budget breakdown for **${road.road_name}**:`);
      setTimeout(() => this.showBudgetCard(road), 300);
      return;
    }

    if (intent === 'QUALITY') {
      const road = this.currentRoad || roads[0];
      const score = this.calcQuality(road);
      const q = this.qualityLabel(score);
      this.addBotMessage(`⭐ **Road Quality Score** for ${road.road_name}:\n\n${q.label} — **${score}/100**\n\n📅 Last Relay: ${road.last_relay_date}\n🚧 Pothole Reports: ${road.pothole_reports}\n💡 Score calculated from age, complaint reports & budget utilization.`);
      return;
    }

    if (intent === 'REPORT') {
      const road = this.currentRoad || roads[0];
      this.chatState = 'AWAIT_COMPLAINT_LOCATION';
      this.chatContext = { road };
      this.addBotMessage(`🚧 I'll help you report an issue on **${road.road_name}**.\n\nPlease describe the **exact location** of the problem (e.g., "near KM-45 marker", "before the overbridge"):`);
      return;
    }

    if (intent === 'OFFICER') {
      const road = this.currentRoad || roads[0];
      this.addBotMessage(`🏛️ **Responsible Officer** for ${road.road_name}:\n\n👤 ${road.responsible_officer}\n📞 ${road.officer_contact}\n📧 ${road.officer_email}\n🏢 Department: ${road.department}`);
      return;
    }

    if (intent === 'CONTRACTOR') {
      const road = this.currentRoad || roads[0];
      this.addBotMessage(`🏗️ **Contractor Details** for ${road.road_name}:\n\n🏢 ${road.contractor_name}\n📅 Last Relay: ${road.last_relay_date}\n💰 Contract Value: ${this.formatAmount(road.amount_sanctioned, this.country)}`);
      return;
    }

    if (intent === 'HELP') {
      this.addBotMessage(`🔍 **What I can do:**\n\n📍 **Find My Road** — Nearest highway via GPS\n💰 **Budget Info** — Sanctioned vs spent\n🚧 **Report Pothole** — File complaint\n⭐ **Quality Score** — 0–100 rating\n🔎 **Search** — e.g. *NH 44*, *Mumbai*, *I-95*\n🌍 **Countries** — India (700+ NH), USA, Kenya, UK, Australia\n\nJust type naturally!`);
      return;
    }

    if (intent === 'LIST_ROADS') {
      const q = text.replace(/list|all road|show road|roads in/gi, '').trim();
      const filtered = q.length > 2 ? this.getFilteredRoads(q, '') : roads;
      const sample = filtered.slice(0, 6);
      this.addBotMessage(`🛣️ **${filtered.length.toLocaleString()}** roads in **${this.country.charAt(0).toUpperCase() + this.country.slice(1)}**${q ? ` matching "${q}"` : ''}:`);
      sample.forEach((r, i) => {
        setTimeout(() => {
          const score = this.calcQuality(r);
          const qLabel = this.qualityLabel(score);
          const label = r.nh_number ? `${r.nh_number} — ${r.city}` : r.road_name.slice(0, 50);
          this.addBotMessage(`**${i + 1}. ${label}**\n${r.state} | ${r.road_length_km} km | ${qLabel.label}`);
        }, i * 180);
      });
      if (filtered.length > 6) {
        setTimeout(() => this.addBotMessage(`…and **${(filtered.length - 6).toLocaleString()}** more. Open the **All Roads** tab or search e.g. *NH 48*.`), sample.length * 180 + 200);
      }
      return;
    }

    if (intent === 'OFFLINE') {
      this.addBotMessage(`📴 **Offline Mode** — RoadWatch uses IndexedDB to cache all road data locally.\n\n✅ All ${roads.length} roads saved offline\n✅ Complaints saved locally & synced when online\n✅ Works without internet after first load`);
      return;
    }

    if (intent.startsWith('ROAD_NAME:')) {
      const id = intent.replace('ROAD_NAME:', '');
      const road = this.findRoadById(id);
      if (road) {
        this.currentRoad = road;
        this.addBotMessage(`🛣️ Found **${road.road_name}**:`);
        setTimeout(() => this.showRoadCard(road), 300);
        return;
      }
    }

    // Unknown
    const suggestions = ['Find my nearest road', 'Show road budget', 'Report a pothole', 'Quality score'];
    this.addBotMessage(`🤔 I didn't quite catch that. Try one of these:\n\n${suggestions.map(s => `• *"${s}"*`).join('\n')}`);
  },

  /* ─── CHAT UI HELPERS ─── */
  addUserMessage(text) {
    const msgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg user';
    div.innerHTML = `<div class="msg-avatar">👤</div><div class="msg-content"><div class="msg-bubble">${this.md(text)}</div></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  addBotMessage(text, html = '') {
    const msgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg bot';
    div.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-content"><div class="msg-bubble">${html || this.md(text)}</div></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div.querySelector('.msg-content');
  },

  appendCard(cardHtml) {
    const msgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg bot';
    div.innerHTML = `<div class="msg-avatar" style="visibility:hidden">🤖</div><div class="msg-content">${cardHtml}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  showTyping() {
    const msgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg bot'; div.id = 'typing-indicator';
    div.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-content"><div class="msg-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  },

  md(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  },

  /* ─── RICH CARDS ─── */
  showRoadCard(road) {
    const score = this.calcQuality(road);
    const q = this.qualityLabel(score);
    const spent_pct = Math.round((road.amount_spent / road.amount_sanctioned) * 100);
    this.appendCard(`
      <div class="road-card" onclick="App.setCurrentRoad('${road.road_id}')">
        <div class="road-card-header">
          <div class="road-card-name">🛣️ ${road.road_name}</div>
          <span class="road-type-badge badge-${road.road_type}">${road.road_type}</span>
        </div>
        <div class="road-card-rows">
          <div class="road-card-row"><span class="label">📍 Location</span><span class="val">${road.city}, ${road.state}</span></div>
          <div class="road-card-row"><span class="label">📅 Last Relay</span><span class="val">${road.last_relay_date}</span></div>
          <div class="road-card-row"><span class="label">🏗️ Contractor</span><span class="val">${road.contractor_name}</span></div>
          <div class="road-card-row"><span class="label">💰 Sanctioned</span><span class="val">${this.formatAmount(road.amount_sanctioned, this.country)}</span></div>
          <div class="road-card-row"><span class="label">💸 Spent (${spent_pct}%)</span><span class="val">${this.formatAmount(road.amount_spent, this.country)}</span></div>
          <div class="road-card-row"><span class="label">🚧 Potholes</span><span class="val">${road.pothole_reports} reports</span></div>
          <div class="road-card-row"><span class="label">⭐ Quality</span><span class="val"><span class="quality-badge-inline ${this.qualityLabel(score).cls}">${this.qualityLabel(score).label} ${score}/100</span></span></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="event.stopPropagation();App.dispatchIntent('BUDGET','')">💰 Budget</button>
          <button class="btn btn-secondary" onclick="event.stopPropagation();App.dispatchIntent('REPORT','')">🚧 Report Issue</button>
          <button class="btn btn-secondary" onclick="event.stopPropagation();App.highlightOnMap('${road.road_id}')">🗺️ View on Map</button>
        </div>
      </div>`);
  },

  showBudgetCard(road) {
    const pct = Math.round((road.amount_spent / road.amount_sanctioned) * 100);
    const remaining = road.amount_sanctioned - road.amount_spent;
    const barClass = pct > 95 ? 'bar-danger' : pct > 70 ? 'bar-good' : 'bar-warning';
    const sources = road.budget_source.split('+').map(s => s.trim());
    this.appendCard(`
      <div class="budget-card">
        <h4>💰 Budget Transparency — ${road.road_name}</h4>
        <div class="budget-bar-wrap">
          <div class="budget-bar-label">
            <span>Sanctioned: <strong>${this.formatAmount(road.amount_sanctioned, this.country)}</strong></span>
            <span>${pct}% utilized</span>
          </div>
          <div class="budget-bar"><div class="budget-bar-fill ${barClass}" style="width:${pct}%"></div></div>
          <div style="height:6px"></div>
          <div class="budget-bar-label">
            <span>Spent: <strong>${this.formatAmount(road.amount_spent, this.country)}</strong></span>
          </div>
          <div class="budget-bar"><div class="budget-bar-fill bar-good" style="width:${pct}%"></div></div>
        </div>
        <div class="budget-detail">
          <span>Remaining: <strong class="budget-amount">${this.formatAmount(remaining, this.country)}</strong></span>
          <span>${pct >= 95 ? '⚠️ Nearly exhausted' : pct < 50 ? '⚠️ Under-utilized' : '✅ On track'}</span>
        </div>
        <div class="budget-sources">
          ${sources.map(s => `<span class="source-chip">📦 ${s}</span>`).join('')}
        </div>
      </div>`);
  },

  showComplaintRoutingCard(road, location) {
    this.appendCard(`
      <div class="complaint-card">
        <h4>🚧 Complaint Routing</h4>
        <div class="officer-info">
          <div class="o-name">👤 ${road.responsible_officer}</div>
          <div class="o-detail">📞 ${road.officer_contact}</div>
          <div class="o-detail">📧 ${road.officer_email}</div>
          <div class="o-detail">🏛️ ${road.department}</div>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" onclick="App.openComplaintModal('${road.road_id}','${location.replace(/'/g, "\\'")}')">📝 File Official Complaint</button>
          <button class="btn btn-green" onclick="App.dispatchIntent('BUDGET','')">💰 Check Budget</button>
        </div>
      </div>`);
    this.chatState = 'IDLE';
  },

  setCurrentRoad(roadId) {
    this.currentRoad = this.findRoadById(roadId);
    this.showToast('✅ Road selected: ' + this.currentRoad.road_name);
  },

  highlightOnMap(roadId) {
    document.getElementById('ctab-map').click();
    const road = this.findRoadById(roadId);
    if (road && this.mapInstance) {
      this.mapInstance.setView([road.location.lat, road.location.lng], 13);
      const layer = this.mapMarkers.find(m => {
        const ll = m.getLatLng();
        return Math.abs(ll.lat - road.location.lat) < 0.0001 && Math.abs(ll.lng - road.location.lng) < 0.0001;
      });
      if (layer) layer.openPopup();
    }
  },

  /* ─── COMPLAINT MODAL ─── */
  openComplaintModal(roadId, location = '') {
    const road = this.findRoadById(roadId) || this.currentRoad;
    if (!road) return;
    this.complaintRoad = road;
    document.getElementById('complaint-road').value = road.road_name;
    document.getElementById('complaint-location').value = location;
    document.getElementById('letter-preview-wrap').style.display = 'none';
    document.getElementById('complaint-modal').classList.add('active');
  },

  generateLetterText() {
    const road = this.complaintRoad;
    const name = document.getElementById('complaint-name').value || 'A Concerned Citizen';
    const type = document.getElementById('complaint-type').value;
    const desc = document.getElementById('complaint-desc').value || 'The road requires immediate attention.';
    const loc = document.getElementById('complaint-location').value || road.city;
    const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    return `Date: ${date}

To,
${road.responsible_officer}
${road.department}
Email: ${road.officer_email}
Phone: ${road.officer_contact}

Subject: Complaint Regarding ${type} on ${road.road_name} — Urgent Action Required

Respected Sir/Madam,

I, ${name}, a concerned citizen, wish to bring to your attention a serious issue
on ${road.road_name} (${road.road_id}), ${road.city}, ${road.state}.

Issue Type: ${type}
Location: ${loc}
Description: ${desc}

This road was last resurfaced on ${road.last_relay_date} by ${road.contractor_name}.
A budget of ${this.formatAmount(road.amount_sanctioned, this.country)} was sanctioned,
of which ${this.formatAmount(road.amount_spent, this.country)} has been spent.

Despite this expenditure, the road condition remains unsatisfactory.
I request you to take immediate remedial action at the earliest.

Yours sincerely,
${name}

[Generated by RoadWatch — Civic Accountability Platform]
Road ID: ${road.road_id} | Report Date: ${date}`;
  },

  /* ─── OFFLINE (IndexedDB) ─── */
  initOfflineDB() {
    const req = indexedDB.open('RoadWatchDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('roads')) db.createObjectStore('roads', { keyPath: 'road_id' });
      if (!db.objectStoreNames.contains('complaints')) db.createObjectStore('complaints', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = e => {
      this.offlineDB = e.target.result;
      this.cacheRoadsOffline();
      document.getElementById('db-status').textContent = 'IndexedDB: Ready ✅';
    };
    req.onerror = () => {
      document.getElementById('db-status').textContent = 'IndexedDB: Error ❌';
    };
  },

  cacheRoadsOffline() {
    if (!this.offlineDB || typeof ROADS === 'undefined') return;
    const allRoads = Object.values(ROADS).flat();
    const chunk = 200;
    let i = 0;
    const putNext = () => {
      if (i >= allRoads.length) {
        document.getElementById('db-status').textContent = `IndexedDB: ${allRoads.length} roads ✅`;
        return;
      }
      const tx = this.offlineDB.transaction('roads', 'readwrite');
      const store = tx.objectStore('roads');
      const slice = allRoads.slice(i, i + chunk);
      slice.forEach(r => store.put(r));
      i += chunk;
      setTimeout(putNext, 0);
    };
    putNext();
  },

  saveComplaintOffline(complaint) {
    if (!this.offlineDB) return;
    const tx = this.offlineDB.transaction('complaints', 'readwrite');
    tx.objectStore('complaints').add({ ...complaint, savedAt: Date.now() });
    let count = parseInt(localStorage.getItem('rw_complaints') || '0') + 1;
    localStorage.setItem('rw_complaints', count);
    document.getElementById('stat-complaints').textContent = count;
  },

  /* ─── VOICE INPUT ─── */
  initVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.showToast('⚠️ Voice input not supported in this browser'); return null; }
    const rec = new SR();
    rec.lang = 'en-IN'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = e => {
      const transcript = e.results[0][0].transcript;
      document.getElementById('chat-input').value = transcript;
      this.handleMessage(transcript);
      document.getElementById('chat-input').value = '';
    };
    rec.onend = () => {
      this.voiceActive = false;
      document.getElementById('voice-btn').classList.remove('listening');
      document.getElementById('voice-btn').innerHTML = '<i class="fa-solid fa-microphone"></i>';
    };
    return rec;
  },

  /* ─── ONLINE MONITOR ─── */
  monitorOnline() {
    const update = () => {
      const online = navigator.onLine;
      document.getElementById('online-dot').className = 'online-dot ' + (online ? 'online' : 'offline');
      document.getElementById('online-text').textContent = online ? 'Online' : 'Offline';
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  },

  /* ─── TOAST ─── */
  showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="toast-icon">ℹ️</span><span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  },

  /* ─── EVENTS ─── */
  initEvents() {
    // Send button
    document.getElementById('send-btn').addEventListener('click', () => {
      const inp = document.getElementById('chat-input');
      if (inp.value.trim()) { this.handleMessage(inp.value.trim()); inp.value = ''; }
    });

    // Enter to send
    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const inp = e.target;
        if (inp.value.trim()) { this.handleMessage(inp.value.trim()); inp.value = ''; }
      }
    });

    // Quick action buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleMessage(btn.dataset.msg));
    });

    // Country switcher
    document.getElementById('country-selector').addEventListener('change', e => {
      this.country = e.target.value;
      this.currentRoad = null;
      this.buildRoadIndex();
      this.roadsPage = 0;
      document.getElementById('road-search').value = '';
      this.renderMapMarkers();
      this.renderRoadsList('', '', true);
      this.updateStats();
      setTimeout(() => this.initCharts(), 200);
      const names = { india: '🇮🇳 India', kenya: '🇰🇪 Kenya', usa: '🇺🇸 USA', uk: '🇬🇧 UK', australia: '🇦🇺 Australia' };
      this.addBotMessage(`🌍 Switched to **${names[this.country] || this.country}**. **${this.getRoads().length.toLocaleString()}** highways loaded.`);
    });

    // Nav tabs (show/hide content panel views)
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });

    // Content tabs
    document.querySelectorAll('.content-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.content-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.view).classList.add('active');
        if (tab.dataset.view === 'analytics-view') setTimeout(() => this.initCharts(), 100);
        if (tab.dataset.view === 'map-view') setTimeout(() => this.mapInstance && this.mapInstance.invalidateSize(), 100);
      });
    });

    // Voice button
    document.getElementById('voice-btn').addEventListener('click', () => {
      if (this.voiceActive) return;
      const rec = this.initVoice();
      if (!rec) return;
      this.voiceActive = true;
      document.getElementById('voice-btn').classList.add('listening');
      document.getElementById('voice-btn').innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
      rec.start();
      this.showToast('🎙️ Listening… speak now');
    });

    // Road search / filter
    const runRoadSearch = () => {
      const val = document.getElementById('road-search').value;
      const type = document.getElementById('road-filter-type').value;
      this.renderRoadsList(val, type, true);
      document.getElementById('ctab-roads')?.click();
    };
    document.getElementById('road-search').addEventListener('input', e => {
      clearTimeout(this.searchDebounce);
      const val = e.target.value;
      const type = document.getElementById('road-filter-type').value;
      this.searchDebounce = setTimeout(() => this.renderRoadsList(val, type, true), 120);
    });
    document.getElementById('road-search').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(this.searchDebounce);
        runRoadSearch();
      }
    });
    document.getElementById('road-filter-type').addEventListener('change', e => {
      this.renderRoadsList(document.getElementById('road-search').value, e.target.value, true);
    });

    // Complaint modal close
    document.getElementById('complaint-modal-close').addEventListener('click', () => {
      document.getElementById('complaint-modal').classList.remove('active');
    });
    document.getElementById('complaint-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('complaint-modal'))
        document.getElementById('complaint-modal').classList.remove('active');
    });

    // Letter preview
    document.getElementById('complaint-preview-btn').addEventListener('click', () => {
      const letter = this.generateLetterText();
      document.getElementById('letter-content').textContent = letter;
      document.getElementById('letter-preview-wrap').style.display = 'block';
    });

    // Submit complaint
    document.getElementById('complaint-submit-btn').addEventListener('click', () => {
      const road = this.complaintRoad;
      if (!road) return;
      const complaint = {
        road_id: road.road_id, road_name: road.road_name,
        type: document.getElementById('complaint-type').value,
        desc: document.getElementById('complaint-desc').value,
        location: document.getElementById('complaint-location').value,
        name: document.getElementById('complaint-name').value,
        timestamp: new Date().toISOString()
      };
      this.saveComplaintOffline(complaint);
      document.getElementById('complaint-modal').classList.remove('active');
      this.addBotMessage(`✅ **Complaint filed successfully!**\n\n📋 Issue: ${complaint.type}\n🛣️ Road: ${road.road_name}\n👤 Officer: ${road.responsible_officer}\n\nYour complaint has been saved and will be synced when online.`);
      this.showToast('✅ Complaint filed & saved offline!');
    });

    // Download letter
    document.getElementById('download-letter-btn').addEventListener('click', () => {
      const letter = this.generateLetterText();
      const blob = new Blob([letter], { type: 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'RoadWatch_Complaint_' + Date.now() + '.txt'; a.click();
      this.showToast('📄 Letter downloaded!');
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
