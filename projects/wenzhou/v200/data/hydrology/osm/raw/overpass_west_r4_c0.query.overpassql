[out:json][timeout:180];
(
  way["natural"="coastline"](28.61927895,119.84414554,28.95739932,120.15300000);
  way["waterway"~"^(river|stream|canal|tidal_channel)$"](28.61927895,119.84414554,28.95739932,120.15300000);
);
out tags geom qt;
