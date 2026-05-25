
/* RoadWatch — Road Asset Monitoring */
const App = {
  country: 'india',
  currentRoad: null,
  selectedRoadId: null,
  userLat: null,
  userLng: null,
  userLocationMarker: null,
  complaintRoad: null,
  charts: {},
  mapInstance: null,
  markerCluster: null,
  roadMarkerMap: new Map(),
  reportCluster: null,
  reportMarkerMap: new Map(),
  offlineDB: null,
  voiceActive: false,
  chatState: 'IDLE',
  chatContext: {},
  roadById: new Map(),
  roadsPage: 0,
  roadsPageSize: 50,
  roadsFilterKey: '',
  roadsTypeFilter: '',
  searchDebounce: null,
  nearbyMode: false,
  overrides: {},

  getRoads() {
    return (typeof ROADS !== 'undefined' && ROADS[this.country]) ? ROADS[this.country] : [];
  },

  buildRoadIndex() {
    this.roadById.clear();
    this.getRoads().forEach(r => this.roadById.set(r.road_id, r));
  },

  findRoadById(id) {
    const base = this.roadById.get(id) || this.getRoads().find(r => r.road_id === id);
    return base ? this.withOverrides(base) : null;
  },

  loadOverrides() {
    try {
      this.overrides = JSON.parse(localStorage.getItem('rw_overrides') || '{}') || {};
    } catch {
      this.overrides = {};
    }
  },

  persistOverrides() {
    localStorage.setItem('rw_overrides', JSON.stringify(this.overrides || {}));
  },

  withOverrides(road) {
    const o = this.overrides?.[road.road_id];
    return o ? { ...road, ...o } : road;
  },

  setOverride(roadId, patch) {
    this.overrides[roadId] = { ...(this.overrides[roadId] || {}), ...patch };
    this.persistOverrides();
    this.updateDashboardStats();
    this.renderRoadsList();
    this.scheduleMapRender();
  },

  normalizeSearchQuery(q) {
    return String(q || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  },

  roadMatchesQuery(road, rawQuery) {
    const q = this.normalizeSearchQuery(rawQuery);
    if (!q) return true;
    const hay = [
      road.road_id, road.road_name, road.nh_number, road.sh_number, road.mdr_id,
      road.road_type, road.city, road.state, road.description,
    ].filter(Boolean).join(' ').toLowerCase().replace(/[^\w\s]/g, ' ');
    const nhInQuery = q.match(/(?:^|\s)nh\s*(\d+[a-z]*)/) || q.match(/^(\d+[a-z]*)$/);
    if (nhInQuery) {
      const num = nhInQuery[1] || nhInQuery[0];
      const nhTag = 'nh ' + num;
      const roadNh = (road.nh_number || '').toLowerCase().replace(/\s+/g, ' ');
      if (roadNh === nhTag || roadNh.startsWith(nhTag + ' ') || roadNh.includes(nhTag)) return true;
      if (hay.includes(nhTag)) return true;
    }
    const shInQuery = q.match(/(?:^|\s)sh\s*(\d+)/);
    if (shInQuery) {
      const shTag = 'sh ' + shInQuery[1];
      const roadSh = (road.sh_number || '').toLowerCase().replace(/\s+/g, ' ');
      if (roadSh === shTag || roadSh.includes(shTag) || hay.includes(shTag)) return true;
    }
    const mdrInQuery = q.match(/(?:^|\s)mdr\s*(\d+)/);
    if (mdrInQuery) {
      const mdrTag = 'mdr ' + mdrInQuery[1];
      const roadMdr = (road.mdr_id || '').toLowerCase().replace(/\s+/g, ' ');
      if (roadMdr === mdrTag || roadMdr.includes(mdrTag) || hay.includes(mdrTag)) return true;
    }
    if (q.includes('state highway') && road.road_type === 'SH') return true;
    if (q.includes('district') && road.road_type === 'MDR') return true;
    if (q.includes('city') && road.road_type === 'City') return true;
    const tokens = q.split(' ').filter(Boolean);
    return tokens.every(t => hay.includes(t));
  },

  getActiveSearch() {
    const mapQ = document.getElementById('map-search')?.value?.trim() || '';
    const listQ = document.getElementById('road-search')?.value?.trim() || '';
    return mapQ || listQ || this.roadsFilterKey;
  },

  getFilteredRoads(textFilter, typeFilter) {
    const q = textFilter !== undefined ? textFilter : this.getActiveSearch();
    const type = typeFilter !== undefined ? typeFilter : (this.roadsTypeFilter || '');
    const state = document.getElementById('state-filter')?.value || '';
    return this.getRoads().filter(r => {
      if (type && r.road_type !== type) return false;
      if (state && r.state !== state) return false;
      if (!this.roadMatchesQuery(r, q)) return false;
      if (!this.passesPriorityFilter(r)) return false;
      return true;
    });
  },

  passesPriorityFilter(road) {
    const score = this.calcQuality(road);
    const p = this.priorityFromScore(score);
    if (p === 'high' && !document.getElementById('filter-high')?.checked) return false;
    if (p === 'mid' && !document.getElementById('filter-mid')?.checked) return false;
    if (p === 'low' && !document.getElementById('filter-low')?.checked) return false;
    return true;
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

  /** Single map view per region — no horizontal world copies (markers only exist once). */
  countryBounds() {
    const boxes = {
      india: [[6.0, 66.5], [37.5, 99.0]],
      kenya: [[-5.5, 33.5], [5.5, 42.5]],
      usa: [[22.0, -130.0], [52.0, -63.0]],
      uk: [[48.5, -9.5], [61.5, 3.0]],
      australia: [[-45.0, 110.0], [-9.0, 156.0]],
    };
    const box = boxes[this.country] || boxes.india;
    return L.latLngBounds(box[0], box[1]);
  },

  applyMapRegion(fitBounds = false) {
    if (!this.mapInstance) return;
    const bounds = this.countryBounds();
    this.mapInstance.setMaxBounds(bounds);
    if (fitBounds) {
      this.mapInstance.fitBounds(bounds, { padding: [24, 24], maxZoom: 8 });
    } else {
      const { center, zoom } = this.countryCenter();
      this.mapInstance.setView(center, zoom, { animate: false });
    }
    this.mapInstance.invalidateSize();
  },

  init() {
    this.loadOverrides();
    this.applyAccessibilityFromStorage();
    this.buildRoadIndex();
    this.populateStateFilter();
    this.initOfflineDB();
    this.initMap();
    this.initChat();
    this.initEvents();
    this.syncSearchFields();
    this.renderRoadsList();
    this.updateDashboardStats();
    this.getLocation();
    this.monitorOnline();
    setTimeout(() => this.initCharts(), 400);
    this.applyUrlState();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => document.body.classList.add('ui-ready'));
    });
  },

  populateStateFilter() {
    const sel = document.getElementById('state-filter');
    if (!sel) return;
    const states = [...new Set(this.getRoads().map(r => r.state).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All divisions</option>' +
      states.map(s => `<option value="${this.escapeHtml(s)}">${this.escapeHtml(s)}</option>`).join('');
  },

  syncSearchFields(from) {
    const mapEl = document.getElementById('map-search');
    const listEl = document.getElementById('road-search');
    if (!mapEl || !listEl) return;
    const val = from === 'map' ? mapEl.value : from === 'list' ? listEl.value : this.roadsFilterKey;
    if (from !== 'map') mapEl.value = val;
    if (from !== 'list') listEl.value = val;
    this.roadsFilterKey = val;
  },

  calcQuality(road) {
    const days = Math.floor((Date.now() - new Date(road.last_relay_date)) / 86400000);
    const agePenalty = Math.min(days / 20, 30);
    const potholePenalty = Math.min((road.pothole_reports || 0) * 4, 24);
    const spentRatio = road.amount_spent / Math.max(road.amount_sanctioned, 1);
    const utilPenalty = spentRatio > 0.98 ? 8 : spentRatio < 0.5 ? 5 : 0;
    const utilBonus = spentRatio >= 0.65 && spentRatio <= 0.92 ? 8 : 0;
    return Math.max(0, Math.min(100, Math.round(100 - agePenalty - potholePenalty - utilPenalty + utilBonus)));
  },

  qualityLabel(score) {
    if (score >= 75) return { label: 'Good', cls: 'quality-good', color: '#059669', pill: 'cp-good' };
    if (score >= 45) return { label: 'Fair', cls: 'quality-moderate', color: '#d97706', pill: 'cp-fair' };
    return { label: 'Poor', cls: 'quality-poor', color: '#dc2626', pill: 'cp-poor' };
  },

  priorityFromScore(score) {
    if (score < 45) return 'high';
    if (score < 75) return 'mid';
    return 'low';
  },

  priorityLabel(score) {
    const p = this.priorityFromScore(score);
    if (p === 'high') return { text: 'High priority', cls: 'priority-high' };
    if (p === 'mid') return { text: 'Medium priority', cls: 'priority-mid' };
    return { text: 'Low priority', cls: 'priority-low' };
  },

  getAuthority(road) {
    const rt = road.road_type || 'NH';
    const c = this.country;
    const byType = (typeof DEPARTMENT_ROUTING !== 'undefined' && DEPARTMENT_ROUTING[rt]) ? DEPARTMENT_ROUTING[rt] : null;
    const entry = byType?.[c] || byType?.india || null;
    if (!entry) return null;
    return entry;
  },

  routeDisplayId(road) {
    if (road.sh_number) return road.sh_number.replace(/\s+/g, '-');
    if (road.mdr_id) return road.mdr_id.replace(/\s+/g, '-');
    if (road.nh_number) return road.nh_number.replace(/\s+/g, '-');
    if (road.road_type === 'City' && road.road_name) {
      const short = road.road_name.split('(')[0].trim();
      return short.length > 28 ? short.slice(0, 28) + '…' : short;
    }
    const m = road.road_id.match(/NH-?(\d+[A-Za-z]*)/i);
    if (m) return 'NH-' + m[1];
    return road.road_id.split('-').slice(0, 2).join('-');
  },

  typeBreakdownLabel(roads) {
    const c = { NH: 0, SH: 0, MDR: 0, City: 0 };
    roads.forEach(r => { if (c[r.road_type] !== undefined) c[r.road_type]++; });
    const parts = [];
    if (c.NH) parts.push(`${c.NH} NH`);
    if (c.SH) parts.push(`${c.SH} SH`);
    if (c.MDR) parts.push(`${c.MDR} MDR`);
    if (c.City) parts.push(`${c.City} City`);
    return parts.join(' · ');
  },

  formatAmount(amount, country) {
    const c = country || this.country;
    if (c === 'usa') return '$' + (amount / 1e6).toFixed(2) + 'M';
    if (c === 'kenya') return 'KES ' + (amount / 1e9).toFixed(2) + 'B';
    if (c === 'uk') return '£' + (amount / 1e6).toFixed(2) + 'M';
    if (c === 'australia') return 'A$' + (amount / 1e6).toFixed(2) + 'M';
    const cr = amount / 1e7;
    if (cr >= 1000) return '₹' + (cr / 1000).toFixed(1) + 'k Cr';
    if (cr >= 1) return '₹' + cr.toFixed(2) + ' Cr';
    return '₹' + (amount / 1e5).toFixed(2) + ' L';
  },

  updateDashboardStats() {
    const roads = this.getRoads().map(r => this.withOverrides(r));
    let good = 0, fair = 0, poor = 0;
    let totalKm = 0;
    roads.forEach(r => {
      totalKm += r.road_length_km || 0;
      const s = this.calcQuality(r);
      if (s >= 75) good++; else if (s >= 45) fair++; else poor++;
    });
    const n = roads.length || 1;
    const gp = Math.round((good / n) * 100);
    const fp = Math.round((fair / n) * 100);
    const pp = Math.round((poor / n) * 100);
    const elG = document.getElementById('ps-good');
    const elF = document.getElementById('ps-fair');
    const elP = document.getElementById('ps-poor');
    if (elG) { elG.style.width = gp + '%'; }
    if (elF) { elF.style.width = fp + '%'; }
    if (elP) { elP.style.width = pp + '%'; }
    const leg = document.getElementById('ps-legend');
    if (leg) leg.textContent = `${gp}% Good · ${fp}% Fair · ${pp}% Poor`;
    document.getElementById('stat-total').textContent = roads.length.toLocaleString();
    document.getElementById('stat-miles').textContent = Math.round(totalKm).toLocaleString();
    const complaints = parseInt(localStorage.getItem('rw_complaints') || '0', 10);
    document.getElementById('stat-complaints').textContent = complaints;
    this.pulseStat('stat-total');
    this.pulseStat('stat-miles');
  },

  highwayDotIcon(road, selected = false) {
    const score = this.calcQuality(road);
    const q = this.qualityLabel(score);
    const size = selected ? 16 : 12;
    const ring = selected ? 3 : 2;
    return L.divIcon({
      className: 'highway-marker',
      html: `<div class="hw-dot${selected ? ' hw-dot-selected' : ''}" style="width:${size}px;height:${size}px;background:${q.color};box-shadow:0 0 0 ${ring}px rgba(255,255,255,0.9), 0 0 10px ${q.color}"></div>`,
      iconSize: [size + 8, size + 8],
      iconAnchor: [(size + 8) / 2, (size + 8) / 2],
    });
  },

  initMap() {
    const { center, zoom } = this.countryCenter();
    const bounds = this.countryBounds();
    this.mapInstance = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
    }).setView(center, zoom);
    L.control.zoom({ position: 'bottomright' }).addTo(this.mapInstance);
    this.baseTileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { maxZoom: 19, noWrap: true }
    ).addTo(this.mapInstance);
    this.mapInstance.on('moveend', () => this.refreshMarkersInView());
    window.addEventListener('resize', () => {
      if (this.mapInstance) this.mapInstance.invalidateSize();
    });
    this.renderMapMarkers();
  },

  refreshMarkersInView() {
    if (!this.markerCluster || !this.mapInstance) return;
    this.markerCluster.refreshClusters();
  },

  scheduleMapRender() {
    clearTimeout(this._mapRenderTimer);
    this._mapRenderTimer = setTimeout(() => this.renderMapMarkers(), 100);
  },

  renderMapMarkers() {
    if (!this.mapInstance) return;

    if (this.markerCluster) {
      this.mapInstance.removeLayer(this.markerCluster);
      this.markerCluster = null;
    }
    this.roadMarkerMap.clear();

    const roads = this.getFilteredRoads().map(r => this.withOverrides(r));
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 48,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 13,
      removeOutsideVisibleBounds: false,
      chunkedLoading: true,
      chunkInterval: 80,
    });

    roads.forEach(road => {
      if (!road.location?.lat) return;
      const score = this.calcQuality(road);
      const q = this.qualityLabel(score);
      const selected = road.road_id === this.selectedRoadId;
      const safeId = road.road_id.replace(/'/g, "\\'");
      const pr = this.priorityLabel(score);

      const marker = L.marker([road.location.lat, road.location.lng], {
        icon: this.highwayDotIcon(road, selected),
        roadId: road.road_id,
      });

      marker.bindPopup(`
        <div class="map-popup-title">${this.escapeHtml(this.routeDisplayId(road))}</div>
        <div class="map-popup-row">${this.escapeHtml(road.city)}, ${this.escapeHtml(road.state)}</div>
        <div class="map-popup-row">${road.road_length_km || '—'} km · ${pr.text}</div>
        <div class="map-popup-row">Condition: ${q.label} (${score}/100)</div>
        <div class="map-popup-row">Reports: ${road.pothole_reports || 0}</div>
        <button class="btn btn-primary map-popup-btn" type="button" onclick="App.viewRoad('${safeId}')">View details</button>
      `);

      marker.on('click', () => this.selectRoad(road.road_id, true));
      cluster.addLayer(marker);
      this.roadMarkerMap.set(road.road_id, marker);
    });

    this.markerCluster = cluster;
    this.mapInstance.addLayer(cluster);

    const countEl = document.getElementById('map-marker-count');
    if (countEl) countEl.textContent = `${roads.length.toLocaleString()} on map`;
    this.renderReportMarkers();
  },

  renderReportMarkers() {
    if (!this.mapInstance) return;

    if (this.reportCluster) {
      this.mapInstance.removeLayer(this.reportCluster);
      this.reportCluster = null;
    }
    this.reportMarkerMap.clear();

    const show = document.getElementById('filter-reports')?.checked;
    if (!show) return;

    const days = parseInt(document.getElementById('filter-report-days')?.value || '30', 10);
    const type = document.getElementById('filter-report-type')?.value || '';
    const cutoff = Date.now() - days * 86400000;

    const items = (this.complaints || []).filter(c => {
      const ts = c.savedAt || Date.parse(c.timestamp || '') || 0;
      if (ts && ts < cutoff) return false;
      if (type && c.type !== type) return false;
      return true;
    });

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 42,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 14,
    });

    items.forEach(c => {
      const road = this.findRoadById(c.road_id);
      if (!road) return;
      const lat = road.location?.lat;
      const lng = road.location?.lng;
      if (lat == null || lng == null) return;
      const safeId = String(c.road_id).replace(/'/g, "\\'");
      const marker = L.circleMarker([lat, lng], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: '#e05252',
        fillOpacity: 0.95,
      });
      marker.bindPopup(`
        <div class="map-popup-title">Public report</div>
        <div class="map-popup-row">${this.escapeHtml(c.type || 'Issue')}</div>
        <div class="map-popup-row">${this.escapeHtml(c.location || '')}</div>
        <div class="map-popup-row">${this.escapeHtml(road.road_name)}</div>
        <button class="btn btn-primary map-popup-btn" type="button" onclick="App.viewRoad('${safeId}')">View route</button>
      `);
      cluster.addLayer(marker);
      this.reportMarkerMap.set(String(c.id || Math.random()), marker);
    });

    this.reportCluster = cluster;
    this.mapInstance.addLayer(cluster);
  },

  refreshMarkerStyles() {
    this.roadMarkerMap.forEach((marker, id) => {
      const road = this.findRoadById(id);
      if (road) marker.setIcon(this.highwayDotIcon(road, id === this.selectedRoadId));
    });
  },

  selectRoad(roadId, openDrawer = true) {
    this.selectedRoadId = roadId;
    this.currentRoad = this.findRoadById(roadId);
    document.querySelectorAll('.route-card').forEach(el => {
      el.classList.toggle('selected', el.dataset.roadId === roadId);
    });
    this.refreshMarkerStyles();
    if (openDrawer && this.currentRoad) this.openRouteDrawer(this.currentRoad);
    if (this.currentRoad && this.mapInstance) {
      const marker = this.roadMarkerMap.get(roadId);
      const { lat, lng } = this.currentRoad.location;
      this.mapInstance.setView([lat, lng], Math.max(this.mapInstance.getZoom(), 10));
      marker?.openPopup();
    }
    this.updateUrlState();
  },

  viewRoad(roadId) {
    this.switchView('monitor');
    this.selectRoad(roadId, true);
  },

  openRouteDrawer(road) {
    const score = this.calcQuality(road);
    const q = this.qualityLabel(score);
    const pr = this.priorityLabel(score);
    const pct = Math.round((road.amount_spent / Math.max(road.amount_sanctioned, 1)) * 100);
    const auth = this.getAuthority(road);
    document.getElementById('drawer-title').textContent = this.routeDisplayId(road);
    document.getElementById('drawer-body').innerHTML = `
      <p style="margin-bottom:12px;color:var(--text-secondary);font-size:0.82rem;">${this.escapeHtml(road.road_name)}</p>
      <span class="priority-tag ${pr.cls}">${pr.text}</span>
      <span class="condition-pill ${q.pill}">${q.label} · ${score}/100</span>
      <div style="margin-top:14px">
        <div class="detail-row"><span>Division</span><span>${this.escapeHtml(road.state)}</span></div>
        <div class="detail-row"><span>City</span><span>${this.escapeHtml(road.city)}</span></div>
        <div class="detail-row"><span>Length</span><span>${road.road_length_km} km</span></div>
        <div class="detail-row"><span>Last relay</span><span>${road.last_relay_date}</span></div>
        <div class="detail-row"><span>Contractor</span><span>${this.escapeHtml(road.contractor_name)}</span></div>
        <div class="detail-row"><span>Sanctioned</span><span>${this.formatAmount(road.amount_sanctioned)}</span></div>
        <div class="detail-row"><span>Spent</span><span>${this.formatAmount(road.amount_spent)} (${pct}%)</span></div>
        <div class="detail-row"><span>Reports</span><span>${road.pothole_reports || 0}</span></div>
        <div class="detail-row"><span>Officer</span><span>${this.escapeHtml(road.responsible_officer)}</span></div>
        <div class="detail-row"><span>Department</span><span>${this.escapeHtml(road.department)}</span></div>
        ${auth ? `
          <div class="detail-row"><span>Authority</span><span>${this.escapeHtml(auth.name)}</span></div>
          <div class="detail-row"><span>Contact</span><span><a class="drawer-link" href="tel:${this.escapeHtml(auth.phone || '')}">${this.escapeHtml(auth.phone || '')}</a></span></div>
          <div class="detail-row"><span>Email</span><span><a class="drawer-link" href="mailto:${this.escapeHtml(auth.email || '')}">${this.escapeHtml(auth.email || '')}</a></span></div>
        ` : ''}
      </div>`;
    document.getElementById('drawer-backdrop')?.classList.add('open');
    document.getElementById('route-drawer').classList.add('open');
    document.getElementById('drawer-report-btn').onclick = () => this.openComplaintModal(road.road_id);
    document.getElementById('drawer-map-btn').onclick = () => {
      this.closeDrawer();
      this.selectRoad(road.road_id, false);
    };
    const editBtn = document.getElementById('drawer-edit-btn');
    if (editBtn) editBtn.onclick = () => this.openEditRoad(road);
  },

  openEditRoad(road) {
    const current = this.withOverrides(road);
    const body = document.getElementById('drawer-body');
    if (!body) return;
    body.innerHTML = `
      <div class="detail-row"><span>Editing</span><span>${this.escapeHtml(this.routeDisplayId(current))}</span></div>
      <div class="form-group" style="margin-top:12px;">
        <label class="form-label">Last relay date</label>
        <input class="form-input" id="edit-last-relay" type="date" value="${this.escapeHtml(current.last_relay_date)}"/>
      </div>
      <div class="form-group">
        <label class="form-label">Reports (potholes)</label>
        <input class="form-input" id="edit-reports" type="number" min="0" max="99" value="${Number(current.pothole_reports || 0)}"/>
      </div>
      <div class="form-group">
        <label class="form-label">Sanctioned amount</label>
        <input class="form-input" id="edit-sanctioned" type="number" min="0" value="${Number(current.amount_sanctioned || 0)}"/>
      </div>
      <div class="form-group">
        <label class="form-label">Spent amount</label>
        <input class="form-input" id="edit-spent" type="number" min="0" value="${Number(current.amount_spent || 0)}"/>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" id="edit-save-btn" type="button">Save</button>
        <button class="btn btn-secondary" id="edit-cancel-btn" type="button">Cancel</button>
        <button class="btn btn-secondary" id="edit-clear-btn" type="button">Reset override</button>
      </div>
      <div class="roads-subhead">Edits are saved locally in your browser only.</div>
    `;
    document.getElementById('edit-save-btn').onclick = () => {
      const last = document.getElementById('edit-last-relay').value;
      const reports = parseInt(document.getElementById('edit-reports').value || '0', 10);
      const sanctioned = parseInt(document.getElementById('edit-sanctioned').value || '0', 10);
      const spent = parseInt(document.getElementById('edit-spent').value || '0', 10);
      this.setOverride(current.road_id, {
        last_relay_date: last,
        pothole_reports: Math.max(0, reports),
        amount_sanctioned: Math.max(0, sanctioned),
        amount_spent: Math.max(0, spent),
      });
      this.openRouteDrawer(this.findRoadById(current.road_id));
      this.showToast('Local override saved.');
    };
    document.getElementById('edit-cancel-btn').onclick = () => this.openRouteDrawer(this.findRoadById(current.road_id));
    document.getElementById('edit-clear-btn').onclick = () => {
      delete this.overrides[current.road_id];
      this.persistOverrides();
      this.openRouteDrawer(this.findRoadById(current.road_id));
      this.showToast('Override cleared.');
    };
  },

  closeDrawer() {
    document.getElementById('drawer-backdrop')?.classList.remove('open');
    document.getElementById('route-drawer')?.classList.remove('open');
  },

  escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  },

  getLocation() {
    const setLocText = (t) => {
      const el = document.getElementById('location-text');
      if (el) el.textContent = t;
    };
    const placeUserMarker = (lat, lng) => {
      if (!this.mapInstance) return;
      if (this.userLocationMarker) this.mapInstance.removeLayer(this.userLocationMarker);
      const icon = L.divIcon({
        className: 'user-locate-wrap',
        html: `<div class="user-locate-marker"><div class="ulm-ring ulm-ring-3"></div><div class="ulm-ring ulm-ring-2"></div><div class="ulm-core"></div></div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });
      this.userLocationMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 })
        .addTo(this.mapInstance)
        .bindPopup('<strong>Your location</strong>');
    };
    if (!navigator.geolocation) {
      setLocText('GPS unavailable');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.userLat = pos.coords.latitude;
        this.userLng = pos.coords.longitude;
        const nearest = this.findNearest(this.userLat, this.userLng, this.getRoads());
        setLocText(nearest ? `${nearest.city}, ${nearest.state}` : 'Location acquired');
        placeUserMarker(this.userLat, this.userLng);
      },
      () => {
        this.userLat = 28.6139;
        this.userLng = 77.209;
        setLocText('Delhi, India (default)');
        placeUserMarker(this.userLat, this.userLng);
      }
    );
  },

  locateUser() {
    if (this.userLat && this.userLng && this.mapInstance) {
      this.mapInstance.setView([this.userLat, this.userLng], 12);
      this.userLocationMarker?.openPopup();
      return;
    }
    this.getLocation();
  },

  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
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

  renderRoadsList(filter, typeFilter, resetPage) {
    if (filter !== undefined) this.roadsFilterKey = filter;
    if (typeFilter !== undefined) this.roadsTypeFilter = typeFilter;
    if (resetPage) this.roadsPage = 0;

    let all = this.getFilteredRoads(this.roadsFilterKey, this.roadsTypeFilter).map(r => this.withOverrides(r));
    if (this.nearbyMode && this.userLat != null && this.userLng != null) {
      all = [...all].sort((a, b) => {
        const da = this.haversine(this.userLat, this.userLng, a.location.lat, a.location.lng);
        const db = this.haversine(this.userLat, this.userLng, b.location.lat, b.location.lng);
        return da - db;
      });
    }
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / this.roadsPageSize));
    if (this.roadsPage >= totalPages) this.roadsPage = totalPages - 1;

    const start = this.roadsPage * this.roadsPageSize;
    const page = all.slice(start, start + this.roadsPageSize);

    const badge = document.getElementById('roads-count-badge');
    if (badge) badge.textContent = total ? `${total.toLocaleString()} routes` : 'No matches';
    const sub = document.getElementById('roads-subhead');
    if (sub) {
      const state = document.getElementById('state-filter')?.value || '';
      const type = this.roadsTypeFilter || '';
      const parts = [];
      if (state) parts.push(state);
      if (type) parts.push(type);
      if (this.nearbyMode) parts.push('Nearby');
      const breakdown = this.typeBreakdownLabel(all);
      if (parts.length) {
        sub.textContent = parts.join(' · ') + (breakdown ? ` · ${breakdown}` : '');
      } else {
        sub.textContent = breakdown || 'Filtered view';
      }
    }

    const list = document.getElementById('roads-list');
    if (!page.length) {
      list.innerHTML = '<div class="roads-empty">No routes match. Try NH/SH/MDR number, city, state, or road type.</div>';
    } else {
      list.innerHTML = page.map((road, i) => {
        const score = this.calcQuality(road);
        const q = this.qualityLabel(score);
        const pr = this.priorityLabel(score);
        const rid = this.routeDisplayId(road);
        const safeId = road.road_id.replace(/'/g, "\\'");
        const defective = road.pothole_reports || 0;
        const totalSeg = Math.max(10, Math.round((road.road_length_km || 50) / 5));
        const typeBadge = road.road_type
          ? `<span class="road-type-badge badge-${road.road_type}">${road.road_type}</span>` : '';
        return `<article class="route-card animate-in${road.road_id === this.selectedRoadId ? ' selected' : ''}" style="--card-i:${Math.min(i, 12)}" data-road-id="${safeId}" onclick="App.selectRoad('${safeId}', true)">
          <div class="route-card-top">
            <span class="route-card-id">${this.escapeHtml(rid)}</span>
            ${typeBadge}
            <button type="button" class="route-card-view" onclick="event.stopPropagation();App.viewRoad('${safeId}')">View</button>
          </div>
          <span class="priority-tag ${pr.cls}">${pr.text}</span>
          <div class="route-card-meta">
            <div><strong>Asset condition</strong> ${defective} of ${totalSeg} segments flagged</div>
            <div><strong>Pavement</strong> ${score}% <span class="condition-pill ${q.pill}">${q.label}</span></div>
            <div>${this.escapeHtml(road.city)}, ${this.escapeHtml(road.state)} · ${road.road_length_km} km</div>
          </div>
        </article>`;
      }).join('');
    }

    const footer = document.getElementById('roads-list-footer');
    if (footer) {
      footer.innerHTML = total > this.roadsPageSize ? `
        <button class="btn btn-secondary btn-sm" type="button" ${this.roadsPage === 0 ? 'disabled' : ''} onclick="App.roadsPrevPage()">Prev</button>
        <span>${this.roadsPage + 1} / ${totalPages}</span>
        <button class="btn btn-secondary btn-sm" type="button" ${this.roadsPage >= totalPages - 1 ? 'disabled' : ''} onclick="App.roadsNextPage()">Next</button>
      ` : '';
    }
    this.scheduleMapRender();
  },

  roadsPrevPage() {
    if (this.roadsPage > 0) { this.roadsPage--; this.renderRoadsList(); }
  },

  roadsNextPage() {
    const total = this.getFilteredRoads().length;
    if ((this.roadsPage + 1) * this.roadsPageSize < total) { this.roadsPage++; this.renderRoadsList(); }
  },

  applySearch(val, source) {
    this.roadsFilterKey = val;
    this.syncSearchFields(source);
    this.roadsPage = 0;
    this.renderRoadsList();
    this.scheduleMapRender();
    this.updateUrlState();
  },

  switchView(view) {
    const panelView = view === 'routes' ? 'monitor' : view;
    document.body.dataset.activeView = view;
    const ctx = document.getElementById('page-context');
    const labels = {
      monitor: 'Live map & route registry',
      routes: 'Browse and filter all corridors',
      analytics: 'Budget and condition insights',
      assistant: 'Civic support & reporting',
    };
    if (ctx) ctx.textContent = labels[view] || labels.monitor;
    document.querySelectorAll('.sidebar-btn[data-view]').forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
    });
    document.querySelectorAll('.view-panel').forEach(p => {
      p.classList.toggle('active', p.id === 'view-' + panelView);
    });
    const monitor = document.getElementById('view-monitor');
    if (monitor) monitor.classList.toggle('routes-focus', view === 'routes');
    if (view === 'routes') {
      setTimeout(() => document.getElementById('road-search')?.focus(), 100);
    }
    if (view === 'analytics') setTimeout(() => this.initCharts(), 100);
    if (panelView === 'monitor' && this.mapInstance) {
      setTimeout(() => this.mapInstance.invalidateSize(), 150);
    }
    this.updateUrlState();
  },

  onCountryChange() {
    this.country = document.getElementById('country-selector').value;
    this.currentRoad = null;
    this.selectedRoadId = null;
    this.buildRoadIndex();
    this.populateStateFilter();
    this.roadsPage = 0;
    this.applySearch('', 'map');
    this.applyMapRegion(false);
    this.renderMapMarkers();
    this.updateDashboardStats();
    setTimeout(() => this.initCharts(), 200);
    this.closeDrawer();
    if (document.getElementById('chat-messages')?.childElementCount) {
      this.addBotMessage(`Region set to **${this.country}**. **${this.getRoads().length.toLocaleString()}** routes loaded.`);
    }
    this.updateUrlState();
  },

  /* ─── Charts ─── */
  initCharts() {
    const roads = this.getRoads().map(r => this.withOverrides(r));
    if (!document.getElementById('budget-chart')) return;
    Chart.defaults.color = '#64748b';
    Chart.defaults.font.family = 'DM Sans';

    const top8 = [...roads].sort((a, b) => b.amount_sanctioned - a.amount_sanctioned).slice(0, 8);
    const bCtx = document.getElementById('budget-chart').getContext('2d');
    if (this.charts.budget) this.charts.budget.destroy();
    this.charts.budget = new Chart(bCtx, {
      type: 'bar',
      data: {
        labels: top8.map(r => this.routeDisplayId(r)),
        datasets: [
          { label: 'Sanctioned', data: top8.map(r => r.amount_sanctioned / 1e7), backgroundColor: '#0d9488' },
          { label: 'Spent', data: top8.map(r => r.amount_spent / 1e7), backgroundColor: '#5eead4' },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: v => '₹' + v + ' Cr' } } } },
    });

    const typeCounts = {};
    roads.forEach(r => { typeCounts[r.road_type] = (typeCounts[r.road_type] || 0) + 1; });
    const tCtx = document.getElementById('type-chart').getContext('2d');
    if (this.charts.type) this.charts.type.destroy();
    this.charts.type = new Chart(tCtx, {
      type: 'doughnut',
      data: { labels: Object.keys(typeCounts), datasets: [{ data: Object.values(typeCounts), backgroundColor: ['#0d9488', '#7c3aed', '#d97706', '#059669'], borderWidth: 0 }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    });

    const qBuckets = { Good: 0, Fair: 0, Poor: 0 };
    roads.forEach(r => {
      const s = this.calcQuality(r);
      if (s >= 75) qBuckets.Good++; else if (s >= 45) qBuckets.Fair++; else qBuckets.Poor++;
    });
    const qCtx = document.getElementById('quality-chart').getContext('2d');
    if (this.charts.quality) this.charts.quality.destroy();
    this.charts.quality = new Chart(qCtx, {
      type: 'doughnut',
      data: {
        labels: ['Good', 'Fair', 'Poor'],
        datasets: [{ data: [qBuckets.Good, qBuckets.Fair, qBuckets.Poor], backgroundColor: ['#059669', '#d97706', '#dc2626'], borderWidth: 0 }],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    });

    const top6 = [...roads].sort((a, b) => b.pothole_reports - a.pothole_reports).slice(0, 6);
    const pCtx = document.getElementById('pothole-chart').getContext('2d');
    if (this.charts.pothole) this.charts.pothole.destroy();
    this.charts.pothole = new Chart(pCtx, {
      type: 'bar',
      data: {
        labels: top6.map(r => this.routeDisplayId(r)),
        datasets: [{ label: 'Reports', data: top6.map(r => r.pothole_reports), backgroundColor: '#ea580c' }],
      },
      options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } },
    });
  },

  /* ─── Chat ─── */
  initChat() {
    setTimeout(() => {
      const n = this.getRoads().length;
      this.addBotMessage(
        `Welcome to **RoadWatch** asset monitoring.\n\n**${n.toLocaleString()}** routes in **${this.country}**.\n\nAsk about nearest routes, budgets, condition scores, or file a complaint. Try *NH 44* or *Mumbai*.`
      );
    }, 400);
  },

  findRoadByQuery(text) {
    const roads = this.getRoads().filter(r => this.roadMatchesQuery(r, text));
    if (!roads.length) return null;
    const t = this.normalizeSearchQuery(text);
    const nhMatch = t.match(/(?:^|\s)nh\s*(\d+[a-z]*)/) || t.match(/^(\d+[a-z]*)$/);
    if (nhMatch) {
      const num = nhMatch[1] || nhMatch[0];
      const primary = roads.find(r => {
        const nh = (r.nh_number || '').toLowerCase().replace(/\s+/g, ' ');
        return nh === 'nh ' + num || nh.startsWith('nh ' + num);
      });
      if (primary) return primary;
    }
    return roads[0];
  },

  detectIntent(text) {
    const t = text.toLowerCase();
    if (/pothole|damage|broken|crack|report|complaint|issue/.test(t)) return 'REPORT';
    if (/budget|money|spent|fund|sanctioned/.test(t)) return 'BUDGET';
    if (/quality|score|condition|rating/.test(t)) return 'QUALITY';
    if (/officer|contact|engineer|authority/.test(t)) return 'OFFICER';
    if (/contractor|builder/.test(t)) return 'CONTRACTOR';
    if (/near|location|find|detect/.test(t)) return 'FIND_ROAD';
    if (/help|guide/.test(t)) return 'HELP';
    if (/list|all road|show road/.test(t)) return 'LIST_ROADS';
    const matched = this.findRoadByQuery(text);
    if (matched) return 'ROAD_NAME:' + matched.road_id;
    return 'UNKNOWN';
  },

  handleMessage(text) {
    if (!text.trim()) return;
    this.addUserMessage(text);
    this.showTyping();
    if (this.chatState === 'AWAIT_COMPLAINT_LOCATION') {
      this.chatContext.location = text;
      this.chatState = 'AWAIT_COMPLAINT_CONFIRM';
      setTimeout(() => {
        this.hideTyping();
        const road = this.chatContext.road;
        this.addBotMessage(`Complaint for **${road.road_name}** at "${text}" will route to **${road.responsible_officer}** (${road.officer_contact}).`);
        setTimeout(() => { this.hideTyping(); this.showComplaintRoutingCard(road, text); }, 300);
      }, 700);
      return;
    }
    setTimeout(() => {
      this.hideTyping();
      this.dispatchIntent(this.detectIntent(text), text);
    }, 700);
  },

  dispatchIntent(intent, text) {
    const roads = this.getRoads();
    if (intent === 'FIND_ROAD') {
      if (this.userLat && this.userLng) {
        const nearest = this.findNearest(this.userLat, this.userLng, roads);
        this.currentRoad = nearest;
        this.addBotMessage('Nearest route to your location:');
        setTimeout(() => { this.showRoadCard(nearest); this.viewRoad(nearest.road_id); }, 200);
      } else {
        this.addBotMessage('GPS unavailable. Enable location or search by route ID.');
      }
      return;
    }
    if (intent === 'BUDGET') {
      const road = this.currentRoad || roads[0];
      this.addBotMessage(`Budget for **${road.road_name}**:`);
      setTimeout(() => this.showBudgetCard(road), 200);
      return;
    }
    if (intent === 'QUALITY') {
      const road = this.currentRoad || roads[0];
      const score = this.calcQuality(road);
      const q = this.qualityLabel(score);
      this.addBotMessage(`**${road.road_name}** — ${q.label} (${score}/100). Last relay: ${road.last_relay_date}. Reports: ${road.pothole_reports}.`);
      return;
    }
    if (intent === 'REPORT') {
      const road = this.currentRoad || roads[0];
      this.chatState = 'AWAIT_COMPLAINT_LOCATION';
      this.chatContext = { road };
      this.addBotMessage(`Describe the location on **${road.road_name}** (e.g. KM marker, landmark):`);
      return;
    }
    if (intent === 'OFFICER') {
      const road = this.currentRoad || roads[0];
      this.addBotMessage(`**Officer:** ${road.responsible_officer}\n**Phone:** ${road.officer_contact}\n**Email:** ${road.officer_email}\n**Dept:** ${road.department}`);
      return;
    }
    if (intent === 'CONTRACTOR') {
      const road = this.currentRoad || roads[0];
      this.addBotMessage(`**Contractor:** ${road.contractor_name}\n**Value:** ${this.formatAmount(road.amount_sanctioned)}`);
      return;
    }
    if (intent === 'HELP') {
      this.addBotMessage('**Commands:** nearest route, budget, condition score, report issue, search NH number or city. Use the map and route list for visual monitoring.');
      return;
    }
    if (intent === 'LIST_ROADS') {
      this.switchView('monitor');
      const q = text.replace(/list|all road|show road/gi, '').trim();
      if (q) this.applySearch(q, 'list');
      this.addBotMessage(`Showing **${this.getFilteredRoads().length}** routes${q ? ` matching "${q}"` : ''}.`);
      return;
    }
    if (intent.startsWith('ROAD_NAME:')) {
      const road = this.findRoadById(intent.replace('ROAD_NAME:', ''));
      if (road) {
        this.currentRoad = road;
        this.addBotMessage(`**${road.road_name}**`);
        setTimeout(() => { this.showRoadCard(road); this.viewRoad(road.road_id); }, 200);
        return;
      }
    }
    this.addBotMessage('Try: "NH 44", "Find my nearest road", "Report a pothole", or "Budget".');
  },

  chatAboutRoad(roadId) {
    this.viewRoad(roadId);
    this.switchView('assistant');
  },

  addUserMessage(text) {
    const msgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg user';
    div.innerHTML = `<div class="msg-avatar"><i class="fa-solid fa-user"></i></div><div class="msg-content"><div class="msg-bubble">${this.md(text)}</div></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  addBotMessage(text, html = '') {
    const msgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg bot';
    div.innerHTML = `<div class="msg-avatar"><i class="fa-solid fa-robot"></i></div><div class="msg-content"><div class="msg-bubble">${html || this.md(text)}</div></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  appendCard(cardHtml) {
    const msgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg bot';
    div.innerHTML = `<div class="msg-avatar" style="visibility:hidden"></div><div class="msg-content">${cardHtml}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  showTyping() {
    const msgs = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg bot';
    div.id = 'typing-indicator';
    div.innerHTML = `<div class="msg-avatar"></div><div class="msg-content"><div class="msg-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div></div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  },

  hideTyping() {
    document.getElementById('typing-indicator')?.remove();
  },

  md(text) {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br/>');
  },

  showRoadCard(road) {
    const score = this.calcQuality(road);
    const q = this.qualityLabel(score);
    const pct = Math.round((road.amount_spent / Math.max(road.amount_sanctioned, 1)) * 100);
    const safeId = road.road_id.replace(/'/g, "\\'");
    this.appendCard(`
      <div class="road-card">
        <div class="road-card-header">
          <div class="road-card-name">${this.escapeHtml(road.road_name)}</div>
          <span class="road-type-badge badge-${road.road_type}">${road.road_type}</span>
        </div>
        <div class="road-card-row"><span class="label">Location</span><span>${this.escapeHtml(road.city)}, ${road.state}</span></div>
        <div class="road-card-row"><span class="label">Condition</span><span class="quality-badge-inline ${q.cls}">${q.label} ${score}</span></div>
        <div class="road-card-row"><span class="label">Budget</span><span>${this.formatAmount(road.amount_sanctioned)} (${pct}% spent)</span></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <button class="btn btn-primary" type="button" onclick="App.viewRoad('${safeId}')">View on map</button>
          <button class="btn btn-secondary" type="button" onclick="App.openComplaintModal('${safeId}')">Complaint</button>
        </div>
      </div>`);
  },

  showBudgetCard(road) {
    const pct = Math.round((road.amount_spent / Math.max(road.amount_sanctioned, 1)) * 100);
    const barClass = pct > 95 ? 'bar-danger' : pct > 70 ? 'bar-good' : 'bar-warning';
    this.appendCard(`
      <div class="budget-card">
        <h4>Budget — ${this.escapeHtml(this.routeDisplayId(road))}</h4>
        <div class="budget-bar-label" style="font-size:0.78rem;margin-bottom:4px;">Sanctioned: ${this.formatAmount(road.amount_sanctioned)} · ${pct}% utilized</div>
        <div class="budget-bar"><div class="budget-bar-fill ${barClass}" style="width:${pct}%"></div></div>
      </div>`);
  },

  showComplaintRoutingCard(road, location) {
    this.appendCard(`
      <div class="complaint-card">
        <h4>Complaint routing</h4>
        <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:10px;">${road.responsible_officer}<br/>${road.officer_contact}</p>
        <button class="btn btn-primary" type="button" onclick="App.openComplaintModal('${road.road_id}','${location.replace(/'/g, "\\'")}')">File complaint</button>
      </div>`);
    this.chatState = 'IDLE';
  },

  highlightOnMap(roadId) {
    this.viewRoad(roadId);
  },

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
    return `Date: ${date}\n\nTo,\n${road.responsible_officer}\n${road.department}\n\nSubject: ${type} on ${road.road_name}\n\nLocation: ${loc}\n\n${desc}\n\nRoad ID: ${road.road_id}\n\n${name}\n[RoadWatch]`;
  },

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
      this.loadComplaintsFromDB();
    };
    req.onerror = () => {
      const el = document.getElementById('db-status');
      if (el) el.textContent = 'Storage: unavailable';
    };
  },

  loadComplaintsFromDB() {
    if (!this.offlineDB) return;
    const tx = this.offlineDB.transaction('complaints', 'readonly');
    const store = tx.objectStore('complaints');
    const req = store.getAll();
    req.onsuccess = () => {
      this.complaints = req.result || [];
      this.renderReportMarkers();
    };
    req.onerror = () => {
      this.complaints = [];
      this.renderReportMarkers();
    };
  },

  cacheRoadsOffline() {
    if (!this.offlineDB || typeof ROADS === 'undefined') return;
    const all = Object.values(ROADS).flat();
    let i = 0;
    const chunk = 200;
    const next = () => {
      if (i >= all.length) {
        const el = document.getElementById('db-status');
        if (el) el.textContent = `Storage: ${all.length} routes`;
        return;
      }
      const tx = this.offlineDB.transaction('roads', 'readwrite');
      all.slice(i, i + chunk).forEach(r => tx.objectStore('roads').put(r));
      i += chunk;
      setTimeout(next, 0);
    };
    next();
  },

  saveComplaintOffline(complaint) {
    if (!this.offlineDB) return;
    this.offlineDB.transaction('complaints', 'readwrite').objectStore('complaints').add({ ...complaint, savedAt: Date.now() });
    const count = parseInt(localStorage.getItem('rw_complaints') || '0', 10) + 1;
    localStorage.setItem('rw_complaints', String(count));
    document.getElementById('stat-complaints').textContent = count;
    this.updateDashboardStats();
    this.loadComplaintsFromDB();
  },

  initVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.showToast('Voice input not supported'); return null; }
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.onresult = e => {
      const t = e.results[0][0].transcript;
      document.getElementById('chat-input').value = t;
      this.handleMessage(t);
      document.getElementById('chat-input').value = '';
    };
    rec.onend = () => {
      this.voiceActive = false;
      document.getElementById('voice-btn')?.classList.remove('listening');
    };
    return rec;
  },

  monitorOnline() {
    const update = () => {
      const on = navigator.onLine;
      const dot = document.getElementById('online-dot');
      const txt = document.getElementById('online-text');
      if (dot) dot.className = 'online-dot ' + (on ? 'online' : 'offline');
      if (txt) txt.textContent = on ? 'Online' : 'Offline';
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  },

  showToast(msg) {
    document.querySelectorAll('.toast').forEach(el => el.remove());
    const t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-visible'));
    setTimeout(() => {
      t.classList.add('toast-out');
      setTimeout(() => t.remove(), 350);
    }, 2800);
  },

  pulseStat(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('stat-pulse');
    void el.offsetWidth;
    el.classList.add('stat-pulse');
  },

  openSettings() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    const contrast = document.getElementById('toggle-contrast');
    const motion = document.getElementById('toggle-motion');
    if (contrast) contrast.checked = document.body.classList.contains('hc');
    if (motion) motion.checked = document.body.classList.contains('rm');
    modal.classList.add('active');
  },

  closeSettings() {
    document.getElementById('settings-modal')?.classList.remove('active');
  },

  applyAccessibilityFromStorage() {
    const hc = localStorage.getItem('rw_hc') === '1';
    const rm = localStorage.getItem('rw_rm') === '1';
    document.body.classList.toggle('hc', hc);
    document.body.classList.toggle('rm', rm);
  },

  exportCsv() {
    const roads = this.getFilteredRoads(this.roadsFilterKey, this.roadsTypeFilter).map(r => this.withOverrides(r));
    const header = ['road_id', 'nh_number', 'road_name', 'road_type', 'city', 'state', 'length_km', 'condition_score', 'reports', 'sanctioned', 'spent', 'last_relay_date'];
    const rows = roads.map(r => {
      const score = this.calcQuality(r);
      return [
        r.road_id,
        r.nh_number || '',
        r.road_name,
        r.road_type,
        r.city,
        r.state,
        r.road_length_km,
        score,
        r.pothole_reports || 0,
        r.amount_sanctioned,
        r.amount_spent,
        r.last_relay_date,
      ];
    });
    const csv = [header, ...rows]
      .map(cols => cols.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `roadwatch_${this.country}_${Date.now()}.csv`;
    a.click();
    this.showToast('CSV exported.');

    const showReports = document.getElementById('filter-reports')?.checked;
    if (showReports && (this.complaints || []).length) {
      const days = parseInt(document.getElementById('filter-report-days')?.value || '30', 10);
      const type = document.getElementById('filter-report-type')?.value || '';
      const cutoff = Date.now() - days * 86400000;
      const items = (this.complaints || []).filter(c => {
        const ts = c.savedAt || Date.parse(c.timestamp || '') || 0;
        if (ts && ts < cutoff) return false;
        if (type && c.type !== type) return false;
        return true;
      });
      const h2 = ['id', 'road_id', 'road_name', 'type', 'location', 'desc', 'name', 'timestamp'];
      const r2 = items.map(c => [c.id || '', c.road_id, c.road_name, c.type, c.location, c.desc, c.name, c.timestamp]);
      const csv2 = [h2, ...r2].map(cols => cols.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const b2 = new Blob([csv2], { type: 'text/csv;charset=utf-8' });
      const a2 = document.createElement('a');
      a2.href = URL.createObjectURL(b2);
      a2.download = `roadwatch_reports_${this.country}_${Date.now()}.csv`;
      a2.click();
    }
  },

  copyShareLink() {
    const url = new URL(window.location.href);
    const active = document.querySelector('.sidebar-btn.active')?.dataset?.view || 'monitor';
    url.searchParams.set('view', active);
    if (this.selectedRoadId) url.searchParams.set('road', this.selectedRoadId);
    const q = this.roadsFilterKey || '';
    if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
    const type = this.roadsTypeFilter || '';
    if (type) url.searchParams.set('type', type); else url.searchParams.delete('type');
    const st = document.getElementById('state-filter')?.value || '';
    if (st) url.searchParams.set('state', st); else url.searchParams.delete('state');
    navigator.clipboard?.writeText(url.toString());
    this.showToast('Share link copied.');
  },

  updateUrlState() {
    const url = new URL(window.location.href);
    const active = document.querySelector('.sidebar-btn.active')?.dataset?.view || 'monitor';
    url.searchParams.set('view', active);
    url.searchParams.set('country', this.country);
    if (this.selectedRoadId) url.searchParams.set('road', this.selectedRoadId); else url.searchParams.delete('road');
    if (this.roadsFilterKey) url.searchParams.set('q', this.roadsFilterKey); else url.searchParams.delete('q');
    if (this.roadsTypeFilter) url.searchParams.set('type', this.roadsTypeFilter); else url.searchParams.delete('type');
    const st = document.getElementById('state-filter')?.value || '';
    if (st) url.searchParams.set('state', st); else url.searchParams.delete('state');
    history.replaceState({}, '', url.toString());
  },

  applyUrlState() {
    const url = new URL(window.location.href);
    const view = url.searchParams.get('view');
    const country = url.searchParams.get('country');
    const q = url.searchParams.get('q') || '';
    const type = url.searchParams.get('type') || '';
    const st = url.searchParams.get('state') || '';
    const road = url.searchParams.get('road');
    if (country && document.getElementById('country-selector')) {
      document.getElementById('country-selector').value = country;
      this.country = country;
      this.buildRoadIndex();
      this.populateStateFilter();
    }
    if (st && document.getElementById('state-filter')) document.getElementById('state-filter').value = st;
    this.roadsTypeFilter = type;
    const typeSel = document.getElementById('road-filter-type');
    if (typeSel) typeSel.value = type;
    this.applySearch(q, 'map');
    if (view) this.switchView(view);
    if (road) setTimeout(() => this.viewRoad(road), 300);
  },

  initEvents() {
    document.getElementById('send-btn')?.addEventListener('click', () => {
      const inp = document.getElementById('chat-input');
      if (inp?.value.trim()) { this.handleMessage(inp.value.trim()); inp.value = ''; }
    });
    document.getElementById('chat-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const inp = e.target;
        if (inp.value.trim()) { this.handleMessage(inp.value.trim()); inp.value = ''; }
      }
    });
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleMessage(btn.dataset.msg));
    });

    document.getElementById('country-selector')?.addEventListener('change', () => this.onCountryChange());
    document.getElementById('state-filter')?.addEventListener('change', () => {
      this.roadsPage = 0;
      this.renderRoadsList();
      this.scheduleMapRender();
      this.updateUrlState();
    });

    document.querySelectorAll('.sidebar-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => this.switchView(btn.dataset.view));
    });
    document.getElementById('btn-locate')?.addEventListener('click', () => this.locateUser());
    document.getElementById('btn-settings')?.addEventListener('click', () => this.openSettings());
    document.getElementById('settings-close')?.addEventListener('click', () => this.closeSettings());
    document.getElementById('settings-modal')?.addEventListener('click', e => {
      if (e.target.id === 'settings-modal') this.closeSettings();
    });
    document.getElementById('toggle-contrast')?.addEventListener('change', e => {
      const on = !!e.target.checked;
      document.body.classList.toggle('hc', on);
      localStorage.setItem('rw_hc', on ? '1' : '0');
    });
    document.getElementById('toggle-motion')?.addEventListener('change', e => {
      const on = !!e.target.checked;
      document.body.classList.toggle('rm', on);
      localStorage.setItem('rw_rm', on ? '1' : '0');
    });

    document.getElementById('btn-nearby')?.addEventListener('click', () => {
      if (this.userLat == null || this.userLng == null) {
        this.showToast('Enable location to use Nearby sorting.');
        return;
      }
      this.nearbyMode = !this.nearbyMode;
      document.getElementById('btn-nearby')?.classList.toggle('active', this.nearbyMode);
      this.roadsPage = 0;
      this.renderRoadsList();
    });
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportCsv());
    document.getElementById('btn-share')?.addEventListener('click', () => this.copyShareLink());

    const onSearch = (val, src) => {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => this.applySearch(val, src), 100);
    };
    document.getElementById('map-search')?.addEventListener('input', e => onSearch(e.target.value, 'map'));
    document.getElementById('road-search')?.addEventListener('input', e => onSearch(e.target.value, 'list'));
    document.getElementById('road-filter-type')?.addEventListener('change', e => {
      this.roadsTypeFilter = e.target.value;
      this.roadsPage = 0;
      this.renderRoadsList();
    });

    ['filter-high', 'filter-mid', 'filter-low'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        this.renderRoadsList();
        this.scheduleMapRender();
      });
    });
    ['filter-reports', 'filter-report-type', 'filter-report-days'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => this.renderReportMarkers());
    });

    document.getElementById('btn-map-filter')?.addEventListener('click', () => {
      const dd = document.getElementById('filter-dropdown');
      const btn = document.getElementById('btn-map-filter');
      dd?.classList.toggle('open');
      btn?.classList.toggle('active', !!dd?.classList.contains('open'));
    });
    document.getElementById('drawer-backdrop')?.addEventListener('click', () => this.closeDrawer());
    document.getElementById('btn-map-reset')?.addEventListener('click', () => {
      this.applyMapRegion(true);
      this.renderMapMarkers();
    });

    document.getElementById('drawer-close')?.addEventListener('click', () => this.closeDrawer());
    document.getElementById('voice-btn')?.addEventListener('click', () => {
      if (this.voiceActive) return;
      const rec = this.initVoice();
      if (!rec) return;
      this.voiceActive = true;
      document.getElementById('voice-btn').classList.add('listening');
      rec.start();
    });

    document.getElementById('complaint-modal-close')?.addEventListener('click', () => {
      document.getElementById('complaint-modal').classList.remove('active');
    });
    document.getElementById('complaint-modal')?.addEventListener('click', e => {
      if (e.target.id === 'complaint-modal') document.getElementById('complaint-modal').classList.remove('active');
    });
    document.getElementById('complaint-preview-btn')?.addEventListener('click', () => {
      document.getElementById('letter-content').textContent = this.generateLetterText();
      document.getElementById('letter-preview-wrap').style.display = 'block';
    });
    document.getElementById('complaint-submit-btn')?.addEventListener('click', () => {
      const road = this.complaintRoad;
      if (!road) return;
      this.saveComplaintOffline({
        road_id: road.road_id, road_name: road.road_name,
        type: document.getElementById('complaint-type').value,
        desc: document.getElementById('complaint-desc').value,
        location: document.getElementById('complaint-location').value,
        name: document.getElementById('complaint-name').value,
        timestamp: new Date().toISOString(),
      });
      document.getElementById('complaint-modal').classList.remove('active');
      this.addBotMessage(`Complaint filed for **${road.road_name}**.`);
      this.showToast('Complaint saved');
    });
    document.getElementById('download-letter-btn')?.addEventListener('click', () => {
      const blob = new Blob([this.generateLetterText()], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'RoadWatch_Complaint.txt';
      a.click();
    });

    document.addEventListener('click', e => {
      const panel = document.getElementById('map-filter-panel');
      if (panel && !panel.contains(e.target)) {
        document.getElementById('filter-dropdown')?.classList.remove('open');
        document.getElementById('btn-map-filter')?.classList.remove('active');
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.closeDrawer();
        this.closeSettings();
        document.getElementById('complaint-modal')?.classList.remove('active');
        document.getElementById('filter-dropdown')?.classList.remove('open');
        document.getElementById('btn-map-filter')?.classList.remove('active');
      }
      if (!e.altKey) return;
      if (e.key.toLowerCase() === 'l') { e.preventDefault(); this.locateUser(); }
      if (e.key.toLowerCase() === 'e') { e.preventDefault(); this.exportCsv(); }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); this.copyShareLink(); }
    });
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
