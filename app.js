var express = require('express');
var path = require('path');
var fs = require('fs');
var async = require('async');
var MongoClient = require('mongodb').MongoClient;
var app = express();
var controllers = [{}];
var routes;
app.db = {};
app.routerUtills = {};

app.routerUtills.getRoute = function(path, verb) {
  for (var routeController in routes) {
    console.info(routeController);
    var controller = controllers.filter(function (obj) {
      return obj.name == routeController;
    });
    var routesForController = routes[routeController];
    var matches = routesForController.filter(function (obj) {
      return obj.path == path && obj.verb == verb;
    });
    if (matches[0] != null || matches.length == 1) {
      console.info(JSON.stringify(matches));
      var route = matches[0];
      route.controller = controller[0].object;
      return route;
    }
  }
};

function registerControllers() {
  console.info("Starting controller registration");

  var controllerFiles = {};
  var routesFile = {};

  console.info(path.join(process.cwd(), "controllers"));

  async.series([
    function () {
      MongoClient.connect("mongodb://localhost:27017/yayes2", function(err, db) {
        if (err) console.info("Error connecting to database: " + err);
        else console.info("Connected to database");
        app.db = db;
      });
    },
    function () {
      fs.readdir(path.join(process.cwd(), "controllers"), function (err, files) {
        if (err) {
          console.error("Error loading controllers: " + err);
          throw err;
        }
        console.info(files);
        controllerFiles = files;
      });
    },
    function () {
      fs.readFile(path.join(process.cwd(), "routes.json"), function (err, data) {
        if (err) {
          console.error("Error loading routes.json: %s", err);
          throw err;
        }
        routesFile = data;
      });
    }
  ]);

  console.info(controllerFiles);

  routes = routesFile.toString();
  for (var controllerFile in controllerFiles) {
    var controllerName = controllerFiles[controllerFile].split(".")[0];
    console.info("Loading controller: " + controllerName);
    var controllerPath = path.join(process.cwd(), "controllers/", controllerName + ".js");
    var modelPath = path.join(process.cwd(), "models/", controllerName + ".json");
    var controllerCollection = db.collection(controllerName);
    var controller = require(controllerPath)(app, controllerCollection);
    for (var route in routes[controllerName]) {
      route = routes[controllerName][route];
      app[route.verb](route.path, function (req, res) {
        route = app.routerUtills.getRoute(req.path, req.method.toLowerCase());
        console.info(route.verb.toUpperCase() + " " + route.path);
        route.controller.router[route.function](req, res)
      });
      console.info("Registered " + route.verb.toUpperCase() + " " + route.path);
    }
    var model = {};
    fs.readFileSync(modelPath, {}, function (err, data) {
      if (err) {
        console.error("Error loading model %s: %s", modelPath, err);
        throw err;
      }
      model = JSON.parse(data.toString());
    });
    controllers[controllers.length] = {
      name: controllerName,
      object: controller,
      model: model,
      dbCollection: controllerCollection
    };
  }
}

module.exports = function () {
  console.info("Loading MVC framework");
  app.set('views', path.join(process.cwd(), "../../,", 'views'));
  app.set('view engine', 'jade');
  app.use(express.static(path.join(process.cwd(), "../../,", 'public')));
  registerControllers();

  app.use(function(req, res, next){
    console.info("404 " + req.path);
    res.status(404);

    if (req.accepts('html')) res.render('error/404');
    else if (req.accepts('json')) res.end({error: 'Not found'});
    else res.type('txt').end('Not found');
    console.info("404 page registered");
  });

  app.server = app.listen(3000, function () {
    var host = app.server.address().address;
    var port = app.server.address().port;
    console.info('Server listening at http://%s:%s', host, port);
  });

  var data = {app: app, controllers: controllers};
  return data;
};