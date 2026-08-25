[out:json][timeout:180];
(
  way["natural"="coastline"](27.40000000,121.19800000,28.27700000,122.25000000);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](27.40000000,121.19800000,28.27700000,122.25000000);
);
out tags geom qt;
