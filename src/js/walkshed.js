(function(){
  var zoom = 14,
      buffer = 3200,
      tileSize = 256,
      maxCost = 1600,
      gm = new GlobalMercator(),
      //ts = tileStitcher('tiles/{z}/{x}/{y}.png', {scheme:'tms'}),
      ts = tileStitcher('proxy.ashx?http://54.212.254.185:8888/v2/FSPCost/{z}/{x}/{y}.png'),
          
      map = L.map('map'),
      //layerUrl = 'http://{s}.tiles.mapbox.com/v3/atogle.map-vo4oycva/{z}/{x}/{y}.png',
      layerUrl = 'http://54.212.254.185:8888/v2/FSPCost/{z}/{x}/{y}.png',
      attribution = 'Map data &copy; OpenStreetMap contributors, CC-BY-SA <a href="http://mapbox.com/about/maps" target="_blank">Terms &amp; Feedback</a>',
      layer = new L.TileLayer(layerUrl, {opacity: 0.6, maxZoom: 17, attribution: attribution, subdomains: 'abcd'}),
      canvasLayer;



  var bing = new L.BingLayer("Agq9ShzaLxY_pLNncoi4Haalm7lcMAmo7Tq3NAwuAdPNTdSrmmH85Pmn-jFrxjnU");


  map
.setView([2.89, 35.94], 14)
.addLayer(bing)
.addLayer(layer);

  function to2D(array1D, width) {
    var array2D = [],
        i;

    for(i=0; i<width; i++) {
      array2D[i] = Array.prototype.slice.call(array1D, i*width, i*width+width);
    }

    return array2D;
  }

  function getColor(percentage) {
    if (percentage <= 0.25) {
      return [26,150,65,200];
    } else if (percentage <= 0.5) {
      return [166,217,106,200];
    } else if (percentage <= 0.75) {
      return [255,255,191,200];
    } else if (percentage <= 0.95) {
      return [253,174,97,200];
    } else if (percentage <= 0.999) {
      return [215,25,28,200];
    } else {
      return [255,0,0,0];
    }
  }

  function draw(frictionCanvas, mapCanvas, sourcePixel) {
    var cd = costDistance(),
        mapCtx = mapCanvas.getContext('2d'),
        frictionCtx = frictionCanvas.getContext('2d'),
        w = frictionCanvas.width,
        h = frictionCanvas.height,
        frictionImageData = frictionCtx.getImageData(0, 0, w, h),
        data = frictionImageData.data,
        frictionRaster = [],
        cdData = [],
        sourceRaster = to2D([], w),
        row, col, i, n,
        red, green, blue, alpha, pixel, color,
        costDistanceRaster, cdImageData;

    mapCanvas.width = w;
    mapCanvas.height = h;

    // Init the source raster
    sourceRaster[sourcePixel.y][sourcePixel.x] = 1;

    // Init the friction raster
    row = -1;
    for(i = 0, n = data.length; i < n; i += 4) {
      red = data[i],
      green = data[i + 1],
      blue = data[i + 2],
      alpha = data[i + 3],
      pixel = i / 4;

      if (pixel % w === 0) {
        row++;
        frictionRaster[row] = [];
      }

      frictionRaster[row][pixel - (row * w)] = blue;
    }

    // Calculate the costdistance raster
    costDistanceRaster = cd.calculate(frictionRaster, sourceRaster, maxCost);

    // Turn cost into pixels to display
    n=0;
    for(row=0; row<h; row++){
      for(col=0; col<w; col++){
        color = getColor((costDistanceRaster[row][col] || maxCost) / maxCost);
        if (costDistanceRaster[row][col] === maxCost) {
          data[4*n] = 0;
          data[4*n + 1] = 0;
          data[4*n + 2] = 0;
          data[4*n + 3] = 255;
        } else {
          data[4*n] = color[0];
          data[4*n + 1] = color[1];
          data[4*n + 2] = color[2];
          data[4*n + 3] = color[3];
        }
        n++;
      }
    }
    frictionImageData.data = data;

    // Draw it on the map layer
    mapCtx.putImageData(frictionImageData, 0, 0);
  }

  function TMStoXYZ(tile, zoom) {
      return [tile[0], Math.pow(2, zoom) - (tile[1])];
  }

  map.on('click', function(evt) {
    // NOTE! this is TMS specific logic
      //var originMeters = gm.LatLonToMeters(evt.latlng.lat, evt.latlng.lng);
      var originMeters = LatLonToMeters(evt.latlng.lat, evt.latlng.lng);

      //Add buffer to Meters
      var swBufferMeters = {dy: originMeters.y - buffer, dx: originMeters.x - buffer}; //Buffer downwards and left from the click point

      var swBufferLatLon = MetersToLatLon(swBufferMeters.dy, swBufferMeters.dx);

      var swTileX = long2tile(swBufferLatLon.x, zoom); //Get extreme left x tile from the SW Buffer
      var swTileY = lat2tile(swBufferLatLon.y, zoom);//Get extreme bottom y tile from the SW Buffer

      var swXYZ = {y: swTileY, x: swTileX};

      //Get the tile's bounds
      var swTileBoundsLatLng = tile2boundingBox(swXYZ.x, swXYZ.y, zoom);

      var swTileBoundsMeters = {};
      swTileBoundsMeters.sw = LatLonToMeters(swTileBoundsLatLng.south, swTileBoundsLatLng.west);
      swTileBoundsMeters.ne = LatLonToMeters(swTileBoundsLatLng.north, swTileBoundsLatLng.east);

        // Southwest, MinX/MaxY Tile - in TMS it's MinY
      //var swTile = gm.MetersToTile(originMeters[0] + buffer, originMeters[1] - buffer, zoom);

      ////convert to XYZ
      //var swXYZ = TMStoXYZ(swTile, zoom);

      //var swTileBoundsMeters = gm.TileBounds(swXYZ[0], swXYZ[1], zoom);
      //var swTileBoundsLatLng = gm.TileLatLonBounds(swXYZ[0], swXYZ[1], zoom);

      var neBufferMeters = { dy: originMeters.y + buffer, dx: originMeters.x + buffer };
      var neBufferLatLon = MetersToLatLon(neBufferMeters.dy, neBufferMeters.dx);

      var neTileX = long2tile(neBufferLatLon.x, zoom); //Get extreme right x tile from the NE Buffer
      var neTileY = lat2tile(neBufferLatLon.y, zoom); //Get extreme top y tile from the NE Buffer

      var neXYZ = { y: neTileY, x: neTileX };

      //Get the tile's bounds
      var neTileBoundsLatLng = tile2boundingBox(neXYZ.x, neXYZ.y, zoom);

      var neTileBoundsMeters = {};
      neTileBoundsMeters.sw = LatLonToMeters(neTileBoundsLatLng.south, neTileBoundsLatLng.west);
      neTileBoundsMeters.ne = LatLonToMeters(neTileBoundsLatLng.north, neTileBoundsLatLng.east);



      //  // Northeast, MaxX/MinY - in TMS it's maxY
      //var neTile = gm.MetersToTile(originMeters[0] - buffer, originMeters[1] + buffer, zoom);
      ////convert to XYZ
      //var neXYZ = TMStoXYZ(neTile, zoom);
      //var neTileBoundsMeters = gm.TileBounds(neXYZ[0], neXYZ[1], zoom);
      //var neTileBoundsLatLng = gm.TileLatLonBounds(neXYZ[0], neXYZ[1], zoom);

        costImageData = [],
        pixel = {};

    var xMetersDiff = neTileBoundsMeters.ne.x- swTileBoundsMeters.sw.x,
        yMetersDiff = neTileBoundsMeters.ne.y - swTileBoundsMeters.sw.y,
        mergedSizeX = (neXYZ.x - swXYZ.x + 1) * tileSize,
        mergedSizeY = (swXYZ.y - neXYZ.y + 1) * tileSize;

    pixel.x = Math.round(mergedSizeX * (originMeters.x - swTileBoundsMeters.sw.x) / xMetersDiff);
    pixel.y = mergedSizeY - Math.round(mergedSizeY * (originMeters.y - swTileBoundsMeters.sw.y) / yMetersDiff);


    // TODO: add setBounds() to canvas layer?
    if (canvasLayer) {
      map.removeLayer(canvasLayer);
    }
    canvasLayer = L.imageOverlay.canvas(L.latLngBounds([swTileBoundsLatLng.south, swTileBoundsLatLng.west], [neTileBoundsLatLng.north, neTileBoundsLatLng.east]));
    canvasLayer.addTo(map);

    ts.stitch(swXYZ.x, neXYZ.y, neXYZ.x, swXYZ.y, zoom, function (stitchedCanvas) { //west, south, east, north
      draw(stitchedCanvas, canvasLayer.canvas, pixel);

      // For debugging:
       //canvasLayer.canvas.width = stitchedCanvas.width;
       //canvasLayer.canvas.height = stitchedCanvas.height;
       //canvasLayer.canvas.getContext('2d').drawImage(stitchedCanvas, 0, 0);
    });
  });
})();