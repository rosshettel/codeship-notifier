"use strict";

var express = require('express'),
	app = express(),
	port = process.env.PORT || 3000;

app.get('/', function (req, res) {
	res.send('Hello World!');
});

app.post('/', function (req, res) {
	console.log('received webhook', req.body);
});

app.listen(port);