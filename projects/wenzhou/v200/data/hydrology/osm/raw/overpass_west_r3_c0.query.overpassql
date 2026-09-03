[out:json][timeout:180];
(
  way["natural"="coastline"](28.28715858,119.84414554,28.62527895,120.15300000);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](28.28715858,119.84414554,28.62527895,120.15300000);
);
out tags geom qt;
