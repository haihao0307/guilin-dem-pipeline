[out:json][timeout:180];
(
  way["natural"="coastline"](27.40000000,120.15000000,28.27700000,121.20200000);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](27.40000000,120.15000000,28.27700000,121.20200000);
);
out tags geom qt;
