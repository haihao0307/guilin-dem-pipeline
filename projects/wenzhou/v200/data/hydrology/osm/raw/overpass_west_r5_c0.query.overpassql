[out:json][timeout:180];
(
  way["natural"="coastline"](28.95139932,119.84414554,29.28651969,120.15300000);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](28.95139932,119.84414554,29.28651969,120.15300000);
);
out tags geom qt;
