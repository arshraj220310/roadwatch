/**
 * Generates roadwatch/js/roads-data.js from Wikipedia NH catalog + world highways.
 * Run: node scripts/generate-roads.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

/* India bounding box — keeps markers on land */
const INDIA_BOUNDS = { latMin: 6.5, latMax: 37.1, lngMin: 68.0, lngMax: 97.5 };

const STATE_ALIASES = {
  'jammu and kashmir': 'Jammu and Kashmir',
  'jammu & kashmir': 'Jammu and Kashmir',
  'andaman and nicobar': 'Andaman & Nicobar',
  'andaman & nicobar': 'Andaman & Nicobar',
  'orissa': 'Odisha',
  'uttaranchal': 'Uttarakhand',
  'pondicherry': 'Puducherry',
};

const CITY_COORDS = {
  Delhi: { lat: 28.6139, lng: 77.209, state: 'Delhi' },
  Mumbai: { lat: 19.076, lng: 72.8777, state: 'Maharashtra' },
  Pune: { lat: 18.5204, lng: 73.8567, state: 'Maharashtra' },
  Bengaluru: { lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
  Bangalore: { lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
  Chennai: { lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu' },
  Hyderabad: { lat: 17.385, lng: 78.4867, state: 'Telangana' },
  Kolkata: { lat: 22.5726, lng: 88.3639, state: 'West Bengal' },
  Ahmedabad: { lat: 23.0225, lng: 72.5714, state: 'Gujarat' },
  Jaipur: { lat: 26.9124, lng: 75.7873, state: 'Rajasthan' },
  Lucknow: { lat: 26.8467, lng: 80.9462, state: 'Uttar Pradesh' },
  Patna: { lat: 25.5941, lng: 85.1376, state: 'Bihar' },
  Srinagar: { lat: 34.0837, lng: 74.7973, state: 'Jammu and Kashmir' },
  Leh: { lat: 34.1526, lng: 77.577, state: 'Ladakh' },
  Amritsar: { lat: 31.634, lng: 74.8723, state: 'Punjab' },
  Chandigarh: { lat: 30.7333, lng: 76.7794, state: 'Chandigarh' },
  Guwahati: { lat: 26.1445, lng: 91.7362, state: 'Assam' },
  Bhopal: { lat: 23.2599, lng: 77.4126, state: 'Madhya Pradesh' },
  Nagpur: { lat: 21.1458, lng: 79.0882, state: 'Maharashtra' },
  Kochi: { lat: 9.9312, lng: 76.2673, state: 'Kerala' },
  Thiruvananthapuram: { lat: 8.5241, lng: 76.9366, state: 'Kerala' },
  Varanasi: { lat: 25.3176, lng: 82.9739, state: 'Uttar Pradesh' },
  Agra: { lat: 27.1767, lng: 78.0081, state: 'Uttar Pradesh' },
  Indore: { lat: 22.7196, lng: 75.8577, state: 'Madhya Pradesh' },
  Surat: { lat: 21.1702, lng: 72.8311, state: 'Gujarat' },
  Visakhapatnam: { lat: 17.6868, lng: 83.2185, state: 'Andhra Pradesh' },
  Ranchi: { lat: 23.3441, lng: 85.3096, state: 'Jharkhand' },
  Shimla: { lat: 31.1048, lng: 77.1734, state: 'Himachal Pradesh' },
  Dehradun: { lat: 30.3165, lng: 78.0322, state: 'Uttarakhand' },
  Gangtok: { lat: 27.3389, lng: 88.6065, state: 'Sikkim' },
  Imphal: { lat: 24.817, lng: 93.9368, state: 'Manipur' },
  Agartala: { lat: 23.8315, lng: 91.2868, state: 'Tripura' },
  Shillong: { lat: 25.5788, lng: 91.8933, state: 'Meghalaya' },
  Aizawl: { lat: 23.7271, lng: 92.7176, state: 'Mizoram' },
  Kohima: { lat: 25.6747, lng: 94.1109, state: 'Nagaland' },
  'Port Blair': { lat: 11.6234, lng: 92.7265, state: 'Andaman & Nicobar' },
  Kanyakumari: { lat: 8.0883, lng: 77.5385, state: 'Tamil Nadu' },
  Madurai: { lat: 9.9252, lng: 78.1198, state: 'Tamil Nadu' },
  Coimbatore: { lat: 11.0168, lng: 76.9558, state: 'Tamil Nadu' },
  Ludhiana: { lat: 30.901, lng: 75.8573, state: 'Punjab' },
  Jodhpur: { lat: 26.2389, lng: 73.0243, state: 'Rajasthan' },
  Raipur: { lat: 21.2514, lng: 81.6296, state: 'Chhattisgarh' },
  Bhubaneswar: { lat: 20.2961, lng: 85.8245, state: 'Odisha' },
};

const STATE_COORDS = {
  'Andhra Pradesh': { lat: 15.9129, lng: 79.74, city: 'Amaravati' },
  'Arunachal Pradesh': { lat: 28.218, lng: 94.7278, city: 'Itanagar' },
  'Assam': { lat: 26.2006, lng: 92.9376, city: 'Guwahati' },
  'Bihar': { lat: 25.5941, lng: 85.1376, city: 'Patna' },
  'Chhattisgarh': { lat: 21.2787, lng: 81.8661, city: 'Raipur' },
  'Goa': { lat: 15.2993, lng: 74.124, city: 'Panaji' },
  'Gujarat': { lat: 22.2587, lng: 71.1924, city: 'Ahmedabad' },
  'Haryana': { lat: 29.0588, lng: 76.0856, city: 'Chandigarh' },
  'Himachal Pradesh': { lat: 31.1048, lng: 77.1734, city: 'Shimla' },
  'Jharkhand': { lat: 23.6102, lng: 85.2799, city: 'Ranchi' },
  'Karnataka': { lat: 12.9716, lng: 77.5946, city: 'Bengaluru' },
  'Kerala': { lat: 10.8505, lng: 76.2711, city: 'Kochi' },
  'Madhya Pradesh': { lat: 23.2599, lng: 77.4126, city: 'Bhopal' },
  'Maharashtra': { lat: 19.076, lng: 72.8777, city: 'Mumbai' },
  'Manipur': { lat: 24.817, lng: 93.9368, city: 'Imphal' },
  'Meghalaya': { lat: 25.467, lng: 91.3662, city: 'Shillong' },
  'Mizoram': { lat: 23.7271, lng: 92.7176, city: 'Aizawl' },
  'Nagaland': { lat: 25.6747, lng: 94.1109, city: 'Kohima' },
  'Odisha': { lat: 20.2961, lng: 85.8245, city: 'Bhubaneswar' },
  'Punjab': { lat: 30.901, lng: 75.8573, city: 'Ludhiana' },
  'Rajasthan': { lat: 26.9124, lng: 75.7873, city: 'Jaipur' },
  'Sikkim': { lat: 27.533, lng: 88.5122, city: 'Gangtok' },
  'Tamil Nadu': { lat: 13.0827, lng: 80.2707, city: 'Chennai' },
  'Telangana': { lat: 17.385, lng: 78.4867, city: 'Hyderabad' },
  'Tripura': { lat: 23.8315, lng: 91.2868, city: 'Agartala' },
  'Uttar Pradesh': { lat: 26.8467, lng: 80.9462, city: 'Lucknow' },
  'Uttarakhand': { lat: 30.0668, lng: 79.0193, city: 'Dehradun' },
  'West Bengal': { lat: 22.5726, lng: 88.3639, city: 'Kolkata' },
  'Delhi': { lat: 28.6139, lng: 77.209, city: 'Delhi' },
  'Jammu and Kashmir': { lat: 34.0837, lng: 74.7973, city: 'Srinagar' },
  'Ladakh': { lat: 34.1526, lng: 77.577, city: 'Leh' },
  'Chandigarh': { lat: 30.7333, lng: 76.7794, city: 'Chandigarh' },
  'Puducherry': { lat: 11.9416, lng: 79.8083, city: 'Puducherry' },
  'Andaman & Nicobar': { lat: 11.6234, lng: 92.7265, city: 'Port Blair' },
  'Andaman and Nicobar': { lat: 11.6234, lng: 92.7265, city: 'Port Blair' },
};

const CONTRACTORS = [
  'L&T Construction Ltd.', 'IRB Infrastructure Developers', 'Dilip Buildcon Ltd.',
  'MEIL Group', 'Gayatri Projects Ltd.', 'Ashoka Buildcon Ltd.', 'NHAI EPC Division',
  'HCC Ltd.', 'Sadbhav Engineering Ltd.', 'KCC Buildcon Pvt. Ltd.', 'GR Infra Projects',
  'PNC Infratech', 'Afcons Infrastructure', 'NCC Limited', 'KEC International',
];
const DEPARTMENTS = ['NHAI', 'NHIDCL', 'State PWD', 'Border Roads Organisation'];

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function stripMd(s) {
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
}

function parsePrimaryState(statesStr) {
  const clean = stripMd(statesStr).toLowerCase();
  for (const [alias, canonical] of Object.entries(STATE_ALIASES)) {
    if (clean.includes(alias)) return canonical;
  }
  for (const key of Object.keys(STATE_COORDS)) {
    if (clean.includes(key.toLowerCase())) return key;
  }
  const first = stripMd(statesStr).split(',')[0].trim();
  return STATE_COORDS[first] ? first : 'Delhi';
}

function clampIndia(lat, lng) {
  return {
    lat: Math.max(INDIA_BOUNDS.latMin, Math.min(INDIA_BOUNDS.latMax, lat)),
    lng: Math.max(INDIA_BOUNDS.lngMin, Math.min(INDIA_BOUNDS.lngMax, lng)),
  };
}

function cityFromRoute(route) {
  const plain = stripMd(route);
  for (const [name, c] of Object.entries(CITY_COORDS)) {
    if (plain.includes(name)) {
      return { lat: c.lat, lng: c.lng, city: name, state: c.state };
    }
  }
  return null;
}

function coordsFor(id, stateName, route) {
  const h = hash(id + stateName);
  const cityHit = cityFromRoute(route || '');
  if (cityHit) {
    const dLat = ((h % 400) / 1000 - 0.2) * 0.35;
    const dLng = (((h >> 8) % 400) / 1000 - 0.2) * 0.35;
    const c = clampIndia(cityHit.lat + dLat, cityHit.lng + dLng);
    return { lat: +c.lat.toFixed(4), lng: +c.lng.toFixed(4), city: cityHit.city, state: cityHit.state };
  }
  const base = STATE_COORDS[stateName] || STATE_COORDS.Delhi;
  const dLat = ((h % 400) / 1000 - 0.2) * 0.45;
  const dLng = (((h >> 8) % 400) / 1000 - 0.2) * 0.45;
  const c = clampIndia(base.lat + dLat, base.lng + dLng);
  return {
    lat: +c.lat.toFixed(4),
    lng: +c.lng.toFixed(4),
    city: base.city,
    state: STATE_COORDS[stateName] ? stateName : 'Delhi',
  };
}

function nhLabel(raw) {
  const t = raw.replace(/^NH\s*/i, '').trim();
  return t.match(/^\d/) ? `NH ${t}` : `NH ${t}`;
}

function stateSlug(state) {
  return state.replace(/\s+/g, '').slice(0, 6).toUpperCase();
}

function nhId(numLabel, state) {
  const slug = numLabel.replace(/\s+/g, '').replace(/NH/gi, 'NH-');
  return `${slug}-${stateSlug(state)}-${hash(numLabel + state) % 10000}`;
}

function coordsForState(stateName, seedKey) {
  const base = STATE_COORDS[stateName] || STATE_COORDS.Delhi;
  const h = hash(seedKey + stateName);
  const dLat = ((h % 400) / 1000 - 0.2) * 0.4;
  const dLng = (((h >> 8) % 400) / 1000 - 0.2) * 0.4;
  const c = clampIndia(base.lat + dLat, base.lng + dLng);
  return {
    lat: +c.lat.toFixed(4),
    lng: +c.lng.toFixed(4),
    city: base.city,
    state: STATE_COORDS[stateName] ? stateName : 'Delhi',
  };
}

function buildRoad(opts) {
  const {
    road_type,
    road_id,
    road_name,
    state,
    city,
    lat,
    lng,
    lengthKm,
    description,
    nh_number,
    sh_number,
    mdr_id,
    department,
    budget_source,
    officer_email,
    responsible_officer,
    amount_sanctioned,
    amount_spent,
    last_relay_date,
    contractor_name,
    pothole_reports,
    lanes,
  } = opts;

  const seed = hash(road_id + road_name);
  const h = seed;
  const len = lengthKm ?? 40;
  const loc = clampIndia(lat, lng);
  const daysAgo = 30 + (h % 400);
  const relay = last_relay_date || new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

  let sanctioned = amount_sanctioned;
  if (sanctioned == null) {
    if (road_type === 'NH') {
      sanctioned = Math.min(Math.round(len * 5500000 + (h % 80) * 15000000), 15000000000);
    } else if (road_type === 'SH') {
      sanctioned = Math.min(Math.round(len * 2200000 + (h % 40) * 8000000), 3000000000);
    } else if (road_type === 'MDR') {
      sanctioned = Math.min(Math.round(len * 900000 + (h % 30) * 3000000), 800000000);
    } else {
      sanctioned = Math.min(Math.round(len * 450000 + (h % 20) * 1500000), 150000000);
    }
  }

  const spentPct = amount_spent != null ? null : 68 + (h % 28);
  const spent = amount_spent ?? Math.round(sanctioned * (spentPct / 100));

  const row = {
    road_id,
    road_name,
    road_type,
    location: { lat: loc.lat, lng: loc.lng },
    city,
    state,
    last_relay_date: relay,
    contractor_name: contractor_name || pick(CONTRACTORS, h),
    amount_sanctioned: sanctioned,
    amount_spent: spent,
    budget_source: budget_source || (road_type === 'NH'
      ? 'Central Road Fund (65%) + State Budget (35%)'
      : road_type === 'City'
        ? 'Municipal Budget (90%) + State Grant (10%)'
        : 'State PWD Budget (85%) + Central Grant (15%)'),
    responsible_officer: responsible_officer || (
      road_type === 'NH' ? `Executive Engineer (NH Division ${(h % 900) + 100})`
        : road_type === 'City' ? `Municipal Engineer (${city})`
          : `Assistant Engineer (${road_type}, ${stateSlug(state)})`
    ),
    officer_contact: `+91-${10 + (h % 89)}-${String(2000000 + (h % 7999999)).slice(0, 7)}`,
    officer_email: officer_email || (
      road_type === 'NH' ? `ee.${(nh_number || road_id).replace(/\s+/g, '').toLowerCase()}@nhai.gov.in`
        : road_type === 'City' ? `roads@${city.toLowerCase().replace(/\s/g, '')}.mc.gov.in`
          : `pwd.${stateSlug(state).toLowerCase()}@nic.in`
    ),
    department: department || (
      road_type === 'NH' ? pick(DEPARTMENTS, h >> 4)
        : road_type === 'City' ? 'Municipal Corporation'
          : 'State PWD'
    ),
    pothole_reports: pothole_reports ?? (h % (road_type === 'City' ? 9 : 7)),
    road_length_km: Math.round(len),
    lanes: lanes ?? (road_type === 'City' ? 4 : road_type === 'MDR' ? 2 : 4),
    description: (description || road_name).slice(0, 200),
  };

  if (nh_number) row.nh_number = nh_number;
  if (sh_number) row.sh_number = sh_number;
  if (mdr_id) row.mdr_id = mdr_id;
  return row;
}

function expandRoad(entry) {
  const { numLabel, route, states, lengthKm } = entry;
  const state = parsePrimaryState(states);
  const loc = coordsFor(numLabel, state, route);
  const len = Math.max(15, Math.min(lengthKm || 50, 800));
  return buildRoad({
    road_type: 'NH',
    road_id: nhId(numLabel, state),
    road_name: `${numLabel} — ${route.slice(0, 80)}${route.length > 80 ? '…' : ''}`,
    state: loc.state,
    city: loc.city,
    lat: loc.lat,
    lng: loc.lng,
    lengthKm: len,
    description: route.slice(0, 200),
    nh_number: numLabel,
  });
}

const SH_PER_STATE = 14;
const MDR_PER_STATE = 7;

function generateStateHighways() {
  const roads = [];
  for (const stateName of Object.keys(STATE_COORDS)) {
    for (let n = 1; n <= SH_PER_STATE; n++) {
      const shNum = `SH ${n}`;
      const seed = `SH-${stateName}-${n}`;
      const loc = coordsForState(stateName, seed);
      const h = hash(seed);
      const len = 35 + (h % 120);
      roads.push(buildRoad({
        road_type: 'SH',
        road_id: `SH-${n}-${stateSlug(stateName)}-${h % 10000}`,
        road_name: `${shNum} — ${loc.city} to ${stateName} corridor`,
        state: loc.state,
        city: loc.city,
        lat: loc.lat,
        lng: loc.lng,
        lengthKm: len,
        description: `State highway ${n} in ${stateName}`,
        sh_number: shNum,
        department: 'State PWD',
      }));
    }
  }
  return roads;
}

function generateMdrRoads() {
  const roads = [];
  for (const stateName of Object.keys(STATE_COORDS)) {
    for (let n = 1; n <= MDR_PER_STATE; n++) {
      const mdrId = `MDR ${n}`;
      const seed = `MDR-${stateName}-${n}`;
      const loc = coordsForState(stateName, seed + '-mdr');
      const h = hash(seed);
      const len = 15 + (h % 30);
      roads.push(buildRoad({
        road_type: 'MDR',
        road_id: `MDR-${n}-${stateSlug(stateName)}-${h % 10000}`,
        road_name: `${mdrId} — ${loc.city} district link`,
        state: loc.state,
        city: loc.city,
        lat: loc.lat,
        lng: loc.lng,
        lengthKm: len,
        description: `Major district road ${n}, ${stateName}`,
        mdr_id: mdrId,
        department: 'State PWD',
      }));
    }
  }
  return roads;
}

const CITY_CORRIDORS = {
  Delhi: ['Ring Road (Outer)', 'NH 24 Link Road', 'Barapullah Elevated'],
  Mumbai: ['Western Express Highway', 'Eastern Freeway', 'Sion-Panvel Highway'],
  Bengaluru: ['Outer Ring Road', 'MG Road', 'Hosur Road'],
  Bangalore: ['Outer Ring Road', 'MG Road', 'Hosur Road'],
  Chennai: ['Anna Salai', 'OMR (Rajiv Gandhi Salai)', 'GST Road'],
  Hyderabad: ['Outer Ring Road (ORR)', 'PV Narasimha Rao Expressway', 'Tank Bund Road'],
  Kolkata: ['EM Bypass', 'VIP Road', 'Howrah Bridge Approach'],
  Pune: ['Mumbai-Pune Expressway Approach', 'Senapati Bapat Road'],
  Ahmedabad: ['SG Highway', 'Ashram Road', 'Sardar Patel Ring Road'],
  Jaipur: ['MI Road', 'Tonk Road', 'Ajmer Road'],
  Lucknow: ['Hazratganj Road', 'Shaheed Path'],
  Kochi: ['MG Road Kochi', 'NH Bypass Kochi'],
  Chandigarh: ['Madhya Marg', 'Udyog Path'],
};

function generateCityRoads() {
  const roads = [];
  const seenCities = new Set();
  for (const [cityName, c] of Object.entries(CITY_COORDS)) {
    if (seenCities.has(cityName)) continue;
    seenCities.add(cityName);
    const corridors = CITY_CORRIDORS[cityName] || [`${cityName} Urban Spine`, `${cityName} City Link`];
    corridors.forEach((name, idx) => {
      const seed = `CITY-${cityName}-${idx}`;
      const h = hash(seed);
      const dLat = ((h % 200) / 1000 - 0.1) * 0.15;
      const dLng = (((h >> 4) % 200) / 1000 - 0.1) * 0.15;
      const loc = clampIndia(c.lat + dLat, c.lng + dLng);
      const slug = cityName.replace(/\s+/g, '').slice(0, 8).toUpperCase();
      roads.push(buildRoad({
        road_type: 'City',
        road_id: `CITY-${slug}-${idx + 1}-${h % 10000}`,
        road_name: name,
        state: c.state,
        city: cityName,
        lat: loc.lat,
        lng: loc.lng,
        lengthKm: 8 + (h % 18),
        description: `Municipal arterial: ${name}, ${cityName}`,
        department: 'Municipal Corporation',
      }));
    });
  }
  return roads;
}

const FEATURED_SH_MDR_CITY = [
  { road_id: 'SH-17-KA-001', road_name: 'Bangalore-Mysore Highway (SH-17)', road_type: 'SH', sh_number: 'SH 17',
    location: { lat: 12.9141, lng: 77.6100 }, city: 'Bengaluru', state: 'Karnataka',
    last_relay_date: '2023-05-20', contractor_name: 'KCC Buildcon Pvt. Ltd.',
    amount_sanctioned: 85000000, amount_spent: 72000000,
    department: 'State PWD', pothole_reports: 5, road_length_km: 140, lanes: 4,
    description: 'Major state highway connecting Bengaluru and Mysuru' },
  { road_id: 'MDR-12-UP-001', road_name: 'Lucknow-Faizabad MDR (MDR-12)', road_type: 'MDR', mdr_id: 'MDR 12',
    location: { lat: 26.8467, lng: 80.9462 }, city: 'Lucknow', state: 'Uttar Pradesh',
    last_relay_date: '2022-11-08', contractor_name: 'Sadbhav Engineering Ltd.',
    amount_sanctioned: 22000000, amount_spent: 18500000,
    department: 'State PWD', pothole_reports: 8, road_length_km: 128, lanes: 2,
    description: 'District road connecting Lucknow and Ayodhya region' },
  { road_id: 'CITY-ORR-HYD-001', road_name: 'Outer Ring Road Hyderabad', road_type: 'City',
    location: { lat: 17.3850, lng: 78.4867 }, city: 'Hyderabad', state: 'Telangana',
    last_relay_date: '2024-02-01', contractor_name: 'MEIL Group',
    amount_sanctioned: 450000000, amount_spent: 420000000,
    department: 'Municipal Corporation', pothole_reports: 2, road_length_km: 158, lanes: 8,
    description: '158 km orbital expressway around Hyderabad' },
  { road_id: 'CITY-MG-BLR-001', road_name: 'MG Road Bengaluru', road_type: 'City',
    location: { lat: 12.9716, lng: 77.5946 }, city: 'Bengaluru', state: 'Karnataka',
    last_relay_date: '2023-08-15', contractor_name: 'L&T Construction Ltd.',
    amount_sanctioned: 35000000, amount_spent: 31000000,
    department: 'Municipal Corporation', pothole_reports: 4, road_length_km: 12, lanes: 4,
    description: 'Central business district arterial' },
  { road_id: 'CITY-ANNA-CHN-001', road_name: 'Anna Salai Chennai', road_type: 'City',
    location: { lat: 13.0827, lng: 80.2707 }, city: 'Chennai', state: 'Tamil Nadu',
    last_relay_date: '2023-03-22', contractor_name: 'GR Infra Projects',
    amount_sanctioned: 28000000, amount_spent: 24000000,
    department: 'Municipal Corporation', pothole_reports: 6, road_length_km: 15, lanes: 6,
    description: 'Historic commercial spine of Chennai' },
  { road_id: 'CITY-RING-DL-001', road_name: 'Delhi Ring Road (Outer)', road_type: 'City',
    location: { lat: 28.6139, lng: 77.2090 }, city: 'Delhi', state: 'Delhi',
    last_relay_date: '2023-07-10', contractor_name: 'Afcons Infrastructure',
    amount_sanctioned: 180000000, amount_spent: 165000000,
    department: 'Municipal Corporation', pothole_reports: 5, road_length_km: 51, lanes: 6,
    description: 'Outer Ring Road encircling Delhi NCR' },
  { road_id: 'CITY-WE-MUM-001', road_name: 'Western Express Highway Mumbai', road_type: 'City',
    location: { lat: 19.0760, lng: 72.8777 }, city: 'Mumbai', state: 'Maharashtra',
    last_relay_date: '2024-01-05', contractor_name: 'IRB Infrastructure Developers',
    amount_sanctioned: 95000000, amount_spent: 88000000,
    department: 'Municipal Corporation', pothole_reports: 3, road_length_km: 25, lanes: 8,
    description: 'Primary north-south arterial in Mumbai' },
];

function dedupeByRoadId(roads) {
  const byId = new Map();
  for (const r of roads) byId.set(r.road_id, r);
  return [...byId.values()];
}

function mergeFeaturedById(generated, featured) {
  const byId = new Map(featured.map(r => [r.road_id, r]));
  const out = [];
  for (const r of generated) {
    out.push(byId.get(r.road_id) || r);
  }
  for (const r of featured) {
    if (!out.some(x => x.road_id === r.road_id)) out.unshift(r);
  }
  return out;
}

function countByType(roads) {
  const c = { NH: 0, SH: 0, MDR: 0, City: 0 };
  for (const r of roads) {
    if (c[r.road_type] !== undefined) c[r.road_type]++;
  }
  return c;
}

function parseWikipediaCatalog(path) {
  const text = readFileSync(path, 'utf8');
  const roads = [];
  const seen = new Set();

  for (const line of text.split('\n')) {
    if (!line.startsWith('| [')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 4) continue;

    const linkMatch = cells[0].match(/\[((?:NH\s*)?[\d]+[A-Za-z]+)\]/i)
      || cells[0].match(/\[(\d+[A-Za-z]*)\]/);
    if (!linkMatch) continue;

    let numLabel = linkMatch[1].trim();
    if (/^\d/.test(numLabel)) numLabel = 'NH ' + numLabel;
    else numLabel = nhLabel(numLabel);

    const route = stripMd(cells[1]);
    if (!route || route.length < 3) continue;

    const states = stripMd(cells[2]);
    const lengthKm = parseFloat(cells[3]);
    if (!states) continue;

    const key = numLabel + '|' + route.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);

    roads.push(expandRoad({
      numLabel,
      route,
      states,
      lengthKm: Number.isFinite(lengthKm) ? lengthKm : 40 + (hash(key) % 120),
    }));
  }
  return roads;
}

// USA Interstates (major network)
const US_INTERSTATES = [
  ['I-5', 'San Diego to Seattle', 'California', 36.7783, -119.4179, 2765],
  ['I-10', 'Santa Monica to Jacksonville', 'Texas', 31.9686, -99.9018, 2460],
  ['I-15', 'San Diego to Sweetgrass', 'Utah', 39.3210, -111.0937, 1470],
  ['I-20', 'Kent to Florence', 'Texas', 32.7767, -96.7970, 1535],
  ['I-25', 'Las Cruces to Buffalo', 'Colorado', 39.5501, -105.7821, 1060],
  ['I-35', 'Laredo to Duluth', 'Iowa', 41.8780, -93.0977, 1568],
  ['I-40', 'Barstow to Wilmington', 'Tennessee', 35.5175, -86.5804, 2555],
  ['I-44', 'Wichita Falls to St. Louis', 'Oklahoma', 35.4676, -97.5164, 633],
  ['I-55', 'LaPlace to Chicago', 'Illinois', 41.8781, -87.6298, 964],
  ['I-65', 'Mobile to Gary', 'Indiana', 39.7684, -86.1581, 887],
  ['I-70', 'Cove Fort to Baltimore', 'Ohio', 39.9612, -82.9988, 2151],
  ['I-75', 'Miami to Sault Ste. Marie', 'Georgia', 32.1656, -82.9001, 1786],
  ['I-80', 'San Francisco to Teaneck', 'Nebraska', 41.4925, -99.9018, 2909],
  ['I-85', 'Montgomery to Petersburg', 'Georgia', 33.7490, -84.3880, 668],
  ['I-90', 'Seattle to Boston', 'South Dakota', 43.9695, -99.9018, 4960],
  ['I-95', 'Miami to Maine', 'Virginia', 37.4316, -78.6569, 1924],
  ['I-81', 'Tennessee to New York', 'Virginia', 37.5407, -77.4360, 854],
  ['I-77', 'Columbia to Cleveland', 'North Carolina', 35.7596, -79.0193, 610],
  ['I-64', 'Chesapeake to Wentzville', 'Missouri', 38.5739, -92.6037, 953],
  ['I-94', 'Billings to Port Huron', 'Minnesota', 46.7296, -94.6859, 1585],
];

function usRoad([code, route, state, lat, lng, len]) {
  const h = hash(code);
  const sanctioned = 20000000 + (h % 80) * 1000000;
  return {
    road_id: `${code}-${state.slice(0, 2).toUpperCase()}-US`,
    road_name: `${code} (${route})`,
    road_type: 'NH',
    location: { lat, lng },
    city: state,
    state,
    last_relay_date: '2023-06-15',
    contractor_name: pick(CONTRACTORS, h),
    amount_sanctioned: sanctioned,
    amount_spent: Math.round(sanctioned * (0.6 + (h % 35) / 100)),
    budget_source: 'Federal Highway Fund (80%) + State DOT (20%)',
    responsible_officer: 'District Highway Engineer',
    officer_contact: '+1-800-555-0100',
    officer_email: `${code.toLowerCase().replace('-', '')}@dot.gov`,
    department: 'State DOT',
    pothole_reports: h % 6,
    road_length_km: Math.round(len * 1.609),
    lanes: 4,
    description: route,
    currency: 'USD',
  };
}

// Kenya highways
const KENYA_ROADS = [
  ['A104', 'Nairobi–Mombasa Highway', 'Nairobi', -1.2921, 36.8219, 480],
  ['A2', 'Nairobi–Nakuru Highway', 'Nakuru', -0.3031, 36.08, 156],
  ['A3', 'Nairobi–Kisumu Highway', 'Kisumu', -0.0917, 34.768, 350],
  ['B8', 'Thika Superhighway', 'Thika', -1.0296, 37.0747, 50],
  ['A109', 'Nairobi–Moyale Road', 'Isiolo', 0.3545, 37.5833, 680],
  ['A104', 'Mombasa–Malindi Road', 'Mombasa', -4.0435, 39.6682, 120],
  ['C39', 'Nakuru–Eldoret Road', 'Eldoret', 0.5143, 35.2698, 155],
  ['A2', 'Nakuru–Eldoret Section', 'Nakuru', -0.3031, 36.08, 212],
  ['B3', 'Kisumu–Busia Road', 'Kisumu', -0.0917, 34.768, 145],
  ['A3', 'Nakuru–Kericho Road', 'Kericho', -0.367, 35.2839, 80],
];

function kenyaRoad([code, name, city, lat, lng, len], i) {
  const h = hash(code + city + i);
  const sanctioned = 500000000 + (h % 200) * 10000000;
  return {
    road_id: `${code}-KE-${i}`,
    road_name: `${name} (${code})`,
    road_type: 'NH',
    location: { lat, lng },
    city,
    state: city + ' County',
    last_relay_date: '2022-08-10',
    contractor_name: 'KeNHA Contractor Consortium',
    amount_sanctioned: sanctioned,
    amount_spent: Math.round(sanctioned * 0.75),
    budget_source: 'KeNHA Budget (60%) + Development Partners (40%)',
    responsible_officer: 'Regional Highway Manager',
    officer_contact: '+254-20-3988000',
    officer_email: `highways@${city.toLowerCase().replace(/\s/g, '')}.go.ke`,
    department: 'KeNHA',
    pothole_reports: h % 6,
    road_length_km: len,
    lanes: 4,
    description: name,
    currency: 'KES',
  };
}

// UK motorways
const UK_ROADS = [
  ['M1', 'London to Leeds', 'England', 52.4862, -1.8904, 311],
  ['M4', 'London to South Wales', 'England', 51.4816, -3.1791, 189],
  ['M6', 'Rugby to Carlisle', 'England', 52.4068, -1.5197, 379],
  ['M25', 'London Orbital', 'England', 51.5074, -0.1278, 188],
  ['M62', 'Liverpool to Hull', 'England', 53.4808, -2.2426, 172],
  ['M8', 'Edinburgh to Glasgow', 'Scotland', 55.9533, -3.1883, 97],
  ['A1(M)', 'Great North Road', 'England', 54.9783, -1.6178, 127],
  ['M5', 'Birmingham to Exeter', 'England', 52.4862, -1.8904, 246],
];

function ukRoad([code, route, region, lat, lng, len]) {
  const h = hash(code);
  return {
    road_id: `${code}-UK`,
    road_name: `${code} — ${route}`,
    road_type: 'NH',
    location: { lat, lng },
    city: region,
    state: region,
    last_relay_date: '2023-04-20',
    contractor_name: 'National Highways Contractor',
    amount_sanctioned: 15000000 + (h % 50) * 500000,
    amount_spent: Math.round(12000000 + (h % 40) * 400000),
    budget_source: 'National Highways (UK)',
    responsible_officer: 'Network Operations Manager',
    officer_contact: '+44-300-123-5000',
    officer_email: 'enquiries@nationalhighways.co.uk',
    department: 'National Highways',
    pothole_reports: h % 5,
    road_length_km: len,
    lanes: 3,
    description: route,
    currency: 'GBP',
  };
}

// Australia highways
const AU_ROADS = [
  ['M1', 'Pacific Motorway', 'Queensland', -27.4698, 153.0251, 1700],
  ['M2', 'Sydney Orbital', 'New South Wales', -33.8688, 151.2093, 110],
  ['A1', 'Princes Highway', 'Victoria', -37.8136, 144.9631, 1800],
  ['M31', 'Hume Highway', 'New South Wales', -34.9285, 138.6007, 807],
  ['M80', 'Western Ring Road', 'Victoria', -37.7, 144.85, 77],
  ['A20', 'Stuart Highway', 'Northern Territory', -23.698, 133.8807, 2834],
];

function auRoad([code, route, state, lat, lng, len]) {
  const h = hash(code);
  return {
    road_id: `${code}-AU`,
    road_name: `${code} — ${route}`,
    road_type: 'NH',
    location: { lat, lng },
    city: state,
    state,
    last_relay_date: '2023-09-01',
    contractor_name: 'State Roads Authority',
    amount_sanctioned: 8000000 + (h % 60) * 200000,
    amount_spent: Math.round(6000000 + (h % 50) * 180000),
    budget_source: 'Federal + State Roads Fund',
    responsible_officer: 'Regional Director',
    officer_contact: '+61-2-8843-2444',
    officer_email: 'roads@infrastructure.gov.au',
    department: 'State Roads',
    pothole_reports: h % 5,
    road_length_km: len,
    lanes: 4,
    description: route,
    currency: 'AUD',
  };
}

// Featured India roads with richer manual data (override generated)
const FEATURED_INDIA = [
  { road_id: 'NH-44-DL-001', road_name: 'Grand Trunk Road (NH-44)', road_type: 'NH', nh_number: 'NH 44',
    location: { lat: 28.7041, lng: 77.1025 }, city: 'Delhi', state: 'Delhi',
    last_relay_date: '2023-02-15', contractor_name: 'L&T Construction Ltd.',
    amount_sanctioned: 125000000, amount_spent: 98000000,
    budget_source: 'Central Road Fund (60%) + State Budget (40%)',
    responsible_officer: 'Executive Engineer A.K. Sharma', officer_contact: '+91-11-23456789',
    officer_email: 'ee.nh44@nhai.gov.in', department: 'NHAI', pothole_reports: 3,
    road_length_km: 45, lanes: 6, description: 'Major NH connecting Delhi to Amritsar' },
  { road_id: 'NH-48-MH-002', road_name: 'Mumbai-Pune Expressway (NH-48)', road_type: 'NH', nh_number: 'NH 48',
    location: { lat: 18.9667, lng: 73.8278 }, city: 'Mumbai', state: 'Maharashtra',
    last_relay_date: '2024-01-10', contractor_name: 'IRB Infrastructure Developers',
    amount_sanctioned: 320000000, amount_spent: 315000000,
    budget_source: 'NHAI Toll Fund (80%) + Maharashtra State (20%)',
    responsible_officer: 'Project Director R.V. Desai', officer_contact: '+91-22-26574800',
    officer_email: 'pd.nh48@nhai.gov.in', department: 'NHAI', pothole_reports: 1,
    road_length_km: 95, lanes: 6, description: 'Premium expressway connecting Mumbai & Pune' },
];

function mergeFeatured(generated, featured) {
  const byName = new Map();
  featured.forEach(r => byName.set((r.nh_number || r.road_name).toLowerCase(), r));
  const out = [];
  const usedFeatured = new Set();
  for (const r of generated) {
    const key = (r.nh_number || '').toLowerCase();
    if (key && byName.has(key)) {
      out.push(byName.get(key));
      usedFeatured.add(key);
    } else {
      out.push(r);
    }
  }
  featured.forEach(r => {
    const key = (r.nh_number || r.road_name).toLowerCase();
    if (!usedFeatured.has(key)) out.unshift(r);
  });
  return out;
}

const wikiPath = join(__dir, 'nh-wikipedia.md');
let indiaNh = parseWikipediaCatalog(wikiPath);
indiaNh = mergeFeatured(indiaNh, FEATURED_INDIA);

const indiaSh = generateStateHighways();
const indiaMdr = generateMdrRoads();
const indiaCity = generateCityRoads();

let india = dedupeByRoadId([
  ...indiaNh,
  ...mergeFeaturedById(indiaSh, FEATURED_SH_MDR_CITY.filter(r => r.road_type === 'SH')),
  ...mergeFeaturedById(indiaMdr, FEATURED_SH_MDR_CITY.filter(r => r.road_type === 'MDR')),
  ...mergeFeaturedById(indiaCity, FEATURED_SH_MDR_CITY.filter(r => r.road_type === 'City')),
]);

const indiaTypes = countByType(india);

const usa = US_INTERSTATES.map(usRoad);
const kenya = KENYA_ROADS.map((r, i) => kenyaRoad(r, i));
const uk = UK_ROADS.map(ukRoad);
const australia = AU_ROADS.map(auRoad);

const ROADS = { india, usa, kenya, uk, australia };

const outPath = join(root, 'js', 'roads-data.js');
const typeLine = `NH ${indiaTypes.NH} · SH ${indiaTypes.SH} · MDR ${indiaTypes.MDR} · City ${indiaTypes.City}`;
const header = `/* AUTO-GENERATED by scripts/generate-roads.mjs — do not edit manually */
/* India: ${india.length} total (${typeLine}) | NH from Wikipedia; SH/MDR/City are catalog estimates */
/* USA: ${usa.length} | Kenya: ${kenya.length} | UK: ${uk.length} | Australia: ${australia.length} */
const ROADS = `;

writeFileSync(outPath, header + JSON.stringify(ROADS) + ';\n', 'utf8');

console.log('Generated', outPath);
console.log('  India:', india.length, `(${typeLine})`);
console.log('  USA:', usa.length);
console.log('  Kenya:', kenya.length);
console.log('  UK:', uk.length);
console.log('  Australia:', australia.length);
