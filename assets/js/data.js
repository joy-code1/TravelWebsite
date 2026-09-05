/* ==========================================================================
   Travosca — shared content
   One place for everything that repeats across pages (destinations,
   testimonials, partners, articles).  Edit here and every page updates.
   The asset base path is derived from this file's own URL, so pages can live
   in any folder without breaking image paths.
   ========================================================================== */
(function () {
  'use strict';

  var script = document.currentScript || document.querySelector('script[src$="data.js"]');
  var src = script ? script.getAttribute('src') : '../assets/js/data.js';
  var base = src.replace(/assets\/js\/data\.js.*$/, '') || '../';

  var img = function (name) { return base + 'assets/img/' + name; };

  var destinations = [
    {
      id: 'bali',
      title: 'Bali',
      country: 'Indonesia',
      region: 'Asia',
      price: 249,
      days: 4,
      rating: 4.9,
      reviews: 128,
      photo: 'dest-bali.jpg',
      photoSm: 'dest-bali-sm.jpg',
      tag: 'Beach & culture',
      excerpt: 'Terraced rice fields, temple mornings and a coastline that keeps surprising you.',
      highlights: ['Ubud rice terraces', 'Sunset at Tanah Lot', 'Nusa Penida day trip', 'Boutique stay with a pool']
    },
    {
      id: 'paris',
      title: 'Paris',
      country: 'France',
      region: 'Europe',
      price: 299,
      days: 3,
      rating: 4.8,
      reviews: 214,
      photo: 'dest-paris.jpg',
      photoSm: 'dest-paris-sm.jpg',
      tag: 'City break',
      excerpt: 'Boulevard cafés, the Eiffel Tower at blue hour and the slow art of doing nothing.',
      highlights: ['Eiffel Tower & Trocadéro', 'Montmartre walking tour', 'Seine river cruise', 'Louvre skip-the-line']
    },
    {
      id: 'swiss',
      title: 'Swiss Alps',
      country: 'Switzerland',
      region: 'Europe',
      price: 349,
      days: 5,
      rating: 4.9,
      reviews: 96,
      photo: 'dest-swiss.jpg',
      photoSm: 'dest-swiss-sm.jpg',
      tag: 'Mountains',
      excerpt: 'Alpine meadows, cable cars above the clouds and air that actually tastes clean.',
      highlights: ['Glacier Express rail pass', 'Cable car to the summit', 'Guided alpine hike', 'Cheese tasting in Bad Ragaz']
    },
    {
      id: 'thailand',
      title: 'Thailand',
      country: 'Thailand',
      region: 'Asia',
      price: 219,
      days: 6,
      rating: 4.7,
      reviews: 302,
      photo: 'dest-thailand.jpg',
      photoSm: 'dest-thailand-sm.jpg',
      tag: 'Islands',
      excerpt: 'Warm water, night markets and long-tail boats waiting to take you somewhere quieter.',
      highlights: ['Island hopping by long-tail boat', 'Floating market breakfast', 'Thai cooking class', 'Beachfront bungalow']
    },
    {
      id: 'taiwan',
      title: 'Taiwan',
      country: 'Taiwan',
      region: 'Asia',
      price: 279,
      days: 4,
      rating: 4.6,
      reviews: 74,
      photo: 'dest-taiwan.jpg',
      photoSm: 'dest-taiwan-sm.jpg',
      tag: 'Food & city',
      excerpt: 'Neon night markets, mountain tea houses and the friendliest street food in Asia.',
      highlights: ['Taipei night markets', 'Jiufen tea houses', 'Taroko gorge day trip', 'Hot spring evening']
    },
    {
      id: 'lombok',
      title: 'Lombok',
      country: 'Indonesia',
      region: 'Asia',
      price: 259,
      days: 5,
      rating: 4.8,
      reviews: 61,
      photo: 'dest-indonesia.jpg',
      photoSm: 'dest-indonesia-sm.jpg',
      tag: 'Off the beaten track',
      excerpt: 'Quiet hills, empty beaches and a slower rhythm than its famous neighbour.',
      highlights: ['Rinjani foothills trek', 'Secret beach day', 'Traditional village visit', 'Sunset seafood dinner']
    },
    {
      id: 'singapore',
      title: 'Singapore',
      country: 'Singapore',
      region: 'Asia',
      price: 329,
      days: 3,
      rating: 4.7,
      reviews: 188,
      photo: 'dest-singapore.jpg',
      photoSm: 'dest-singapore-sm.jpg',
      tag: 'City & nature',
      excerpt: 'Marina Bay after dark, gardens in the sky and hawker food worth the flight alone.',
      highlights: ['Marina Bay skyline walk', 'Gardens by the Bay', 'Hawker centre food tour', 'Sentosa beach day']
    }
  ];

  var features = [
    {
      icon: 'icon-service.svg',
      title: 'Best service',
      text: 'A real person plans every trip with you — and stays reachable while you travel.',
      link: 'contact-page/index.html'
    },
    {
      icon: 'icon-guarantee.svg',
      title: 'Price guarantee',
      text: 'Find the same itinerary cheaper within 24 hours and we refund the difference.',
      link: 'package-page/index.html'
    },
    {
      icon: 'icon-hotel.svg',
      title: 'Handpicked hotels',
      text: 'Every property is visited by our team, so what you see is what you actually get.',
      link: 'about_us-page/index.html'
    }
  ];

  var testimonials = [
    {
      name: 'Sara Jay',
      role: 'Traveller · London',
      avatar: 'person-sara.jpg',
      rating: 5,
      text: 'Bali with Travosca was effortless. Every transfer, guide and sunrise was already arranged — I just turned up and enjoyed it.'
    },
    {
      name: 'Cristian Daniel',
      role: 'Photographer · Lisbon',
      avatar: 'person-cristian.jpg',
      rating: 5,
      text: 'They built the whole route around the light I wanted. Six days in the Alps and not one wasted hour of shooting.'
    },
    {
      name: 'Kausar Hasan',
      role: 'Travel writer · Dhaka',
      avatar: 'person-kausar.jpg',
      rating: 5,
      text: 'I book three or four trips a year and this is the only team that remembers how I like to travel.'
    }
  ];

  var partners = [
    { name: 'Booking.com', logo: 'partner-booking.svg' },
    { name: 'Katana', logo: 'partner-katana.svg' },
    { name: 'Travala', logo: 'partner-travava.svg' },
    { name: 'Bigui', logo: 'partner-bigui.svg' },
    { name: 'Jakmaen', logo: 'partner-jakmaen.svg' }
  ];

  var posts = [
    {
      id: 'travel-stories',
      category: 'Stories | Tips',
      title: 'Travel Stories For Now and the Future',
      date: 'January 18, 2026',
      author: 'Hasmar',
      photo: 'article-stories.jpg',
      photoSm: 'article-stories-sm.jpg',
      excerpt: 'What the last few years taught us about slow borders, flexible plans and the trips worth waiting for.',
      featured: true
    },
    {
      id: 'destinations-on-sale',
      category: 'Perfect | Tips',
      title: '9 Popular Travel Destination on Sale in 2026',
      date: 'March 4, 2026',
      author: 'Hasmar',
      photo: 'dest-bali.jpg',
      photoSm: 'dest-bali-sm.jpg',
      excerpt: 'Nine places where your money suddenly goes a lot further — and how to time the booking.'
    },
    {
      id: 'how-we-travel',
      category: 'Tips | Travel',
      title: 'How Are We Going to Travel in 2026',
      date: 'May 22, 2026',
      author: 'Hasmar',
      photo: 'blog-terraces.jpg',
      photoSm: 'blog-terraces-sm.jpg',
      excerpt: 'Smaller groups, longer stays and trains instead of short hops. A look at what changed and why.'
    }
  ];

  var gallery = [
    { photo: 'gallery-diving.jpg', photoSm: 'gallery-diving.jpg', title: 'Free diving, open water', place: 'Indian Ocean' },
    { photo: 'gallery-dubai.jpg', photoSm: 'gallery-dubai.jpg', title: 'Burj Al Arab from the air', place: 'Dubai' },
    { photo: 'gallery-paris.jpg', photoSm: 'gallery-paris.jpg', title: 'Bicycle and shutters', place: 'Montmartre, Paris' },
    { photo: 'gallery-coast.jpg', photoSm: 'gallery-coast.jpg', title: 'Coastline at golden hour', place: 'Mediterranean' }
  ];

  var offices = [
    {
      city: 'Atlanta',
      label: 'Head office',
      address: '732 Despard St, Atlanta, GA',
      phone: '+97 888 8888',
      email: 'info@traveller.com'
    },
    {
      city: 'Lhoksemawe',
      label: 'Aceh desk',
      address: 'JI. Darussalam Hagu Selatan',
      phone: '+7589 367 503',
      email: 'contact@domain.com'
    },
    {
      city: 'Singapore',
      label: 'Partner desk',
      address: '18 Marina Bay Drive',
      phone: '+65 6812 3400',
      email: 'partners@traveller.com'
    }
  ];

  var months = [
    'Any month', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  window.TRAVOSCA = {
    base: base,
    img: img,
    destinations: destinations,
    features: features,
    testimonials: testimonials,
    partners: partners,
    posts: posts,
    gallery: gallery,
    offices: offices,
    months: months
  };
})();
