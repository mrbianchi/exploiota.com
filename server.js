const express = require('express'),
    app = express(),
    proxyToNode = express(),
    path = require('path'),
    bodyParser = require('body-parser'),
    pug = require('pug'),
    minify = require('express-minify'),
    compression = require('compression'),
    uglifyEs = require('uglify-es'),
    request = require('request'),
    proxy = require('express-http-proxy');

/* CONFIG THINGS */
app.set("view engine", "pug");
app.use(require('helmet')());
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(compression());
app.use(minify({
    cache: "cache",
    uglifyJsModule: uglifyEs,
    jsMatch: /javascript/,
    cssMatch: /css/,
    errorHandler: console.log
  }));
app.use(express.static(path.join(__dirname, './static')));
app.listen(81,()  => { console.log('Listening on port 81');});
app.all(/.*/, function(req, res, next) {
    var host = req.header("host");
    if (typeof host != 'undefined' && host.match(/^www\..*/i)) {
      next();
    } else {
      res.redirect(301, "https://www." + host + req.originalUrl);
    }
  });
//HTTPS
//const options = {
//    cert: fs.readFileSync('./sslcertExpanded/fullchain.pem'),
//    key: fs.readFileSync('./sslcertExpanded/privkey.pem')
//};
//https.createServer(options, app).listen(443);
//app.all(/.*/, function(req, res, next) {
//  var host = req.header("host");
//  if (typeof host != 'undefined' && host.match(/^www\..*/i)) {
//    next();
//  } else {
//    res.redirect(301, "https://www." + host);
//  }
//});

app.get('*', (req, res) => {
    res.render("index");
});

app.use('/node', proxy('https://nodes.iota.fm:443'));