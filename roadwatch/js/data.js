const ROADS = {
  india: [
    {
      road_id: "NH-44-DL-001", road_name: "Grand Trunk Road (NH-44)", road_type: "NH",
      location: { lat: 28.7041, lng: 77.1025 }, city: "Delhi", state: "Delhi",
      last_relay_date: "2023-02-15", contractor_name: "L&T Construction Ltd.",
      amount_sanctioned: 125000000, amount_spent: 98000000,
      budget_source: "Central Road Fund (60%) + State Budget (40%)",
      responsible_officer: "Executive Engineer A.K. Sharma", officer_contact: "+91-11-23456789",
      officer_email: "ee.nh44@nhai.gov.in", department: "NHAI", pothole_reports: 3,
      road_length_km: 45, lanes: 6, description: "Major NH connecting Delhi to Amritsar"
    },
    {
      road_id: "NH-48-MH-002", road_name: "Mumbai-Pune Expressway (NH-48)", road_type: "NH",
      location: { lat: 18.9667, lng: 73.8278 }, city: "Mumbai", state: "Maharashtra",
      last_relay_date: "2024-01-10", contractor_name: "IRB Infrastructure Developers",
      amount_sanctioned: 320000000, amount_spent: 315000000,
      budget_source: "NHAI Toll Fund (80%) + Maharashtra State (20%)",
      responsible_officer: "Project Director R.V. Desai", officer_contact: "+91-22-26574800",
      officer_email: "pd.nh48@nhai.gov.in", department: "NHAI", pothole_reports: 1,
      road_length_km: 95, lanes: 6, description: "Premium expressway connecting Mumbai & Pune"
    },
    {
      road_id: "NH-19-UP-003", road_name: "Eastern Peripheral Expressway (NH-19)", road_type: "NH",
      location: { lat: 28.5355, lng: 77.3910 }, city: "Noida", state: "Uttar Pradesh",
      last_relay_date: "2022-08-20", contractor_name: "Dilip Buildcon Ltd.",
      amount_sanctioned: 175000000, amount_spent: 142000000,
      budget_source: "Central Road Fund (70%) + UP State Budget (30%)",
      responsible_officer: "Executive Engineer P.K. Singh", officer_contact: "+91-120-2500112",
      officer_email: "ee.nh19@nhai.gov.in", department: "NHAI", pothole_reports: 7,
      road_length_km: 135, lanes: 6, description: "Ring road reducing Delhi traffic congestion"
    },
    {
      road_id: "ORR-KA-004", road_name: "Outer Ring Road (ORR)", road_type: "City",
      location: { lat: 12.9716, lng: 77.5946 }, city: "Bengaluru", state: "Karnataka",
      last_relay_date: "2022-11-30", contractor_name: "MEIL Group",
      amount_sanctioned: 89000000, amount_spent: 76000000,
      budget_source: "BBMP Urban Fund (50%) + State PWD (50%)",
      responsible_officer: "Chief Engineer S. Krishnamurthy", officer_contact: "+91-80-22222222",
      officer_email: "ce.orr@bbmp.gov.in", department: "BBMP", pothole_reports: 12,
      road_length_km: 62, lanes: 8, description: "Circular road around Bengaluru city"
    },
    {
      road_id: "NH-16-TS-005", road_name: "Hyderabad-Vijayawada Highway (NH-16)", road_type: "NH",
      location: { lat: 17.3850, lng: 78.4867 }, city: "Hyderabad", state: "Telangana",
      last_relay_date: "2023-06-15", contractor_name: "Gayatri Projects Ltd.",
      amount_sanctioned: 210000000, amount_spent: 188000000,
      budget_source: "Central Road Fund (65%) + Telangana State (35%)",
      responsible_officer: "Project Manager K. Reddy", officer_contact: "+91-40-23457890",
      officer_email: "pm.nh16@nhai.gov.in", department: "NHAI", pothole_reports: 4,
      road_length_km: 275, lanes: 4, description: "Major artery connecting Hyderabad to coast"
    },
    {
      road_id: "NH-48-RJ-006", road_name: "Delhi-Jaipur Highway (NH-48)", road_type: "NH",
      location: { lat: 26.9124, lng: 75.7873 }, city: "Jaipur", state: "Rajasthan",
      last_relay_date: "2021-04-20", contractor_name: "Ashoka Buildcon Ltd.",
      amount_sanctioned: 145000000, amount_spent: 101500000,
      budget_source: "Central Road Fund (75%) + Rajasthan PWD (25%)",
      responsible_officer: "Executive Engineer M.L. Meena", officer_contact: "+91-141-2227801",
      officer_email: "ee.nh48jpr@nhai.gov.in", department: "NHAI", pothole_reports: 9,
      road_length_km: 265, lanes: 4, description: "Connects capital to Pink City"
    },
    {
      road_id: "SH-17-MH-007", road_name: "Pune-Nashik State Highway (SH-17)", road_type: "SH",
      location: { lat: 19.9975, lng: 73.7898 }, city: "Nashik", state: "Maharashtra",
      last_relay_date: "2021-09-10", contractor_name: "Maharashtra PWD Contractors",
      amount_sanctioned: 67000000, amount_spent: 52000000,
      budget_source: "Maharashtra State Budget (100%)",
      responsible_officer: "Divisional Engineer B.S. Patil", officer_contact: "+91-253-2310100",
      officer_email: "de.sh17@mahastate.gov.in", department: "Maharashtra PWD", pothole_reports: 15,
      road_length_km: 212, lanes: 2, description: "Wine country highway through Western Ghats"
    },
    {
      road_id: "MDR-12-HR-008", road_name: "Gurgaon-Faridabad Road (MDR-12)", road_type: "MDR",
      location: { lat: 28.4595, lng: 77.0266 }, city: "Gurugram", state: "Haryana",
      last_relay_date: "2020-07-15", contractor_name: "Haryana State Road Corp.",
      amount_sanctioned: 43000000, amount_spent: 38000000,
      budget_source: "Haryana State Budget (60%) + HRERA Funds (40%)",
      responsible_officer: "Executive Engineer R. Hooda", officer_contact: "+91-124-2322221",
      officer_email: "ee.mdr12@haryanapwd.gov.in", department: "Haryana PWD", pothole_reports: 22,
      road_length_km: 32, lanes: 4, description: "Industrial corridor linking two NCR cities"
    },
    {
      road_id: "MG-KA-009", road_name: "MG Road", road_type: "City",
      location: { lat: 12.9754, lng: 77.6069 }, city: "Bengaluru", state: "Karnataka",
      last_relay_date: "2024-03-01", contractor_name: "BBMP Roads Division",
      amount_sanctioned: 28000000, amount_spent: 25500000,
      budget_source: "BBMP Urban Development Fund (100%)",
      responsible_officer: "Assistant Executive Engineer V. Kumar", officer_contact: "+91-80-22660000",
      officer_email: "aee.mgrd@bbmp.gov.in", department: "BBMP", pothole_reports: 2,
      road_length_km: 4, lanes: 6, description: "Premium commercial street in Bengaluru CBD"
    },
    {
      road_id: "NH-31-AS-010", road_name: "Guwahati Bypass (NH-31)", road_type: "NH",
      location: { lat: 26.1445, lng: 91.7362 }, city: "Guwahati", state: "Assam",
      last_relay_date: "2022-03-20", contractor_name: "Assam PWD & NHIDCL",
      amount_sanctioned: 98000000, amount_spent: 71000000,
      budget_source: "North East Special Package (80%) + State (20%)",
      responsible_officer: "Project Director H. Bora", officer_contact: "+91-361-2540120",
      officer_email: "pd.nh31@nhidcl.gov.in", department: "NHIDCL", pothole_reports: 18,
      road_length_km: 56, lanes: 4, description: "Gateway highway to Northeast India"
    },
    {
      road_id: "NH-66-KL-011", road_name: "Thiruvananthapuram-Mangalore (NH-66)", road_type: "NH",
      location: { lat: 10.8505, lng: 76.2711 }, city: "Thrissur", state: "Kerala",
      last_relay_date: "2023-11-05", contractor_name: "KSTP & Welspun Enterprises",
      amount_sanctioned: 185000000, amount_spent: 170000000,
      budget_source: "Central Road Fund (60%) + Kerala KIIFB (40%)",
      responsible_officer: "Chief Engineer T.K. Nair", officer_contact: "+91-480-2423455",
      officer_email: "ce.nh66@nhai.gov.in", department: "NHAI", pothole_reports: 3,
      road_length_km: 634, lanes: 4, description: "Coastal highway through God's Own Country"
    },
    {
      road_id: "SH-5-GJ-012", road_name: "Ahmedabad-Vadodara Expressway (SH-5)", road_type: "SH",
      location: { lat: 22.3072, lng: 73.1812 }, city: "Vadodara", state: "Gujarat",
      last_relay_date: "2024-02-14", contractor_name: "Gujarat State Road Dev. Corp.",
      amount_sanctioned: 112000000, amount_spent: 108000000,
      budget_source: "Gujarat State Fund (70%) + Toll Revenue (30%)",
      responsible_officer: "Chief Manager A. Patel", officer_contact: "+91-265-2320567",
      officer_email: "cm.sh5@gsrdc.gov.in", department: "GSRDC", pothole_reports: 1,
      road_length_km: 98, lanes: 6, description: "Smooth expressway in India's fastest growing state"
    },
    {
      road_id: "NH-27-RJ-013", road_name: "Jodhpur-Bikaner Highway (NH-27)", road_type: "NH",
      location: { lat: 27.0238, lng: 74.2179 }, city: "Jodhpur", state: "Rajasthan",
      last_relay_date: "2020-05-12", contractor_name: "KCC Buildcon Pvt. Ltd.",
      amount_sanctioned: 92000000, amount_spent: 64000000,
      budget_source: "Central Road Fund (80%) + Rajasthan PWD (20%)",
      responsible_officer: "Executive Engineer S.K. Rathore", officer_contact: "+91-291-2432100",
      officer_email: "ee.nh27@nhai.gov.in", department: "NHAI", pothole_reports: 25,
      road_length_km: 245, lanes: 2, description: "Desert highway through Rajasthan"
    },
    {
      road_id: "ANNA-TN-014", road_name: "Anna Salai (Mount Road)", road_type: "City",
      location: { lat: 13.0604, lng: 80.2496 }, city: "Chennai", state: "Tamil Nadu",
      last_relay_date: "2023-08-20", contractor_name: "TNRDC & Chennai Corp.",
      amount_sanctioned: 35000000, amount_spent: 31000000,
      budget_source: "GCC Urban Fund (60%) + TNRDC (40%)",
      responsible_officer: "Executive Engineer D. Murugan", officer_contact: "+91-44-25361021",
      officer_email: "ee.annasal@chennaicorp.gov.in", department: "Greater Chennai Corp.", pothole_reports: 6,
      road_length_km: 15, lanes: 6, description: "Iconic arterial road through Chennai's heart"
    },
    {
      road_id: "NH-53-MH-015", road_name: "Nagpur-Raipur Highway (NH-53)", road_type: "NH",
      location: { lat: 21.1458, lng: 79.0882 }, city: "Nagpur", state: "Maharashtra",
      last_relay_date: "2021-12-01", contractor_name: "Sadbhav Engineering Ltd.",
      amount_sanctioned: 160000000, amount_spent: 124000000,
      budget_source: "Central Road Fund (70%) + State Budget (30%)",
      responsible_officer: "Project Director A.N. Bhatt", officer_contact: "+91-712-2564100",
      officer_email: "pd.nh53@nhai.gov.in", department: "NHAI", pothole_reports: 11,
      road_length_km: 310, lanes: 4, description: "Cross-country highway through Central India"
    },
    {
      road_id: "SH-14-HR-016", road_name: "Chandigarh-Ambala Road (SH-14)", road_type: "SH",
      location: { lat: 30.7333, lng: 76.7794 }, city: "Chandigarh", state: "Haryana",
      last_relay_date: "2023-04-15", contractor_name: "Haryana Roads & Bridges Dev.",
      amount_sanctioned: 55000000, amount_spent: 49500000,
      budget_source: "Haryana State Budget (100%)",
      responsible_officer: "SE N. Joshi", officer_contact: "+91-172-2701234",
      officer_email: "se.sh14@haryanapwd.gov.in", department: "Haryana PWD", pothole_reports: 5,
      road_length_km: 47, lanes: 4, description: "Connects planned city Chandigarh to Ambala"
    },
    {
      road_id: "NH-58-UK-017", road_name: "Delhi-Rishikesh Highway (NH-58)", road_type: "NH",
      location: { lat: 29.9457, lng: 78.1642 }, city: "Rishikesh", state: "Uttarakhand",
      last_relay_date: "2022-07-10", contractor_name: "Hindustan Construction Co.",
      amount_sanctioned: 78000000, amount_spent: 59000000,
      budget_source: "Central Road Fund (75%) + Uttarakhand State (25%)",
      responsible_officer: "Chief Engineer R. Bisht", officer_contact: "+91-135-2430200",
      officer_email: "ce.nh58@nhai.gov.in", department: "NHAI", pothole_reports: 14,
      road_length_km: 250, lanes: 4, description: "Himalayan highway for Char Dham pilgrims"
    },
    {
      road_id: "LINK-MH-018", road_name: "Linking Road, Bandra", road_type: "City",
      location: { lat: 19.0607, lng: 72.8362 }, city: "Mumbai", state: "Maharashtra",
      last_relay_date: "2024-01-05", contractor_name: "BMC Roads Department",
      amount_sanctioned: 22000000, amount_spent: 21000000,
      budget_source: "BMC Budget (100%)",
      responsible_officer: "AE P. Sawant", officer_contact: "+91-22-24127500",
      officer_email: "ae.linking@mcgm.gov.in", department: "MCGM (BMC)", pothole_reports: 8,
      road_length_km: 3, lanes: 4, description: "Prime shopping road in Bandra West"
    },
    {
      road_id: "NH-30-BR-019", road_name: "Patna-Ranchi Highway (NH-30)", road_type: "NH",
      location: { lat: 25.5941, lng: 85.1376 }, city: "Patna", state: "Bihar",
      last_relay_date: "2020-02-28", contractor_name: "Bihar State Road Dev. Corp.",
      amount_sanctioned: 88000000, amount_spent: 55000000,
      budget_source: "Central Road Fund (80%) + Bihar State (20%)",
      responsible_officer: "Executive Engineer M.K. Jha", officer_contact: "+91-612-2215678",
      officer_email: "ee.nh30@bsrdc.gov.in", department: "BSRDC", pothole_reports: 31,
      road_length_km: 420, lanes: 2, description: "Lifeline connecting Bihar to Jharkhand"
    },
    {
      road_id: "MDR-8-UP-020", road_name: "Noida Expressway (MDR-8)", road_type: "MDR",
      location: { lat: 28.5700, lng: 77.3219 }, city: "Noida", state: "Uttar Pradesh",
      last_relay_date: "2023-09-30", contractor_name: "Noida Authority Roads Div.",
      amount_sanctioned: 48000000, amount_spent: 43000000,
      budget_source: "Noida Authority Fund (60%) + UP State (40%)",
      responsible_officer: "Chief Engineer V.K. Gupta", officer_contact: "+91-120-2421600",
      officer_email: "ce.mdr8@noidaauthority.in", department: "Noida Authority", pothole_reports: 4,
      road_length_km: 24, lanes: 6, description: "Modern expressway through Noida tech hub"
    }
  ],
  kenya: [
    {
      road_id: "A104-NBI-001", road_name: "Nairobi-Mombasa Highway (A-104)", road_type: "NH",
      location: { lat: -1.2921, lng: 36.8219 }, city: "Nairobi", state: "Nairobi County",
      last_relay_date: "2022-06-20", contractor_name: "China Road & Bridge Corp.",
      amount_sanctioned: 8500000000, amount_spent: 7100000000,
      budget_source: "KeNHA Budget (60%) + Chinese Loan (40%)",
      responsible_officer: "Regional Manager J. Mwangi", officer_contact: "+254-20-3988000",
      officer_email: "rm.a104@kenha.go.ke", department: "KeNHA", pothole_reports: 8,
      road_length_km: 480, lanes: 4, description: "Kenya's key trade corridor to the coast",
      currency: "KES"
    },
    {
      road_id: "B8-NBI-002", road_name: "Thika Superhighway (B-8)", road_type: "NH",
      location: { lat: -1.0296, lng: 37.0747 }, city: "Thika", state: "Kiambu County",
      last_relay_date: "2021-11-15", contractor_name: "China Wu Yi Co. Ltd.",
      amount_sanctioned: 3200000000, amount_spent: 2900000000,
      budget_source: "KeNHA (55%) + World Bank Grant (45%)",
      responsible_officer: "Engineer P. Kariuki", officer_contact: "+254-67-22501",
      officer_email: "eng.b8@kenha.go.ke", department: "KeNHA", pothole_reports: 5,
      road_length_km: 50, lanes: 8, description: "8-lane superhighway north of Nairobi",
      currency: "KES"
    },
    {
      road_id: "A2-NKR-003", road_name: "Nairobi-Nakuru Highway (A-2)", road_type: "NH",
      location: { lat: -0.3031, lng: 36.0800 }, city: "Nakuru", state: "Nakuru County",
      last_relay_date: "2020-08-10", contractor_name: "H.Young & Co. (EA) Ltd.",
      amount_sanctioned: 5600000000, amount_spent: 4200000000,
      budget_source: "KeNHA Budget (70%) + AfDB Loan (30%)",
      responsible_officer: "Senior Engineer R. Ochieng", officer_contact: "+254-51-2212345",
      officer_email: "se.a2@kenha.go.ke", department: "KeNHA", pothole_reports: 15,
      road_length_km: 156, lanes: 4, description: "Rift Valley scenic highway",
      currency: "KES"
    },
    {
      road_id: "KSM-BP-004", road_name: "Kisumu Bypass Road", road_type: "City",
      location: { lat: -0.0917, lng: 34.7680 }, city: "Kisumu", state: "Kisumu County",
      last_relay_date: "2023-03-22", contractor_name: "Rea Vipingo Estates Roads",
      amount_sanctioned: 1800000000, amount_spent: 1650000000,
      budget_source: "Kisumu County (50%) + Kenya Urban Support (50%)",
      responsible_officer: "County Engineer A. Otieno", officer_contact: "+254-57-2021234",
      officer_email: "ce.bypass@kisumu.go.ke", department: "Kisumu County", pothole_reports: 3,
      road_length_km: 22, lanes: 4, description: "City bypass reducing CBD congestion",
      currency: "KES"
    },
    {
      road_id: "KNYTTA-NBI-005", road_name: "Kenyatta Avenue", road_type: "City",
      location: { lat: -1.2870, lng: 36.8250 }, city: "Nairobi", state: "Nairobi County",
      last_relay_date: "2024-01-08", contractor_name: "Nairobi City County Roads",
      amount_sanctioned: 900000000, amount_spent: 870000000,
      budget_source: "Nairobi City County (100%)",
      responsible_officer: "Director Roads M. Mutua", officer_contact: "+254-20-2221080",
      officer_email: "roads@nairobicity.go.ke", department: "Nairobi City County", pothole_reports: 2,
      road_length_km: 3, lanes: 6, description: "Nairobi's premier CBD boulevard",
      currency: "KES"
    }
  ],
  usa: [
    {
      road_id: "I95-NJ-001", road_name: "Interstate 95 (NJ Section)", road_type: "NH",
      location: { lat: 40.7178, lng: -74.0431 }, city: "Newark", state: "New Jersey",
      last_relay_date: "2022-10-15", contractor_name: "Middlesex Paving LLC",
      amount_sanctioned: 45000000, amount_spent: 42000000,
      budget_source: "Federal Highway Fund (80%) + NJ DOT (20%)",
      responsible_officer: "District Engineer T. Williams", officer_contact: "+1-973-222-3333",
      officer_email: "de.i95@njdot.gov", department: "NJ DOT", pothole_reports: 12,
      road_length_km: 48, lanes: 8, description: "Busiest interstate on the East Coast",
      currency: "USD"
    },
    {
      road_id: "I405-CA-002", road_name: "Interstate 405 (San Diego Freeway)", road_type: "NH",
      location: { lat: 34.0195, lng: -118.4912 }, city: "Los Angeles", state: "California",
      last_relay_date: "2023-05-20", contractor_name: "Caltrans Contractors JV",
      amount_sanctioned: 78000000, amount_spent: 71000000,
      budget_source: "Federal Highway Fund (70%) + CA State (30%)",
      responsible_officer: "District Director A. Garcia", officer_contact: "+1-213-897-3656",
      officer_email: "dd.i405@dot.ca.gov", department: "Caltrans", pothole_reports: 6,
      road_length_km: 72, lanes: 10, description: "World's busiest freeway through LA",
      currency: "USD"
    },
    {
      road_id: "US101-CA-003", road_name: "US-101 (Bayshore Freeway)", road_type: "NH",
      location: { lat: 37.7749, lng: -122.4194 }, city: "San Francisco", state: "California",
      last_relay_date: "2021-07-14", contractor_name: "Granite Construction Inc.",
      amount_sanctioned: 62000000, amount_spent: 47000000,
      budget_source: "Federal (75%) + CA DOT (25%)",
      responsible_officer: "Senior Engineer L. Chen", officer_contact: "+1-415-330-6000",
      officer_email: "se.us101@dot.ca.gov", department: "Caltrans", pothole_reports: 19,
      road_length_km: 55, lanes: 6, description: "Historic Pacific Coast highway",
      currency: "USD"
    },
    {
      road_id: "BRDWY-NY-004", road_name: "Broadway (Manhattan)", road_type: "City",
      location: { lat: 40.7549, lng: -73.9840 }, city: "New York City", state: "New York",
      last_relay_date: "2023-12-01", contractor_name: "NYC DOT Operations",
      amount_sanctioned: 18000000, amount_spent: 17500000,
      budget_source: "NYC Capital Budget (100%)",
      responsible_officer: "Borough Commissioner K. Johnson", officer_contact: "+1-212-639-9675",
      officer_email: "bc.manh@nycdot.gov", department: "NYC DOT", pothole_reports: 24,
      road_length_km: 8, lanes: 6, description: "The Great White Way through Midtown Manhattan",
      currency: "USD"
    },
    {
      road_id: "US1-MA-005", road_name: "US-1 (Boston Post Road)", road_type: "NH",
      location: { lat: 42.3601, lng: -71.0589 }, city: "Boston", state: "Massachusetts",
      last_relay_date: "2022-04-30", contractor_name: "MassDOT Highway Division",
      amount_sanctioned: 34000000, amount_spent: 28000000,
      budget_source: "Federal Highway (65%) + MassDOT (35%)",
      responsible_officer: "District Highway Director B. Sullivan", officer_contact: "+1-617-973-7800",
      officer_email: "dhd.us1@massdot.state.ma.us", department: "MassDOT", pothole_reports: 16,
      road_length_km: 35, lanes: 4, description: "Historic colonial-era road through Boston",
      currency: "USD"
    }
  ]
};

const DEPARTMENT_ROUTING = {
  NH: { india: { name: "National Highways Authority of India (NHAI)", email: "grievances@nhai.gov.in", phone: "1800-11-7788", url: "https://nhai.gov.in" } },
  SH: { india: { name: "State Public Works Department (PWD)", email: "pwd@nic.in", phone: "1800-180-5254" } },
  MDR: { india: { name: "State Public Works Department (PWD)", email: "pwd@nic.in", phone: "1800-180-5254" } },
  City: { india: { name: "Municipal Corporation", email: "mc@city.gov.in", phone: "1533" } }
};
