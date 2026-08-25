[out:json][timeout:180];
(
  way["natural"="coastline"](28.27300000,120.15000000,29.15000000,121.20200000);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](28.27300000,120.15000000,29.15000000,121.20200000);
);
out tags geom qt;
