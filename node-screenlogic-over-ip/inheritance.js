// Setup prototypical inheritance

function surrogate_constructor() {}
 
function extend(base, sub) {
  surrogate_constructor.prototype = base.prototype;
  sub.prototype = new surrogate_constructor();
  sub.prototype.constructor = sub;
}

module.exports.extend = extend