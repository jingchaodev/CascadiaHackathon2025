import { NextRequest, NextResponse } from 'next/server';

type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  address: string;
  latitude: number;
  longitude: number;
  estimatedDeliveryMinutes: number;
  rating: number;
  priceLevel: '$' | '$$' | '$$$';
  highlightItems: string[];
};

const DEFAULT_LATITUDE = 47.62762;
const DEFAULT_LONGITUDE = -122.33855;

const RESTAURANTS: Restaurant[] = [
  {
    id: 'rest_emerald_thai',
    name: 'Emerald City Thai',
    cuisine: 'Thai',
    address: '1501 4th Ave, Seattle, WA',
    latitude: 47.6105,
    longitude: -122.337,
    estimatedDeliveryMinutes: 28,
    rating: 4.6,
    priceLevel: '$$',
    highlightItems: ['Pad Kee Mao', 'Panang Curry'],
  },
  {
    id: 'rest_capitol_sushi',
    name: 'Capitol Hill Sushi',
    cuisine: 'Japanese',
    address: '1213 Pine St, Seattle, WA',
    latitude: 47.6139,
    longitude: -122.3226,
    estimatedDeliveryMinutes: 24,
    rating: 4.8,
    priceLevel: '$$',
    highlightItems: ['Spicy Tuna Roll', 'Chirashi Bowl'],
  },
  {
    id: 'rest_ballard_taco',
    name: 'Ballard Taqueria',
    cuisine: 'Mexican',
    address: '5411 Ballard Ave NW, Seattle, WA',
    latitude: 47.6673,
    longitude: -122.3835,
    estimatedDeliveryMinutes: 27,
    rating: 4.5,
    priceLevel: '$',
    highlightItems: ['Al Pastor Tacos', 'Quesabirria'],
  },
  {
    id: 'rest_green_lake_bowl',
    name: 'Green Lake Bowls',
    cuisine: 'Healthy',
    address: '7100 Woodlawn Ave NE, Seattle, WA',
    latitude: 47.6804,
    longitude: -122.3256,
    estimatedDeliveryMinutes: 22,
    rating: 4.4,
    priceLevel: '$$',
    highlightItems: ['Harvest Grain Bowl', 'Citrus Quinoa Bowl'],
  },
  {
    id: 'rest_pioneer_slice',
    name: 'Pioneer Square Pizza',
    cuisine: 'Pizza',
    address: '205 1st Ave S, Seattle, WA',
    latitude: 47.6009,
    longitude: -122.3344,
    estimatedDeliveryMinutes: 26,
    rating: 4.2,
    priceLevel: '$$',
    highlightItems: ['Margherita', 'Truffle Mushroom Pie'],
  },
  {
    id: 'rest_sound_brew',
    name: 'Sound Brew Café',
    cuisine: 'Cafe',
    address: '720 Olive Way, Seattle, WA',
    latitude: 47.6133,
    longitude: -122.3348,
    estimatedDeliveryMinutes: 17,
    rating: 4.7,
    priceLevel: '$',
    highlightItems: ['Avocado Toast', 'Cold Brew Flight'],
  },
];

const EARTH_RADIUS_MILES = 3958.8;

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) *
      Math.cos(degToRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get('latitude');
  const lonParam = searchParams.get('longitude');
  const radiusParam = searchParams.get('radiusMiles');
  const cuisineParam = searchParams.get('cuisine');
  const limitParam = searchParams.get('limit');

  const radiusMiles = radiusParam ? Number.parseFloat(radiusParam) : 3;
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 5;

  if (Number.isNaN(limit) || limit <= 0) {
    return NextResponse.json(
      { error: 'limit must be a positive integer' },
      { status: 400 },
    );
  }

  let latitude = DEFAULT_LATITUDE;
  let longitude = DEFAULT_LONGITUDE;

  if (latParam || lonParam) {
    if (!latParam || !lonParam) {
      return NextResponse.json(
        { error: 'latitude and longitude must be provided together' },
        { status: 400 },
      );
    }

    const lat = Number.parseFloat(latParam);
    const lon = Number.parseFloat(lonParam);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json(
        { error: 'latitude and longitude must be valid numbers' },
        { status: 400 },
      );
    }
    latitude = lat;
    longitude = lon;
  }

  const filtered = RESTAURANTS.filter((restaurant) => {
    const distance = calculateDistanceMiles(
      latitude,
      longitude,
      restaurant.latitude,
      restaurant.longitude,
    );
    if (distance > radiusMiles) {
      return false;
    }
    if (cuisineParam) {
      return (
        restaurant.cuisine.toLowerCase() === cuisineParam.toLowerCase() ||
        restaurant.cuisine.toLowerCase().includes(cuisineParam.toLowerCase())
      );
    }
    return true;
  })
    .sort((a, b) => a.estimatedDeliveryMinutes - b.estimatedDeliveryMinutes)
    .slice(0, limit)
    .map((restaurant) => ({
      ...restaurant,
      distanceMiles: Number(
        calculateDistanceMiles(
          latitude,
          longitude,
          restaurant.latitude,
          restaurant.longitude,
        ).toFixed(2),
      ),
    }));

  return NextResponse.json({ restaurants: filtered });
}
