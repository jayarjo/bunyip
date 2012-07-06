var util = require('util');

function extend(target) {
	Array.prototype.forEach.call(arguments, function(arg, i) {
		if (i > 0) {
			var props = Object.getOwnPropertyNames(arg);

			props.forEach(function(name) {
				var destination = Object.getOwnPropertyDescriptor(arg, name);
				Object.defineProperty(target, name, destination);
			});
		}
	});
	return target;
}

/**
Generates an unique ID. This is 99.99% unique since it takes the current time and 5 random numbers.
The only way a user would be able to get the same ID is if the two persons at the same exact milisecond manages
to get 5 the same random numbers between 0-65535 it also uses a counter so each call will be guaranteed to be page unique.
It's more probable for the earth to be hit with an ansteriod. Y

@author Moxiecode
@method guid
@param {String} prefix to prepend (by default 'o' will be prepended).
@method guid
@return {String} Virtually unique id.
 */
var guid = (function() { 
	var counter = 0;
	
	return function(prefix) {
		var guid = new Date().getTime().toString(32), i;

		for (i = 0; i < 5; i++) {
			guid += Math.floor(Math.random() * 65535).toString(32);
		}
		
		return (prefix || '') + guid + (counter++).toString(32);
	}
}());

extend(util, {
	guid: guid,
	extend: extend,
});

module.exports = util;