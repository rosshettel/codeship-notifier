"use strict";

var express = require('express'),
	app = express(),
	bodyParser = require('body-parser'),
	port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/', function (req, res) {
	res.send('Hello World!');
});

app.post('/', function (req, res) {
	console.log('received webhook', req.body);
	res.end();	//dont need to send anything back
});

app.listen(port);