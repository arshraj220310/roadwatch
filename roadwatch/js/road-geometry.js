/* Road polyline geometry from route descriptions */
const RoadGeometry = (() => {
  const CITY = {
    Delhi: [28.6139, 77.209], Mumbai: [19.076, 72.8777], Pune: [18.5204, 73.8567],
    Bengaluru: [12.9716, 77.5946], Bangalore: [12.9716, 77.5946], Chennai: [13.0827, 80.2707],
    Hyderabad: [17.385, 78.4867], Kolkata: [22.5726, 88.3639], Ahmedabad: [23.0225, 72.5714],
    Jaipur: [26.9124, 75.7873], Lucknow: [26.8467, 80.9462], Patna: [25.5941, 85.1376],
    Srinagar: [34.0837, 74.7973], Leh: [34.1526, 77.577], Amritsar: [31.634, 74.8723],
    Chandigarh: [30.7333, 76.7794], Guwahati: [26.1445, 91.7362], Bhopal: [23.2599, 77.4126],
    Nagpur: [21.1458, 79.0882], Kochi: [9.9312, 76.2673], Varanasi: [25.3176, 82.9739],
    Agra: [27.1767, 78.0081], Indore: [22.7196, 75.8577], Surat: [21.1702, 72.8311],
    Visakhapatnam: [17.6868, 83.2185], Ranchi: [23.3441, 85.3096], Shimla: [31.1048, 77.1734],
    Dehradun: [30.3165, 78.0322], Gangtok: [27.3389, 88.6065], Imphal: [24.817, 93.9368],
    Agartala: [23.8315, 91.2868], Shillong: [25.5788, 91.8933], Aizawl: [23.7271, 92.7176],
    Kohima: [25.6747, 94.1109], 'Port Blair': [11.6234, 92.7265], Kanyakumari: [8.0883, 77.5385],
    Madurai: [9.9252, 78.1198], Ludhiana: [30.901, 75.8573], Jodhpur: [26.2389, 73.0243],
    Raipur: [21.2514, 81.6296], Bhubaneswar: [20.2961, 85.8245], Coimbatore: [11.0168, 76.9558],
    Mangalore: [12.9141, 74.8560], Mysore: [12.2958, 76.6394], Nashik: [19.9975, 73.7898],
    Aurangabad: [19.8762, 75.3433], Kanpur: [26.4499, 80.3319], Prayagraj: [25.4358, 81.8463],
    Meerut: [28.9845, 77.7064], Jalandhar: [31.3260, 75.5762], Amritsar: [31.6340, 74.8723],
    Siliguri: [26.7271, 88.3953], Darjeeling: [27.0410, 88.2663], Guwahati: [26.1445, 91.7362],
    Ranchi: [23.3441, 85.3096], Jammu: [32.7266, 74.8570], Manali: [32.2396, 77.1887],
    Kullu: [31.9579, 77.1095], Mandi: [31.7084, 76.9316], Rishikesh: [30.0869, 78.2676],
    Haridwar: [29.9457, 78.1642], Noida: [28.5355, 77.3910], Gurugram: [28.4595, 77.0266],
    Faridabad: [28.4089, 77.3178], Gwalior: [26.2183, 78.1828], Udaipur: [24.5854, 73.7125],
    Ajmer: [26.4499, 74.6399], Bikaner: [28.0229, 73.3119], Jaisalmer: [26.9157, 70.9083],
    Thiruvananthapuram: [8.5241, 76.9366], Thrissur: [10.5276, 76.2144], Kozhikode: [11.2588, 75.7804],
    Salem: [11.6643, 78.1460], Vijayawada: [16.5062, 80.6480], Warangal: [17.9689, 79.5941],
    Cuttack: [20.4625, 85.8830], Puri: [19.8135, 85.8312], Dibrugarh: [27.4728, 94.9120],
    Imphal: [24.8170, 93.9368], Kohima: [25.6747, 94.1109], Itanagar: [27.0844, 93.6053],
    Dispur: [26.1433, 91.7898], Panaji: [15.2993, 74.1240],
  };

  const INDIA = { latMin: 6.5, latMax: 37.1, lngMin: 68.0, lngMax: 97.5 };

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function clampIndia(lat, lng) {
    return [
      Math.max(INDIA.latMin, Math.min(INDIA.latMax, lat)),
      Math.max(INDIA.lngMin, Math.min(INDIA.lngMax, lng)),
    ];
  }

  function citiesFromText(text) {
    if (!text) return [];
    const found = [];
    const plain = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    const names = Object.keys(CITY).sort((a, b) => b.length - a.length);
    const lower = plain.toLowerCase();
    const used = new Set();
    for (const name of names) {
      if (lower.includes(name.toLowerCase()) && !used.has(name)) {
        used.add(name);
        found.push({ name, coord: CITY[name] });
      }
    }
    return found;
  }

  function segmentThroughPoint(lat, lng, lengthKm, seed) {
    const h = hash(String(seed));
    const angle = (h % 360) * (Math.PI / 180);
    const degLen = Math.min(lengthKm || 40, 180) / 111;
    const half = degLen / 2;
    return [
      [lat - half * Math.cos(angle), lng - half * Math.sin(angle)],
      [lat + half * Math.cos(angle), lng + half * Math.sin(angle)],
    ];
  }

  function getPolyline(road) {
    if (road.polyline && road.polyline.length >= 2) return road.polyline;

    const text = [road.description, road.road_name].filter(Boolean).join(' ');
    const cities = citiesFromText(text);

    if (cities.length >= 2) {
      return cities.map(c => c.coord);
    }

    if (cities.length === 1) {
      const [lat, lng] = cities[0].coord;
      return segmentThroughPoint(lat, lng, road.road_length_km, road.road_id);
    }

    const lat = road.location?.lat ?? 20.59;
    const lng = road.location?.lng ?? 78.96;
    const seg = segmentThroughPoint(lat, lng, road.road_length_km, road.road_id);
    if (road.country === 'india' || !road.country) {
      return seg.map(([la, ln]) => clampIndia(la, ln));
    }
    return seg;
  }

  return { getPolyline, citiesFromText };
})();
