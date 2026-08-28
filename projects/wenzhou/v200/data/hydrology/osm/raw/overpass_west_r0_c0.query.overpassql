[out:json][timeout:180];
(
  way["natural"="coastline"](27.29379747,119.84414554,27.62891784,120.15300000);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](27.29379747,119.84414554,27.62891784,120.15300000);
);
out tags geom qt;
