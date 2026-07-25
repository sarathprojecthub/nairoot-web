// ─────────────────────────────────────────────────────────────────────────────
// Historical / common alternate names for districts in INDIA_DISTRICTS_BY_STATE.
//
// These exist ONLY to widen search matching in the city/district combobox
// (e.g. typing "Trivandrum" should surface "Thiruvananthapuram"). They are
// never used as canonical labels/values — the official LGD district name
// stays the value users actually select and the value stored on the profile.
//
// Keyed by [state][canonical LGD district name] -> alternate names.
// Not exhaustive by design — covers well-known renamed/anglicized names.
// ─────────────────────────────────────────────────────────────────────────────

export const DISTRICT_ALIASES: Record<string, Record<string, string[]>> = {
  Kerala: {
    Thiruvananthapuram: ['Trivandrum'],
    Ernakulam: ['Kochi', 'Cochin'],
    Kozhikode: ['Calicut'],
    Alappuzha: ['Alleppey'],
    Kollam: ['Quilon'],
    Kannur: ['Cannanore'],
  },
  Karnataka: {
    'Bengaluru Urban': ['Bangalore', 'Bengaluru'],
    Mysuru: ['Mysore'],
    'Dakshina Kannada': ['Mangaluru', 'Mangalore'],
    Belagavi: ['Belgaum'],
    Kalaburagi: ['Gulbarga'],
    Ballari: ['Bellary'],
    Vijayapura: ['Bijapur'],
    Tumakuru: ['Tumkur'],
    Chikkamagaluru: ['Chikmagalur'],
    Shivamogga: ['Shimoga'],
  },
  'Tamil Nadu': {
    Thoothukkudi: ['Tuticorin'],
    Tiruchirappalli: ['Trichy'],
    Kanniyakumari: ['Kanyakumari'],
    Thanjavur: ['Tanjore'],
    Viluppuram: ['Villupuram'],
  },
  'West Bengal': {
    Kolkata: ['Calcutta'],
    Hooghly: ['Hugli'],
  },
  Maharashtra: {
    Mumbai: ['Bombay'],
    'Mumbai Suburban': ['Bombay Suburban'],
    Pune: ['Poona'],
    'Chhatrapati Sambhajinagar': ['Aurangabad'],
    Dharashiv: ['Osmanabad'],
    Ahilyanagar: ['Ahmednagar'],
  },
  Odisha: {
    Baleshwar: ['Balasore'],
    Kataka: ['Cuttack'],
    Kendujhar: ['Keonjhar'],
    Sundaragada: ['Sundargarh'],
    Debagada: ['Deogarh'],
    Anugola: ['Angul'],
    Nayagada: ['Nayagarh'],
    Baragada: ['Bargarh'],
    Kandhamala: ['Kandhamal'],
  },
  Assam: {
    Sribhumi: ['Karimganj'],
  },
  'Andhra Pradesh': {
    'Y.S.R. Kadapa': ['Kadapa', 'Cuddapah'],
    'Sri Potti Sriramulu Nellore': ['Nellore'],
    Ananthapuramu: ['Anantapur'],
  },
  Telangana: {
    Hyderabad: ['Secunderabad'],
  },
  'Uttar Pradesh': {
    Prayagraj: ['Allahabad'],
    Ayodhya: ['Faizabad'],
    'Kanpur Nagar': ['Kanpur'],
    Kheri: ['Lakhimpur Kheri'],
    'Bara Banki': ['Barabanki'],
    Bhadohi: ['Sant Ravidas Nagar'],
  },
  Punjab: {
    'Sri Muktsar Sahib': ['Muktsar'],
    'S.A.S Nagar': ['Mohali'],
    'Shahid Bhagat Singh Nagar': ['Nawanshahr'],
  },
};
