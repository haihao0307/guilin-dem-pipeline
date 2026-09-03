[out:json][timeout:180];
(
  way["natural"="coastline"](27.95503821,119.84414554,28.29315858,120.15300000);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](27.95503821,119.84414554,28.29315858,120.15300000);
);
out tags geom qt;
