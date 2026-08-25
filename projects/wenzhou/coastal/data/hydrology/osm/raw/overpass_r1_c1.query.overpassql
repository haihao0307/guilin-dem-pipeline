[out:json][timeout:180];
(
  way["natural"="coastline"](28.27300000,121.19800000,29.15000000,122.25000000);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](28.27300000,121.19800000,29.15000000,122.25000000);
);
out tags geom qt;
